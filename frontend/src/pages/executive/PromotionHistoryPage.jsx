import { useEffect, useMemo, useState } from 'react'
import { getExecutiveChannelSalesAnalytics, importPlayAutoChannelSales } from '../../api/executiveApi'
import { getPromotionHistory } from '../../api/promotionMarginApi'

const today = new Date()
const toDateInput = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const firstDay = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
const todayText = toDateInput(today)

const channelTabs = ['전체', '스마트스토어', '쿠팡', '카카오쇼핑', '자사몰', '오프라인 행사', '국내 오프라인 유통', '해외 수출', 'B2B/납품', '기타']
const won = (value) => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`
const count = (value) => Number(value || 0).toLocaleString('ko-KR')
const pct = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '-'
const num = (value) => { const p = Number(String(value ?? 0).replace(/,/g, '')); return Number.isFinite(p) ? p : 0 }
const channelOptions = ['스마트스토어', '쿠팡', '카카오쇼핑', '자사몰', '오프라인 행사', '국내 오프라인 유통', '해외 수출', 'B2B/납품', '기타']

function toneClass(v) { return num(v) > 0 ? 'text-blue-700' : num(v) < 0 ? 'text-rose-600' : 'text-slate-950' }
function StatusBadge({ value }) {
  const t = value || '신청'
  const c = t.includes('손실') ? 'border-rose-200 bg-rose-50 text-rose-700' : t.includes('조건') ? 'border-amber-200 bg-amber-50 text-amber-700' : t.includes('완료') ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${c}`}>{t}</span>
}

// fix: show all promotion records across users
export default function PromotionHistoryPage() {
  const [plans, setPlans] = useState([])
  const [activeChannel, setActiveChannel] = useState('전체')
  const [startDate, setStartDate] = useState(firstDay)
  const [endDate, setEndDate] = useState(todayText)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true); setMessage('')
    try {
      const historyRes = await getPromotionHistory(1, null)
      const allItems = []
      if (Array.isArray(historyRes)) {
        historyRes.forEach(ch => {
          if (Array.isArray(ch.items)) {
            ch.items.forEach(item => {
              allItems.push({
                id: String(item.id),
                createdAt: item.createdAt || item.submitted_at,
                createdBy: item.createdByName || item.createdBy || '-',
                productName: item.productName || item.product_name || '-',
                channel: item.channel,
                promoName: item.promoName || item.promo_name || '-',
                promoType: item.promotionType || '-',
                startDate: item.promoStartDate || item.promo_start_date,
                endDate: item.promoEndDate || item.promo_end_date,
                targetRevenue: num(item.targetRevenue || item.target_revenue),
                expectedOrders: num(item.targetQty || item.target_qty),
                operatingProfit: num(item.targetOperatingProfit || item.target_operating_profit),
                actualRevenue: num(item.actualRevenue || item.actual_revenue),
                actualOperatingProfit: num(item.actualOperatingProfit || item.actual_operating_profit),
                status: item.status || '신청',
              })
            })
          }
        })
      }
      setPlans(allItems)
    } catch (err) { setMessage(err?.message || '데이터를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const refreshSales = async () => {
    setSyncing(true)
    try { await importPlayAutoChannelSales({ startDate, endDate }); await load(); setMessage('갱신 완료') }
    catch (err) { setMessage(err?.message || '갱신 실패') }
    finally { setSyncing(false) }
  }

  const visiblePlans = useMemo(() => activeChannel === '전체' ? plans : plans.filter(p => p.channel === activeChannel), [plans, activeChannel])
  const channelSummary = useMemo(() => {
    const base = channelTabs.slice(1).map(ch => ({ channel: ch, count: 0, target: 0, liveSales: 0, liveProfit: 0 }))
    const byChannel = new Map(base.map(r => [r.channel, r]))
    plans.forEach(p => { const r = byChannel.get(p.channel); if (r) { r.count++; r.target += p.targetRevenue; r.liveSales += p.actualRevenue; r.liveProfit += p.actualOperatingProfit } })
    return Array.from(byChannel.values())
  }, [plans])
  const total = useMemo(() => visiblePlans.reduce((a, p) => ({ count: a.count + 1, target: a.target + p.targetRevenue, liveSales: a.liveSales + p.actualRevenue, liveProfit: a.liveProfit + p.actualOperatingProfit }), { count: 0, target: 0, liveSales: 0, liveProfit: 0 }), [visiblePlans])

  const canEdit = (plan) => {
    try {
      const s = JSON.parse(window.localStorage.getItem('naeil.session') || '{}')
      const role = s.role || ''
      const user = s.username || s.name || null
      return role === 'admin' || role === 'owner' || role === 'EXECUTIVE' || plan.createdBy === user
    } catch { return true }
  }

  const fd = (d) => d ? String(d).substring(0, 10) : '-'

  return (
    <div className="space-y-6 bg-slate-50 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">프로모션 내역</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">프로모션 마진에서 저장한 신청 내역을 채널별로 보고, 목표 매출 대비 실시간 매출과 영업이익을 바로 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 rounded border border-slate-300 px-3 text-sm font-black" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 rounded border border-slate-300 px-3 text-sm font-black" />
          <button onClick={load} className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700">조회</button>
          <button onClick={refreshSales} disabled={syncing} className="h-10 rounded bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50">{syncing ? '갱신 중' : '실시간 매출 업데이트'}</button>
        </div>
      </header>
      {message && <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">{message}</div>}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">신청 프로모션</p><strong className="mt-4 block text-2xl font-black">{count(total.count)}건</strong><p className="mt-2 text-xs font-bold text-slate-500">선택 채널 기준</p></div>
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">목표 매출</p><strong className="mt-4 block text-2xl font-black">{won(total.target)}</strong><p className="mt-2 text-xs font-bold text-slate-500">서식 저장 목표 합계</p></div>
        <div className="rounded border border-blue-200 bg-blue-50 p-5 shadow-sm"><p className="text-xs font-black text-blue-700">실시간 매출</p><strong className="mt-4 block text-2xl font-black text-blue-700">{won(total.liveSales)}</strong><p className="mt-2 text-xs font-bold text-blue-600">목표 대비 {pct(total.target > 0 ? (total.liveSales / total.target) * 100 : 0)}</p></div>
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">실시간 영업이익</p><strong className={`mt-4 block text-2xl font-black ${toneClass(total.liveProfit)}`}>{won(total.liveProfit)}</strong><p className="mt-2 text-xs font-bold text-slate-500">매칭 데이터 기준</p></div>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {channelSummary.slice(0, 8).map(row => (
          <button key={row.channel} onClick={() => setActiveChannel(row.channel)} className={`rounded border p-4 text-left shadow-sm ${activeChannel === row.channel ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-sm font-black">{row.channel}</p>
            <div className="mt-3 space-y-1 text-xs font-bold text-slate-600">
              <p className="flex justify-between"><span>신청</span><b>{count(row.count)}건</b></p>
              <p className="flex justify-between"><span>목표</span><b>{won(row.target)}</b></p>
              <p className="flex justify-between"><span>실시간</span><b>{won(row.liveSales)}</b></p>
              <p className="flex justify-between"><span>영업이익</span><b className={toneClass(row.liveProfit)}>{won(row.liveProfit)}</b></p>
            </div>
          </button>
        ))}
      </section>
      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">채널별 프로모션 신청 내역</h2>
          <div className="flex flex-wrap gap-2">
            {channelTabs.map(ch => <button key={ch} onClick={() => setActiveChannel(ch)} className={`rounded-full border px-4 py-2 text-xs font-black ${activeChannel === ch ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{ch}</button>)}
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-black text-slate-500">
                <th className="p-3">등록자</th><th className="p-3">등록일</th><th className="p-3">채널</th>
                <th className="p-3">프로모션명</th><th className="p-3">상품명</th><th className="p-3">기간</th>
                <th className="p-3 text-right">목표 매출</th><th className="p-3 text-right">예상 주문</th>
                <th className="p-3 text-right">예상 영업이익</th><th className="p-3 text-right">실시간 매출</th>
                <th className="p-3 text-right">실시간 영업이익</th><th className="p-3">상태</th><th className="p-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {visiblePlans.length === 0 ? (
                <tr><td colSpan={13} className="p-8 text-center text-slate-500">{loading ? '불러오는 중...' : '저장된 프로모션 신청 내역이 없습니다.'}</td></tr>
              ) : visiblePlans.map(plan => (
                <tr key={plan.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                  <td className="p-3 text-xs text-slate-600">{plan.createdBy || '-'}</td>
                  <td className="p-3 text-xs text-slate-500">{fd(plan.createdAt)}</td>
                  <td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{plan.channel || '-'}</span></td>
                  <td className="p-3"><b className="block text-slate-950">{plan.promoName || '-'}</b><span className="mt-1 block text-xs text-slate-500">{plan.promoType}</span></td>
                  <td className="p-3 text-xs text-slate-700">{plan.productName || '-'}</td>
                  <td className="p-3 text-xs text-slate-500">{fd(plan.startDate)} ~ {fd(plan.endDate)}</td>
                  <td className="p-3 text-right">{won(plan.targetRevenue)}</td>
                  <td className="p-3 text-right">{count(plan.expectedOrders)}건</td>
                  <td className={`p-3 text-right ${toneClass(plan.operatingProfit)}`}>{won(plan.operatingProfit)}</td>
                  <td className="p-3 text-right text-blue-700">{won(plan.actualRevenue)}</td>
                  <td className={`p-3 text-right ${toneClass(plan.actualOperatingProfit)}`}>{won(plan.actualOperatingProfit)}</td>
                  <td className="p-3"><StatusBadge value={plan.status} /></td>
                  <td className="p-3 text-right">
                    {canEdit(plan) && <button className="rounded border border-blue-200 px-3 py-1.5 text-xs font-black text-blue-700 hover:bg-blue-50">수정</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
