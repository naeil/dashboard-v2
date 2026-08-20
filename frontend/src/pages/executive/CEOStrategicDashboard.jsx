import { useEffect, useState } from 'react'
import { getExecutiveMonthlySales } from '../../api/executiveApi'
import {
  getCfoSummary,
  getCfoCashflowForecast,
  getCfoAlerts,
  getCfoReceivablesPayables,
} from '../../api/cfoApi'
import { EmptyState, PageHeader } from './ExecutiveComponents'
import { won } from './formatters'

// 검증된 차트 팔레트 (dataviz 6-checks 통과: 인접 CVD ΔE 9.1+)
const SERIES_BRAND = '#2a78d6'
const SERIES_PROJECT = '#eb6834'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const fmtWon = (value) => (value == null ? '데이터 없음' : won(value))
const fmtMan = (value) => {
  if (value == null) return '—'
  const man = Math.round(Number(value) / 10000)
  return `${man.toLocaleString('ko-KR')}만`
}

function Badge({ tone = 'gray', children }) {
  const tones = {
    gray: 'border-slate-200 bg-slate-50 text-slate-600',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    bad: 'border-rose-200 bg-rose-50 text-rose-700',
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Card({ title, sub, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-slate-900">
            {title} {sub && <span className="ml-1 text-[11px] font-bold text-slate-400">{sub}</span>}
          </h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

function KpiTile({ label, value, sub, badge, badgeTone = 'gray', valueClassName = 'text-slate-950' }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-black text-slate-500">{label}</p>
        {badge && <Badge tone={badgeTone}>{badge}</Badge>}
      </div>
      <p className={`mt-2 text-xl font-black tracking-tight ${valueClassName}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] font-bold text-slate-400">{sub}</p>}
    </article>
  )
}

// ── 자금 캘린더: 향후 14일 중 현금이 움직이는 날 ──────────────
function CashCalendar({ weeks }) {
  const events = []
  for (const week of (weeks || []).slice(0, 3)) {
    for (const item of week.items || []) {
      events.push(item)
    }
  }
  const byDate = new Map()
  const horizon = new Date(Date.now() + 14 * 86400000)
  for (const event of events) {
    const date = new Date(event.flow_date)
    if (date > horizon) continue
    const key = String(event.flow_date)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(event)
  }
  const days = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 7)

  if (days.length === 0) {
    return <EmptyState message="향후 2주 내 등록된 자금 일정이 없습니다. 현금흐름·반복 고정비를 등록하면 자동 표시됩니다." />
  }
  const todayKey = new Date().toISOString().slice(0, 10)
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
      {days.map(([dateKey, items]) => {
        const date = new Date(dateKey)
        const isToday = dateKey === todayKey
        return (
          <div key={dateKey}
            className={`min-h-[104px] rounded-lg border p-2 ${isToday ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50/50'}`}>
            <p className={`text-[11px] font-black ${isToday ? 'text-sky-600' : 'text-slate-500'}`}>
              {date.getMonth() + 1}/{date.getDate()} {DAY_NAMES[date.getDay()]}{isToday ? ' · 오늘' : ''}
            </p>
            {items.slice(0, 3).map((item, index) => (
              <p key={index}
                title={`${item.counterparty || item.category} ${won(item.amount)}`}
                className={`mt-1 truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  item.flow_type === 'INFLOW' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                {item.flow_type === 'INFLOW' ? '+' : '−'}{fmtMan(item.amount)} {item.counterparty || item.category}
              </p>
            ))}
            {items.length > 3 && <p className="mt-1 text-[10px] font-bold text-slate-400">외 {items.length - 3}건</p>}
          </div>
        )
      })}
    </div>
  )
}

// ── 월별 매출 vs BEP 차트 (브랜드/프로젝트 분리 스택) ──────────
function MonthlyChart({ rows, breakEven }) {
  const recent = (rows || []).slice(-6)
  if (recent.length === 0) {
    return <EmptyState message="월별 매출 데이터가 없습니다. 판매 데이터 수집이 시작되면 자동 표시됩니다." />
  }
  const maxValue = Math.max(
    1,
    ...recent.map((row) => Number(row.sales_amount || 0)),
    Number(breakEven || 0),
  )
  const CHART_H = 170
  const bepY = breakEven != null ? (Number(breakEven) / maxValue) * CHART_H : null

  return (
    <div>
      <div className="relative flex items-end gap-4 px-2" style={{ height: CHART_H + 30 }}>
        {bepY != null && (
          <div className="absolute inset-x-0 z-0 border-t-2 border-dashed" style={{ bottom: bepY + 30, borderColor: SERIES_PROJECT }}>
            <span className="absolute -top-5 right-1 bg-white px-1 text-[10px] font-black" style={{ color: SERIES_PROJECT }}>
              월 BEP {fmtMan(breakEven)} · 현재 고정비/공헌이익률 기준
            </span>
          </div>
        )}
        {recent.map((row) => {
          const brand = Number(row.channel_sales_amount || 0)
          const project = Number(row.consulting_sales_amount || 0)
          const total = brand + project
          const brandH = (brand / maxValue) * CHART_H
          const projectH = (project / maxValue) * CHART_H
          const month = Number(String(row.report_month || '').slice(5, 7))
          return (
            <div key={String(row.report_month)} className="z-10 flex flex-1 flex-col items-center justify-end" style={{ height: CHART_H + 30 }}>
              <span className="mb-1 text-[11px] font-black text-slate-700">{fmtMan(total)}</span>
              <div className="flex w-9 flex-col justify-end overflow-hidden rounded-t"
                title={`${month}월 — 브랜드 ${fmtMan(brand)} · 프로젝트 ${fmtMan(project)}`}>
                {projectH > 0 && <div style={{ height: Math.max(projectH, 2), background: SERIES_PROJECT, marginBottom: brandH > 0 ? 2 : 0 }} />}
                {brandH > 0 && <div style={{ height: Math.max(brandH, 2), background: SERIES_BRAND }} />}
              </div>
              <span className="mt-1.5 text-[11px] font-bold text-slate-500">{month}월</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-bold text-slate-500">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: SERIES_BRAND }} />브랜드(채널) 매출</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: SERIES_PROJECT }} />프로젝트(컨설팅·OEM)</span>
        {bepY != null && <span><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: SERIES_PROJECT }} />손익분기점</span>}
      </div>
      <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
        핵심 질문: 이번 달 매출이 손익분기 위인가 아래인가. 브랜드 반복 매출과 프로젝트성 매출은 분리해서 봅니다.
      </p>
    </div>
  )
}

// ── 받을 돈 / 줄 돈 ───────────────────────────────────────────
function MoneyTable({ data }) {
  const receivables = (data?.receivables || []).slice(0, 4)
  const payables = (data?.payables || []).slice(0, 4)
  if (receivables.length === 0 && payables.length === 0) {
    return <EmptyState message="등록된 미수금·미지급금이 없습니다. 거래처별로 등록하면 회수 일정과 연체 경보가 자동으로 관리됩니다." />
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-black text-slate-400">
            <th className="px-2 py-2">구분</th><th className="px-2 py-2">거래처</th>
            <th className="px-2 py-2 text-right">잔액</th><th className="px-2 py-2">기한</th>
          </tr>
        </thead>
        <tbody>
          {receivables.map((row, index) => (
            <tr key={`r-${row.id}`} className="border-b border-slate-100 text-sm font-bold text-slate-700">
              <td className="px-2 py-2 text-emerald-700">{index === 0 ? '받을 돈' : ''}</td>
              <td className="px-2 py-2">{row.partner_name}</td>
              <td className="px-2 py-2 text-right font-black">{won(row.outstanding)}</td>
              <td className="px-2 py-2 text-[11px]">{Number(row.days_overdue) > 0
                ? <Badge tone="bad">연체 {row.days_overdue}일</Badge>
                : <span className="text-slate-400">{String(row.due_date)}</span>}</td>
            </tr>
          ))}
          {receivables.length > 0 && (
            <tr className="border-b border-slate-200 bg-slate-50 text-sm font-black">
              <td className="px-2 py-2" colSpan={2}>미수금 합계</td>
              <td className="px-2 py-2 text-right">{fmtWon(data?.totalReceivable)}</td><td />
            </tr>
          )}
          {payables.map((row, index) => (
            <tr key={`p-${row.id}`} className="border-b border-slate-100 text-sm font-bold text-slate-700">
              <td className="px-2 py-2 text-rose-700">{index === 0 ? '줄 돈' : ''}</td>
              <td className="px-2 py-2">{row.partner_name}</td>
              <td className="px-2 py-2 text-right font-black">{won(row.amount)}</td>
              <td className="px-2 py-2 text-[11px] text-slate-400">{String(row.due_date || '')}</td>
            </tr>
          ))}
          {payables.length > 0 && (
            <tr className="bg-slate-50 text-sm font-black">
              <td className="px-2 py-2" colSpan={2}>미지급 합계</td>
              <td className="px-2 py-2 text-right">{fmtWon(data?.totalPayable)}</td><td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function CEOStrategicDashboard() {
  const [summary, setSummary] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [money, setMoney] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCfoSummary().then((res) => setSummary(res.data)).catch((e) => setError(e?.response?.data?.message || e.message))
    getCfoCashflowForecast().then((res) => setForecast(res.data)).catch(() => setForecast({ weeks: [] }))
    getCfoAlerts().then((res) => setAlerts(res.data)).catch(() => setAlerts({ alerts: [] }))
    getCfoReceivablesPayables().then((res) => setMoney(res.data)).catch(() => setMoney(null))
    getExecutiveMonthlySales().then((res) => setMonthly(res.data)).catch(() => setMonthly([]))
  }, [])

  const cur = summary?.current || {}
  const cash = summary?.cash || {}
  const runway = cash.runwayMonths
  const alertList = alerts?.alerts || []
  const severityStyle = {
    CRITICAL: { box: 'bg-rose-50 text-rose-800', label: '심각', tone: 'bad' },
    WARNING: { box: 'bg-amber-50 text-amber-800', label: '주의', tone: 'warn' },
    OPPORTUNITY: { box: 'bg-emerald-50 text-emerald-800', label: '기회', tone: 'good' },
  }

  return (
    <div>
      <PageHeader
        title="CEO 전략 대시보드"
        description="오늘의 자금 일정 · 손익분기 대비 매출 · 받을 돈과 줄 돈. 추정치와 확정치는 배지로 구분됩니다."
      />
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="이번 주 자금·세무 일정" sub="현금이 움직이는 날만 표시">
          {forecast ? <CashCalendar weeks={forecast.weeks} /> : <EmptyState message="불러오는 중..." />}
        </Card>
        <Card title="재무 경보" sub="시스템 자동 감지">
          {alerts && alertList.length === 0 && <EmptyState message="현재 활성화된 경보가 없습니다." />}
          <div className="space-y-2">
            {alertList.slice(0, 4).map((alert) => {
              const style = severityStyle[alert.severity] || severityStyle.WARNING
              return (
                <div key={alert.id} className={`flex items-start gap-2 rounded-lg p-2.5 text-[12px] font-bold ${style.box}`}>
                  <Badge tone={style.tone}>{style.label}</Badge>
                  <span className="min-w-0">{alert.title}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title="월별 매출 vs 손익분기점" sub="브랜드/프로젝트 분리 · 최근 6개월">
          <MonthlyChart rows={monthly} breakEven={summary?.breakEvenRevenue} />
        </Card>
        <Card title="받을 돈 / 줄 돈" sub="거래처별 · 연체 자동 표시">
          <MoneyTable data={money} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="현금성 자금" value={fmtWon(cash.totalBalance)}
          badge={cash.asOfDate ? `${cash.asOfDate} 기준` : '미등록'} badgeTone={cash.asOfDate ? 'gray' : 'warn'}
          sub="계좌 잔액 수기 등록 기준" />
        <KpiTile label="월 고정비" value={fmtWon(summary?.monthlyFixedCost)} badge="등록 기준"
          sub="반복 고정비 + 운영비(고정)" />
        <KpiTile label="이번 달 영업이익" value={fmtWon(cur.operatingProfit)}
          valueClassName={Number(cur.operatingProfit) < 0 ? 'text-rose-600' : 'text-slate-950'}
          badge={cur.costCoveragePct != null && Number(cur.costCoveragePct) < 90 ? '원가 일부 미등록' : '추정'}
          badgeTone="warn"
          sub={`원가 매칭 ${cur.costCoveragePct == null ? '—' : Number(cur.costCoveragePct).toFixed(0) + '%'}`} />
        <KpiTile label="현금 런웨이"
          value={runway === 'NO_BURN' ? '소진 없음' : runway == null ? '데이터 없음' : `${runway}개월`}
          valueClassName={runway !== 'NO_BURN' && runway != null && Number(runway) < 3 ? 'text-rose-600' : 'text-slate-950'}
          badge="추정" badgeTone="warn" sub="최근 3개월 순현금유출 기준" />
        <KpiTile label="차입금" value={fmtWon(summary?.debt?.total_debt)} badge="확정"
          sub={`월 이자 추정 ${fmtWon(summary?.debt?.monthly_interest)}`} />
        <KpiTile label="미수금" value={fmtWon(summary?.receivable)} badge="회수 관리" badgeTone="warn"
          sub="회수 시 런웨이 연장 — 가장 싼 자금" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="CFO 자동 브리핑" sub="규칙 기반 · 조회 시점 생성">
          {(summary?.briefing || []).length === 0
            ? <EmptyState message="데이터가 쌓이면 브리핑이 자동 생성됩니다." />
            : (
              <ul>
                {summary.briefing.map((line, index) => (
                  <li key={index} className="border-b border-slate-100 py-2 text-[13px] font-bold text-slate-600 last:border-0">
                    {line}
                  </li>
                ))}
              </ul>
            )}
        </Card>
        <Card title="대표 결정 대기" sub="시스템이 올린 안건">
          {alertList.filter((alert) => alert.recommendation).length === 0
            ? <EmptyState message="대기 중인 안건이 없습니다." />
            : (
              <ul>
                {alertList.filter((alert) => alert.recommendation).slice(0, 5).map((alert) => (
                  <li key={alert.id} className="border-b border-slate-100 py-2 text-[13px] font-bold text-slate-600 last:border-0">
                    <span className="text-slate-900">{alert.title}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-sky-700">→ {alert.recommendation}</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>
    </div>
  )
}
