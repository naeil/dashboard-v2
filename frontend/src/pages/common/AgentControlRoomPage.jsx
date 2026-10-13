import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { getAgentControlRoom, getAgentOverview } from '../../api/agentActivityApi'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

// 24시간 모니터에 띄워 두는 AI 관제실: 운영 에이전트(A) + 관제 에이전트(B) 현황을 한 화면에
const REFRESH_MS = 15000
const KIND_LABEL = { TASK: '작업', APPROVAL: '승인 요청', ALERT: '알림', REPORT: '보고' }
const KIND_COLOR = { TASK: '#38bdf8', APPROVAL: '#f59e0b', ALERT: '#f43f5e', REPORT: '#34d399' }
const AGENT_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b']
const TICK = { color: '#94a3b8', font: { size: 11 } }
const GRID = { color: 'rgba(148,163,184,0.12)' }

const num = (v) => Number(v ?? 0)
const won = (v) => '₩' + Math.round(num(v)).toLocaleString('ko-KR')
const ago = (value) => {
  if (!value) return '-'
  const sec = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (sec < 60) return `${sec}초 전`
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`
  return `${Math.floor(sec / 86400)}일 전`
}
const roleOf = (name = '') => (name.includes('관제') ? '관제' : '운영')
const failed = (section) => !section || section.error
// "발송 23/55" 같은 결과 문구에서 진행률을 읽는다
const progressOf = (text = '') => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text)
  return m && num(m[2]) > 0 ? Math.min(100, Math.round((num(m[1]) / num(m[2])) * 100)) : null
}

function Panel({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-black tracking-wide text-slate-200">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, tone = 'text-white' }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-[11.5px] font-bold text-slate-400">{label}</p>
      <p className={`mt-1 text-[26px] font-black leading-none ${tone}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

function AgentCard({ agent }) {
  const minutes = num(agent.minutes_since)
  const online = agent.last_seen_at && minutes <= 15
  const role = roleOf(agent.agent_name)
  return (
    <div className={`rounded-2xl border p-4 ${online ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/10'}`}>
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative inline-flex h-3 w-3 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        </span>
        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10.5px] font-black text-slate-300">{role}</span>
        <p className="truncate text-[14px] font-black text-white">{agent.agent_name}</p>
      </div>
      <p className="mt-2 truncate text-[12.5px] text-slate-300">{agent.status_text || '대기 중'}</p>
      <p className={`mt-1 text-[11px] font-bold ${online ? 'text-emerald-400' : 'text-rose-400'}`}>
        {online ? '정상' : '응답 없음'} · 마지막 신호 {ago(agent.last_seen_at)} · {agent.host || '-'}
      </p>
    </div>
  )
}

function FeedRow({ item }) {
  const color = KIND_COLOR[item.kind] || '#94a3b8'
  return (
    <div className="flex items-start gap-2.5 border-b border-slate-800 py-2 last:border-b-0">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-slate-100">{item.title}</p>
        <p className="text-[11px] text-slate-500">
          {KIND_LABEL[item.kind] || item.kind} · {item.agent_name} · {ago(item.updated_at || item.created_at)}
        </p>
      </div>
    </div>
  )
}

const parseJson = (text) => { try { return JSON.parse(text) } catch { return null } }
const dday = (date) => Math.ceil((new Date(`${date}T00:00:00+09:00`) - new Date(new Date().toDateString())) / 86400000)
const SEVERITY = {
  3: { label: '긴급', cls: 'border-rose-500/60 bg-rose-500/10', badge: 'bg-rose-500 text-white' },
  2: { label: '주의', cls: 'border-amber-500/50 bg-amber-500/10', badge: 'bg-amber-500 text-slate-950' },
  1: { label: '확인', cls: 'border-sky-500/40 bg-sky-500/5', badge: 'bg-sky-500 text-slate-950' },
}

// 지금 확인할 것(무엇·왜·할 일)과 정상 항목을 데이터에서 판정한다
function triage(room, ops, now) {
  const issues = []
  const ok = []
  const agents = Array.isArray(room?.agents) ? room.agents : []
  const down = agents.filter((a) => !a.last_seen_at || num(a.minutes_since) > 15)
  down.forEach((a) => issues.push({ sev: 3, what: `${a.agent_name} 응답 없음`, why: `${num(a.minutes_since)}분째 신호가 없습니다.`, todo: '해당 컴퓨터의 전원·네트워크를 확인하세요(Chrome 원격 데스크톱).' }))
  if (agents.length && !down.length) ok.push('에이전트 정상')

  // 주문은 실시간 수집이 아니라 구글시트 '[raw]매출관리'를 매시 다시 읽어 일 단위로 적재한다(오늘 분은 보통 다음 날 입력).
  // 그래서 낮 시간 '오늘 주문 0건'·수집 시각은 이상 신호가 아니며, 주문 판정은 하지 않는다.
  const orders = room?.orders
  if (orders && !orders.error) {
    const pulledMin = orders.lastCollectedAt ? (now - new Date(orders.lastCollectedAt)) / 60000 : null
    if (pulledMin !== null && pulledMin > 180) {
      issues.push({ sev: 2, what: '매출 시트 반영 멈춤', why: `시트를 마지막으로 읽은 지 ${Math.round(pulledMin / 60)}시간 지났습니다(평소 매시 정각).`, todo: '시트 공유 설정(링크 보기 권한)과 서버 상태를 확인하세요.' })
    } else ok.push('매출 시트 반영')
  }

  const stock = room?.stock
  if (stock && !stock.error) {
    const low = stock.belowSafeStock || []
    if (low.length) issues.push({ sev: 2, what: `안전재고 미만 ${low.length}개`, why: low.slice(0, 3).map((p) => `${p.product_name} ${num(p.real_stock)}개`).join(', '), todo: '생산·발주 일정을 확인하세요.' })
    else ok.push('재고')
  }

  const cs = room?.cs
  if (cs && !cs.error) {
    const unanswered = num(cs.unansweredInquiries?.count) + num(cs.newCsInquiries?.count)
    const oldestH = cs.unansweredInquiries?.oldest ? (now - new Date(cs.unansweredInquiries.oldest)) / 3600000 : 0
    if (oldestH > 24) issues.push({ sev: 2, what: `미답변 문의 ${unanswered}건`, why: `가장 오래된 문의가 ${Math.round(oldestH)}시간째 대기 중입니다.`, todo: 'CS 담당이 오늘 안에 답변하세요.' })
    else if (unanswered) issues.push({ sev: 1, what: `새 문의 ${unanswered}건`, why: '답변 대기 중입니다.', todo: 'CS 화면에서 확인하세요.' })
    else ok.push('고객 문의')
    const bad = num(cs.lowRatingReviews24h)
    if (bad) issues.push({ sev: 2, what: `저평점 리뷰 ${bad}건`, why: '최근 24시간 별점 2점 이하 리뷰가 달렸습니다.', todo: '내용 확인 후 사과·보상 답글을 남기세요.' })
    else ok.push('리뷰')
  }

  const ap = room?.approvals
  if (ap && !ap.error) {
    if (num(ap.failed_24h)) issues.push({ sev: 2, what: `AI 작업 실패 ${num(ap.failed_24h)}건`, why: '최근 24시간 안에 실패한 작업이 있습니다.', todo: 'AI 에이전트 활동에서 실패 사유를 확인하세요.' })
    if (num(ap.pending)) issues.push({ sev: 1, what: `승인 대기 ${num(ap.pending)}건`, why: 'AI가 대표 승인을 기다리고 있습니다.', todo: 'AI 에이전트 활동에서 승인 또는 반려하세요.' })
    if (!num(ap.failed_24h) && !num(ap.pending)) ok.push('AI 작업')
  }

  ;(ops?.deadlines || []).forEach((d) => {
    const left = dday(d.date)
    if (left >= 0 && left <= 3) issues.push({ sev: left <= 1 ? 3 : 2, what: `마감 D-${left}: ${d.name}`, why: `${d.date} 마감입니다.`, todo: '제출 여부를 오늘 결정하세요.' })
  })
  if (ops?.disk && num(ops.disk.freeGb) < 3) {
    issues.push({ sev: num(ops.disk.freeGb) < 1.5 ? 3 : 2, what: `회사 PC 저장 공간 ${ops.disk.freeGb}GB`, why: '공간이 부족하면 수집·발송이 멈출 수 있습니다.', todo: '불필요한 파일을 정리하세요.' })
  }
  return { issues: issues.sort((a, b) => b.sev - a.sev), ok }
}

function IssueCard({ issue }) {
  const s = SEVERITY[issue.sev]
  return (
    <div className={`rounded-2xl border p-4 ${s.cls}`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-black ${s.badge}`}>{s.label}</span>
        <p className="text-[14px] font-black text-white">{issue.what}</p>
      </div>
      <p className="mt-2 text-[12.5px] text-slate-300"><span className="font-bold text-slate-400">왜 · </span>{issue.why}</p>
      <p className="mt-1 text-[12.5px] text-slate-100"><span className="font-bold text-slate-400">할 일 · </span>{issue.todo}</p>
    </div>
  )
}

function ordersChart(hourly, nowHour) {
  const labels = Array.from({ length: 24 }, (_, h) => `${h}시`)
  const today = Array(24).fill(0)
  const avg = Array(24).fill(0)
  ;(hourly?.today || []).forEach((r) => { today[num(r.h)] = num(r.count) })
  ;(hourly?.sameWeekdayAvg || []).forEach((r) => { avg[num(r.h)] = num(r.count) })
  // 누적으로 보여 줘야 "평소 이 시각까지 대비" 흐름이 한눈에 보인다
  const cum = (arr, upto) => arr.reduce((acc, v, i) => { acc.push(i > upto ? null : (acc[i - 1] || 0) + v); return acc }, [])
  return {
    labels,
    datasets: [
      { label: '오늘 누적 주문', data: cum(today, nowHour), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.15)', fill: true, tension: 0.3, pointRadius: 0 },
      { label: '같은 요일 4주 평균', data: cum(avg, 23), borderColor: '#64748b', borderDash: [5, 4], fill: false, tension: 0.3, pointRadius: 0 },
    ],
  }
}

function activityChart(rows) {
  const now = new Date()
  const slots = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now); d.setMinutes(0, 0, 0); d.setHours(d.getHours() - (23 - i)); return d
  })
  const agents = [...new Set((rows || []).map((r) => r.agent_name))]
  return {
    labels: slots.map((d) => `${d.getHours()}시`),
    datasets: agents.map((name, i) => ({
      label: name,
      backgroundColor: AGENT_COLORS[i % AGENT_COLORS.length],
      borderRadius: 3,
      data: slots.map((s) => (rows || [])
        .filter((r) => r.agent_name === name && new Date(r.hour).getTime() === s.getTime())
        .reduce((a, r) => a + num(r.count), 0)),
    })),
  }
}

function kindChart(rows) {
  const kinds = ['TASK', 'REPORT', 'ALERT', 'APPROVAL']
  const by = (k) => (rows || []).filter((r) => r.kind === k).reduce((a, r) => a + num(r.count), 0)
  return {
    labels: kinds.map((k) => KIND_LABEL[k]),
    datasets: [{ data: kinds.map(by), backgroundColor: kinds.map((k) => KIND_COLOR[k]), borderWidth: 0 }],
  }
}

const axisOptions = (stacked = false) => ({
  responsive: true, maintainAspectRatio: false, animation: false,
  plugins: { legend: { labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 11 } } } },
  scales: { x: { stacked, ticks: { ...TICK, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: GRID },
            y: { stacked, beginAtZero: true, ticks: { ...TICK, precision: 0 }, grid: GRID } },
})

export default function AgentControlRoomPage() {
  const rootRef = useRef(null)
  const [room, setRoom] = useState(null)
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [lastLoaded, setLastLoaded] = useState(null)
  const [now, setNow] = useState(new Date())

  const load = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([getAgentControlRoom(), getAgentOverview(40)])
      setRoom(r); setOverview(o); setLastLoaded(new Date()); setError('')
    } catch (e) {
      setError(e?.response?.data?.message || '관제 데이터를 불러오지 못했습니다. 15초 뒤 다시 시도합니다.')
    }
  }, [])

  useEffect(() => {
    load()
    const refresh = setInterval(load, REFRESH_MS)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => { clearInterval(refresh); clearInterval(clock) }
  }, [load])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else rootRef.current?.requestFullscreen?.()
  }

  const agents = Array.isArray(room?.agents) ? room.agents : []
  const orders = room?.orders || {}
  const stock = room?.stock || {}
  const cs = room?.cs || {}
  const approvals = room?.approvals || {}
  const running = overview?.running || []
  const recent = overview?.recent || []
  const alerts = recent.filter((i) => i.kind === 'ALERT').slice(0, 8)
  const feed = recent.filter((i) => i.kind !== 'ALERT').slice(0, 12)
  const todayOrders = num(orders.today?.orders)
  const avgOrders = num(orders.sameWeekdayAvg?.orders)
  const orderRatio = avgOrders > 0 ? Math.round((todayOrders / avgOrders) * 100) : null
  const outOfStock = failed(stock) ? null : (stock.outOfStock || []).length
  const lowStock = failed(stock) ? null : (stock.belowSafeStock || []).length
  const unanswered = num(cs.unansweredInquiries?.count) + num(cs.newCsInquiries?.count)
  const lowReviews = num(cs.lowRatingReviews24h)
  const downAgents = agents.filter((a) => !a.last_seen_at || num(a.minutes_since) > 15)
  const boards = Array.isArray(room?.boards) ? room.boards : []
  const opsRow = boards.find((b) => b.board_key === 'ops')
  const ops = opsRow ? parseJson(opsRow.payload) : null
  const outreach = ops?.outreach
  const staffRow = boards.find((b) => b.board_key === 'staff-focus')
  const staff = staffRow ? parseJson(staffRow.payload) : null
  const { issues, ok: healthy } = triage(room, ops, now)

  return (
    <div ref={rootRef} className="min-h-full overflow-y-auto bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-black text-white">AI 관제실</h1>
            <p className="text-[12px] text-slate-400">운영 에이전트(실행)와 관제 에이전트(감시)의 현황 · {REFRESH_MS / 1000}초마다 자동 갱신 · 마지막 갱신 {lastLoaded ? ago(lastLoaded) : '-'}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[28px] font-black tabular-nums text-white">
              {now.toLocaleTimeString('ko-KR', { hour12: false })}
            </p>
            <button type="button" onClick={toggleFullscreen}
              className="flex h-9 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-[12px] font-black text-slate-200 hover:border-sky-500">
              <span className="material-symbols-outlined text-[18px]">fullscreen</span>전체 화면
            </button>
          </div>
        </header>

        {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-[12.5px] font-bold text-rose-300">{error}</p>}
        {downAgents.length > 0 && (
          <p className="animate-pulse rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-[13px] font-black text-rose-200">
            응답 없는 에이전트: {downAgents.map((a) => a.agent_name).join(', ')} — 컴퓨터 전원·네트워크를 확인하세요.
          </p>
        )}

        <Panel title={issues.length ? `지금 확인할 것 (${issues.length})` : '지금 확인할 것'}
          right={<div className="flex flex-wrap justify-end gap-1.5">{healthy.map((h) => (
            <span key={h} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">✓ {h}</span>
          ))}</div>}>
          {issues.length === 0
            ? <p className="text-[13px] font-bold text-emerald-300">지금 처리할 문제가 없습니다.</p>
            : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{issues.map((i, idx) => <IssueCard key={idx} issue={i} />)}</div>}
        </Panel>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {agents.length === 0
            ? <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-[12.5px] text-slate-400">연결된 에이전트가 없습니다.</p>
            : agents.map((a) => <AgentCard key={a.agent_name} agent={a} />)}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="오늘 주문 (시트 입력분)" value={failed(orders) ? '-' : todayOrders.toLocaleString('ko-KR')}
            sub={orderRatio === null ? '같은 요일 평균 없음' : `같은 요일 하루 평균 ${Math.round(avgOrders)}건 · 오늘 분은 보통 다음 날 입력`} />
          <Kpi label="오늘 매출 (시트 입력분)" value={failed(orders) ? '-' : won(orders.today?.sales)}
            sub={`같은 요일 평균 ${won(orders.sameWeekdayAvg?.sales)} · 시트 반영 ${ago(orders.lastCollectedAt)}`} />
          <Kpi label="품절 · 안전재고 미만" value={outOfStock === null ? '-' : `${outOfStock} · ${lowStock}`}
            tone={lowStock ? 'text-amber-400' : 'text-white'} sub="품절 목록은 최대 20건" />
          <Kpi label="미답변 문의" value={unanswered} tone={unanswered ? 'text-amber-400' : 'text-white'}
            sub={cs.unansweredInquiries?.oldest ? `가장 오래된 문의 ${ago(cs.unansweredInquiries.oldest)}` : '밀린 문의 없음'} />
          <Kpi label="저평점 리뷰(24시간)" value={lowReviews} tone={lowReviews ? 'text-rose-400' : 'text-white'} sub="별점 2점 이하" />
          <Kpi label="승인 대기 · 실패(24시간)" value={`${num(approvals.pending)} · ${num(approvals.failed_24h)}`}
            tone={num(approvals.pending) ? 'text-amber-400' : 'text-white'} />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <Panel title="주문 누적 (매출 시트 기준 · 일 단위 입력이라 시간대 구분 없음)" className="xl:col-span-2">
            <div className="h-64">
              {failed(room?.ordersHourly)
                ? <p className="text-[12px] text-slate-500">주문 데이터를 불러오지 못했습니다.</p>
                : <Line data={ordersChart(room?.ordersHourly, now.getHours())} options={axisOptions()} />}
            </div>
          </Panel>
          <Panel title="오늘 AI 활동 종류">
            <div className="h-64">
              <Doughnut data={kindChart(Array.isArray(room?.activityByKind) ? room.activityByKind : [])}
                options={{ responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
                  plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 11 } } } } }} />
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <Panel title="최근 24시간 에이전트 활동량" className="xl:col-span-2">
            <div className="h-56">
              <Bar data={activityChart(Array.isArray(room?.activityHourly) ? room.activityHourly : [])} options={axisOptions(true)} />
            </div>
          </Panel>
          <Panel title={`지금 하고 있는 일 (${running.length})`}>
            {running.length === 0
              ? <p className="text-[12.5px] text-slate-500">진행 중인 작업이 없습니다.</p>
              : running.slice(0, 6).map((item) => {
                const pct = progressOf(item.result || item.title)
                return (
                  <div key={item.id} className="border-b border-slate-800 py-2 last:border-b-0">
                    <p className="truncate text-[12.5px] font-bold text-slate-100">{item.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{item.agent_name} · {item.result || '진행 중'} · {ago(item.updated_at)}</p>
                    {pct !== null && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
          </Panel>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <Panel title="최근 알림" right={<span className="text-[11px] font-bold text-rose-400">{alerts.length}건</span>}>
            {alerts.length === 0 ? <p className="text-[12.5px] text-slate-500">최근 알림이 없습니다.</p> : alerts.map((i) => <FeedRow key={i.id} item={i} />)}
          </Panel>
          <Panel title="최근 활동" className="xl:col-span-2">
            {feed.length === 0 ? <p className="text-[12.5px] text-slate-500">아직 기록이 없습니다.</p> : feed.map((i) => <FeedRow key={i.id} item={i} />)}
          </Panel>
        </div>

        <Panel title="담당자별 놓친 것 · 오늘 마무리"
          right={<span className="text-[11px] text-slate-500">{staffRow ? `일일 업무 보고 기준 · AI가 ${ago(staffRow.updated_at)} 판단` : '아직 분석 전입니다'}</span>}>
          {!staff ? <p className="text-[12.5px] text-slate-500">운영 에이전트가 일일 업무 보고와 업무 목록을 분석하면 여기에 표시됩니다.</p> : (
            <>
              {staff.summary && <p className="mb-3 text-[13px] font-bold text-slate-200">{staff.summary}</p>}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(staff.people || []).map((p) => (
                  <div key={p.name} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-black text-white">{p.name} <span className="text-[11.5px] font-bold text-slate-500">{p.department}</span></p>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-black ${p.reportStatus === '제출' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        보고 {p.reportStatus || '-'}
                      </span>
                    </div>
                    {(p.missed || []).length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-black text-rose-300">놓친 것</p>
                        {p.missed.map((m, i) => (
                          <div key={i} className="border-b border-slate-800 py-1.5 last:border-b-0">
                            <p className="text-[12.5px] font-bold text-slate-100">{m.item}</p>
                            {m.why && <p className="text-[11px] text-slate-500">{m.why}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(p.today || []).length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-black text-amber-300">오늘 마무리</p>
                        {p.today.map((t, i) => (
                          <div key={i} className="flex gap-2 border-b border-slate-800 py-1.5 last:border-b-0">
                            <span className="w-12 shrink-0 font-mono text-[12px] font-black text-amber-300">{t.deadline}</span>
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-bold text-slate-100">{t.item}</p>
                              {t.reason && <p className="text-[11px] text-slate-500">{t.reason}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!(p.missed || []).length && !(p.today || []).length && <p className="mt-3 text-[12px] text-emerald-300">놓친 일이 없습니다.</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="운영 에이전트 업무" right={<span className="text-[11px] text-slate-500">{opsRow ? `A가 ${ago(opsRow.updated_at)} 올림` : '아직 올라온 업무 현황이 없습니다'}</span>}>
          {!ops ? <p className="text-[12.5px] text-slate-500">운영 에이전트가 업무 현황을 올리면 여기에 표시됩니다.</p> : (
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-3">
                {outreach && (
                  <div>
                    <div className="flex items-end justify-between">
                      <p className="text-[12px] font-bold text-slate-400">오늘 제안 메일</p>
                      <p className="text-[11px] text-slate-500">실패 {num(outreach.failed)} · 대기 {num(outreach.pending)}</p>
                    </div>
                    <p className="text-[26px] font-black text-white">{num(outreach.sentToday)}<span className="text-[14px] text-slate-400"> / {num(outreach.planned)}통</span></p>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${num(outreach.planned) ? Math.round((num(outreach.sentToday) / num(outreach.planned)) * 100) : 0}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">누적 제안 {num(outreach.totalSent)}곳 · 거래 중(제안 제외) {num(outreach.partners)}곳</p>
                  </div>
                )}
                {(outreach?.byIndustry || []).length > 0 && (
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-slate-400">업종별 전달 현황</p>
                    <div className="space-y-1.5">
                      {outreach.byIndustry.map((r) => {
                        const total = num(r.sent) + num(r.pending) + num(r.meeting) + num(r.bounced)
                        const seg = (v, cls) => (num(v) > 0 ? <div className={cls} style={{ width: `${(num(v) / Math.max(1, total)) * 100}%` }} /> : null)
                        return (
                          <div key={r.label}>
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="truncate font-bold text-slate-200">{r.label}</span>
                              <span className="shrink-0 text-slate-400">
                                발송 {num(r.sent)}{num(r.meeting) ? ` · 미팅 ${num(r.meeting)}` : ''}{num(r.pending) ? ` · 대기 ${num(r.pending)}` : ''}{num(r.bounced) ? ` · 반송 ${num(r.bounced)}` : ''}
                              </span>
                            </div>
                            <div className="mt-0.5 flex h-1.5 overflow-hidden rounded-full bg-slate-800">
                              {seg(r.meeting, 'bg-emerald-400')}{seg(r.sent, 'bg-sky-400')}{seg(r.pending, 'bg-slate-500')}{seg(r.bounced, 'bg-rose-400')}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-slate-500">
                      <span className="text-emerald-400">■</span> 미팅 <span className="ml-1 text-sky-400">■</span> 발송 <span className="ml-1 text-slate-400">■</span> 대기 <span className="ml-1 text-rose-400">■</span> 반송
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[12px] font-bold text-slate-400">다가오는 마감</p>
                  {(ops.deadlines || []).map((d) => {
                    const left = dday(d.date)
                    return (
                      <p key={d.name} className="flex items-center gap-2 border-b border-slate-800 py-1.5 text-[12.5px] last:border-b-0">
                        <span className={`w-11 font-black ${left <= 3 ? 'text-rose-400' : left <= 10 ? 'text-amber-400' : 'text-slate-300'}`}>{left >= 0 ? `D-${left}` : '지남'}</span>
                        <span className="truncate text-slate-200">{d.name}</span>
                      </p>
                    )
                  })}
                </div>
                {(ops.prs || []).length > 0 && (
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-slate-400">병합 대기 PR</p>
                    {ops.prs.map((p) => (
                      <a key={p.number} href={p.url} target="_blank" rel="noreferrer" className="block truncate py-1 text-[12.5px] text-sky-300 hover:underline">#{p.number} {p.title}</a>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-[12px] font-bold text-slate-400">시간대별 제안 메일 발송 (오늘)</p>
                <div className="h-48">
                  <Bar data={{ labels: Array.from({ length: 24 }, (_, h) => `${h}시`),
                    datasets: [{ label: '발송', data: outreach?.hourly || [], backgroundColor: '#38bdf8', borderRadius: 3 }] }}
                    options={{ ...axisOptions(), plugins: { legend: { display: false } } }} />
                </div>
                {outreach?.segments && (
                  <div className="mt-3 h-40">
                    <Doughnut data={{ labels: Object.keys(outreach.segments),
                      datasets: [{ data: Object.values(outreach.segments), backgroundColor: ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#64748b'], borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, animation: false, cutout: '60%',
                        plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 11 } } } } }} />
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-[12px] font-bold text-slate-400">최근 발송</p>
                {(outreach?.recent || []).slice(0, 12).map((r, idx) => (
                  <p key={idx} className="flex items-center gap-2 border-b border-slate-800 py-1.5 text-[12.5px] last:border-b-0">
                    <span className="w-11 font-mono text-slate-500">{r.time}</span>
                    <span className="flex-1 truncate text-slate-200">{r.brand}</span>
                    <span className={r.ok ? 'text-emerald-400' : 'text-rose-400'}>{r.ok ? '발송' : '실패'}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {!failed(stock) && (stock.outOfStock || []).length > 0 && (
          <Panel title={`품절 상품 (${stock.outOfStock.length}${stock.outOfStock.length >= 20 ? '+' : ''})`}>
            <div className="flex flex-wrap gap-1.5">
              {stock.outOfStock.map((p) => (
                <span key={p.sku_cd} className="max-w-[320px] truncate rounded-lg bg-slate-800/70 px-2 py-1 text-[11.5px] text-slate-300">{p.product_name}</span>
              ))}
            </div>
          </Panel>
        )}

        {!failed(stock) && (stock.belowSafeStock || []).length > 0 && (
          <Panel title="안전재고 미만 상품">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {stock.belowSafeStock.map((p) => (
                <div key={p.sku_cd} className="rounded-xl bg-slate-800/60 px-3 py-2">
                  <p className="truncate text-[12.5px] font-bold text-slate-100">{p.product_name}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (num(p.real_stock) / Math.max(1, num(p.safe_stock))) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">재고 {num(p.real_stock)} / 안전재고 {num(p.safe_stock)}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
