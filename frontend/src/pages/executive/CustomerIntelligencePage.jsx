import { useEffect, useMemo, useState } from 'react'
import { getExecutiveCustomerDatabase, syncPlayAutoCustomerDatabase } from '../../api/executiveApi'
import { PageHeader, Panel } from './ExecutiveComponents'

const fmt = (v) => Math.round(Number(v || 0)).toLocaleString('ko-KR')
const won = (v) => fmt(v) + '원'
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

function getGrade(row) {
  if (row.order_count >= 5) return 'VIP'
  if (row.order_count >= 3) return 'GOLD'
  if (row.days_since_last_order >= 90) return 'DORMANT'
  return 'SILVER'
}

const GRADE_STYLE = {
  VIP: 'bg-amber-100 text-amber-800 border-amber-300',
  GOLD: 'bg-blue-100 text-blue-800 border-blue-300',
  SILVER: 'bg-slate-100 text-slate-600 border-slate-300',
  DORMANT: 'bg-rose-100 text-rose-700 border-rose-300',
}

function GradeBadge({ grade }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${GRADE_STYLE[grade]}`}>
      {grade}
    </span>
  )
}

function KpiBox({ label, value, sub, highlight, warn }) {
  const bg = highlight ? 'bg-sky-500 text-white' : warn ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${bg}`}>
      <div className={`mb-1 text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-sky-100' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-2xl font-black leading-none ${highlight ? 'text-white' : warn ? 'text-rose-600' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className={`mt-1 text-[11px] ${highlight ? 'text-sky-100' : 'text-slate-400'}`}>{sub}</div>}
    </div>
  )
}

function FunnelBar({ step, label, count, total, conv, churn, color }) {
  const width = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black ${color}`}>{step}</div>
      <div className="flex-1">
        <div className="mb-1 flex justify-between">
          <span className="text-[12px] font-bold text-slate-700">{label}</span>
          <span className="text-[12px] font-black text-slate-900">{fmt(count)}명</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-sky-400" style={{ width: width + '%' }} />
        </div>
        {conv !== undefined && (
          <div className="mt-1 flex gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">전환 {conv}%</span>
            {churn !== undefined && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">이탈 {churn}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function CohortTable({ rows }) {
  const months = {}
  rows.forEach((r) => {
    if (!r.first_order_at) return
    const m = r.first_order_at.slice(0, 7)
    if (!months[m]) months[m] = { total: 0, r2: 0, r3: 0, r4: 0 }
    months[m].total++
    if (r.order_count >= 2) months[m].r2++
    if (r.order_count >= 3) months[m].r3++
    if (r.order_count >= 4) months[m].r4++
  })
  const sorted = Object.keys(months).sort().slice(-6)
  const heatBg = (p) =>
    p >= 30 ? 'bg-sky-500 text-white' : p >= 20 ? 'bg-sky-300 text-sky-900' : p >= 10 ? 'bg-sky-100 text-sky-700' : 'bg-slate-50 text-slate-400'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {['가입월', '신규', '2차', '3차', '4차'].map((h) => (
              <th key={h} className="border border-slate-100 bg-slate-50 px-2 py-1.5 text-center font-bold text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const c = months[m]
            return (
              <tr key={m}>
                <td className="border border-slate-100 bg-slate-50 px-2 py-1.5 font-bold text-slate-700">{m.replace('-', '년 ')}월</td>
                <td className="border border-slate-100 px-2 py-1.5 text-center font-bold">{c.total}명</td>
                {[{cnt:c.r2,p:pct(c.r2,c.total)},{cnt:c.r3,p:pct(c.r3,c.total)},{cnt:c.r4,p:pct(c.r4,c.total)}].map((col, i) => (
                  <td key={i} className={`border border-slate-100 px-2 py-1.5 text-center ${heatBg(col.p)}`}>
                    {col.cnt > 0 ? <><div className="font-black">{col.p}%</div><div className="text-[9px] opacity-70">{col.cnt}명</div></> : '—'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function CustomerIntelligencePage({ role = 'EXECUTIVE' }) {
  const [data, setData] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const canAccess = role === 'EXECUTIVE' || role === 'MANAGER'

  useEffect(() => {
    if (!canAccess) { setLoading(false); return }
    getExecutiveCustomerDatabase()
      .then((res) => setData(res.data || { summary: {}, rows: [] }))
      .catch(() => setMessage('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [canAccess])

  const rows = data.rows || []
  const summary = data.summary || {}

  const kpis = useMemo(() => {
    const totalRows = rows.length
    const repeatCount = rows.filter((r) => r.order_count >= 2).length
    const repeatRate = pct(repeatCount, totalRows)
    const vip = rows.filter((r) => r.order_count >= 5).length
    const gold = rows.filter((r) => r.order_count >= 3 && r.order_count <= 4).length
    const silver = rows.filter((r) => r.order_count <= 2 && r.days_since_last_order < 90).length
    const dormant = rows.filter((r) => r.days_since_last_order >= 90).length
    const totalAmt = rows.reduce((s, r) => s + Number(r.total_purchase_amount || 0), 0)
    const avgLtv = totalRows ? Math.round(totalAmt / totalRows) : 0
    const totalOrders = Number(summary.total_orders || totalRows)
    const avgOrderAmt = totalOrders ? Math.round(totalAmt / totalOrders) : 0
    const f1 = rows.filter((r) => r.order_count >= 1).length
    const f2 = rows.filter((r) => r.order_count >= 2).length
    const f3 = rows.filter((r) => r.order_count >= 3).length
    const f4 = rows.filter((r) => r.order_count >= 4).length
    const f5 = rows.filter((r) => r.order_count >= 5).length
    const f6 = rows.filter((r) => r.order_count >= 6).length
    const sorted = [...rows].sort((a, b) => Number(b.total_purchase_amount) - Number(a.total_purchase_amount))
    const vipCnt = Math.max(1, Math.ceil(totalRows * 0.1))
    const vipAmt = sorted.slice(0, vipCnt).reduce((s, r) => s + Number(r.total_purchase_amount || 0), 0)
    const vipContrib = totalAmt ? pct(vipAmt, totalAmt) : 0
    const thisMonth = new Date().toISOString().slice(0, 7)
    const newThisMonth = rows.filter((r) => r.first_order_at?.startsWith(thisMonth)).length
    return { totalRows, repeatCount, repeatRate, vip, gold, silver, dormant, avgLtv, avgOrderAmt, f1, f2, f3, f4, f5, f6, vipContrib, totalAmt, newThisMonth }
  }, [rows, summary])

  const filteredRows = useMemo(() => {
    const base = [...rows].sort((a, b) => Number(b.total_purchase_amount) - Number(a.total_purchase_amount))
    return (gradeFilter === 'all' ? base : base.filter((r) => getGrade(r) === gradeFilter)).slice(0, 20)
  }, [rows, gradeFilter])

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setMessage('PlayAuto에서 고객 데이터를 동기화하는 중...')
    try {
      const res = await syncPlayAutoCustomerDatabase()
      setData(res.data || { summary: {}, rows: [] })
      setMessage('PlayAuto 동기화 완료!')
    } catch {
      setMessage('동기화 실패. 연동 설정을 확인해주세요.')
    } finally {
      setSyncing(false)
    }
  }

  if (!canAccess) return <Panel title="접근 권한 없음"><p className="text-sm text-rose-600">임원/관리자만 접근 가능합니다.</p></Panel>

  return (
    <div className="space-y-5 pb-12">
      <PageHeader title="고객 가치 분석 · Customer Intelligence" description="대표가 30초 안에 광고 확대 여부, 집중 상품, 핵심 고객을 판단할 수 있는 경영 의사결정 시스템">
        <button onClick={handleSync} disabled={syncing || loading} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50">
          <span className="material-symbols-outlined text-base">{syncing ? 'sync' : 'cloud_sync'}</span>
          {syncing ? '동기화 중...' : 'PlayAuto 동기화'}
        </button>
      </PageHeader>

      {message && <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">{message}</div>}

      {loading ? (
        <div className="py-20 text-center text-slate-400">불러오는 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KpiBox label="총 고객 수 (플레이오토)" value={fmt(kpis.totalRows) + '명'} sub="전체 누적 구매자" />
            <KpiBox label="신규 고객 (이번달)" value={fmt(kpis.newThisMonth) + '명'} sub="이번달 첫 구매" />
            <KpiBox label="재구매율" value={kpis.repeatRate + '%'} sub="2차 구매 전환 기준" highlight />
            <KpiBox label="고객 평균 LTV" value={won(kpis.avgLtv)} sub="1인당 평균 구매액" highlight />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiBox label="평균 주문 단가" value={won(kpis.avgOrderAmt)} sub="주문 1건 평균" />
            <KpiBox label="누적 총 매출" value={won(kpis.totalAmt)} sub="플레이오토 전체 기간" />
            <KpiBox label="VIP 고객 (5회+)" value={fmt(kpis.vip) + '명'} sub={'상위 10% · 매출 ' + kpis.vipContrib + '% 기여'} />
            <KpiBox label="휴면 고객 (90일+)" value={fmt(kpis.dormant) + '명'} sub={'잠재 매출 ' + won(kpis.dormant * kpis.avgLtv)} warn />
          </div>

          <div className="rounded-xl bg-slate-900 p-5">
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">CEO DECISION · 광고를 더 해야 하는가?</div>
            <div className="mt-3 grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-sky-500/20 p-3 text-center"><div className="text-2xl font-black text-sky-300">{kpis.repeatRate}%</div><div className="mt-1 text-[10px] text-slate-400">재구매율</div></div>
              <div className="rounded-lg bg-emerald-500/20 p-3 text-center"><div className="text-2xl font-black text-emerald-300">{won(kpis.avgLtv)}</div><div className="mt-1 text-[10px] text-slate-400">LTV (생애가치)</div></div>
              <div className="rounded-lg bg-amber-500/20 p-3 text-center"><div className="text-2xl font-black text-amber-300">{kpis.vipContrib}%</div><div className="mt-1 text-[10px] text-slate-400">VIP 매출 기여도</div></div>
              <div className="rounded-lg bg-rose-500/20 p-3 text-center"><div className="text-2xl font-black text-rose-300">{fmt(kpis.dormant)}명</div><div className="mt-1 text-[10px] text-slate-400">휴면 · 잠재 {won(kpis.dormant * kpis.avgLtv)}</div></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-black text-slate-900">고객 퍼널 — 구매 단계별 전환율</div>
              <FunnelBar step="1" label="1차 구매 (신규)" count={kpis.f1} total={kpis.f1} color="bg-sky-100 text-sky-600" />
              <FunnelBar step="2" label="2차 구매" count={kpis.f2} total={kpis.f1} conv={pct(kpis.f2,kpis.f1)} churn={100-pct(kpis.f2,kpis.f1)} color="bg-blue-100 text-blue-600" />
              <FunnelBar step="3" label="3차 구매" count={kpis.f3} total={kpis.f1} conv={pct(kpis.f3,kpis.f2)} churn={100-pct(kpis.f3,kpis.f2)} color="bg-violet-100 text-violet-600" />
              <FunnelBar step="4" label="4차 구매" count={kpis.f4} total={kpis.f1} conv={pct(kpis.f4,kpis.f3)} churn={100-pct(kpis.f4,kpis.f3)} color="bg-pink-100 text-pink-600" />
              <FunnelBar step="5" label="5차 구매" count={kpis.f5} total={kpis.f1} conv={pct(kpis.f5,kpis.f4)} color="bg-emerald-100 text-emerald-600" />
              <FunnelBar step="6+" label="6차+ (충성 고객)" count={kpis.f6} total={kpis.f1} color="bg-amber-100 text-amber-600" />
              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-700">
                핵심 이탈: 1차→2차 전환 {pct(kpis.f2,kpis.f1)}% / 이탈 {100-pct(kpis.f2,kpis.f1)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-black text-slate-900">코호트 분석 — 월별 재구매율 히트맵</div>
              <CohortTable rows={rows} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-black text-slate-900">고객 등급 자동 분류</div>
            <div className="grid grid-cols-4 gap-3">
              {[{grade:'VIP',icon:'👑',count:kpis.vip,desc:'5회+ 구매',bg:'bg-amber-50 border-amber-200'},{grade:'GOLD',icon:'⭐',count:kpis.gold,desc:'3~4회 구매',bg:'bg-blue-50 border-blue-200'},{grade:'SILVER',icon:'🥈',count:kpis.silver,desc:'1~2회 구매',bg:'bg-slate-50 border-slate-200'},{grade:'DORMANT',icon:'💤',count:kpis.dormant,desc:'90일+ 미구매',bg:'bg-rose-50 border-rose-200'}].map(({grade,icon,count,desc,bg})=>(
                <div key={grade} className={`rounded-xl border p-4 text-center ${bg}`}>
                  <div className="text-2xl">{icon}</div>
                  <div className="mt-1 text-xs font-black text-slate-600">{grade}</div>
                  <div className="text-2xl font-black text-slate-900">{fmt(count)}</div>
                  <div className="text-[10px] text-slate-400">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <span className="text-sm font-black text-slate-900">고객별 가치 분석 (상위 20명 · 실제 플레이오토 데이터)</span>
              <div className="flex gap-1 rounded-lg bg-slate-50 p-1">
                {['all','VIP','GOLD','DORMANT'].map((g)=>(
                  <button key={g} onClick={()=>setGradeFilter(g)} className={`rounded-md px-3 py-1 text-xs font-bold transition ${gradeFilter===g?'bg-white shadow text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
                    {g==='all'?'전체':g}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-left">{['고객명','등급','구매횟수','총구매액','평균주문','첫구매','최근구매','경과일'].map(h=><th key={h} className="px-4 py-2.5 font-bold text-slate-500">{h}</th>)}</tr></thead>
                <tbody>
                  {filteredRows.map((row,i)=>{
                    const grade=getGrade(row)
                    const name=row.customer_name?row.customer_name.slice(0,1)+'**':'***'
                    return(
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{name}</td>
                        <td className="px-4 py-2.5"><GradeBadge grade={grade}/></td>
                        <td className="px-4 py-2.5 text-center">{row.order_count}회</td>
                        <td className="px-4 py-2.5 font-bold">{won(row.total_purchase_amount)}</td>
                        <td className="px-4 py-2.5">{won(Math.round(row.total_purchase_amount/row.order_count))}</td>
                        <td className="px-4 py-2.5 text-slate-500">{row.first_order_at?.slice(0,10)??'-'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{row.last_order_at?.slice(0,10)??'-'}</td>
                        <td className={`px-4 py-2.5 font-bold ${row.days_since_last_order>=90?'text-rose-600':'text-slate-600'}`}>{row.days_since_last_order}일</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
      }
