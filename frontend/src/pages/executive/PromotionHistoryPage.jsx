import { useEffect, useMemo, useState } from 'react'
import { getExecutiveChannelSalesAnalytics, importPlayAutoChannelSales } from '../../api/executiveApi'

const STORAGE_KEY = 'naeil.promotionMarginPlans'

const today = new Date()
const toDateInput = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const firstDay = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
const todayText = toDateInput(today)

const channelTabs = ['전체', '온라인', '국내 오프라인', '해외 수출', 'B2B/납품']
const won = (value) => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`
const count = (value) => Number(value || 0).toLocaleString('ko-KR')
const pct = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '-'
const num = (value) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function loadPlans() {
  try {
    const rows = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function savePlans(rows) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function includesAny(haystack, values) {
  const target = String(haystack || '').toLowerCase()
  return values.filter(Boolean).some((value) => target.includes(String(value).toLowerCase()))
}

function matchSales(plan, products) {
  const needles = [plan.productName, plan.productCode, plan.skuCode]
  return (products || []).find((row) => {
    const haystack = [
      row.product_name,
      row.productName,
      row.option_name,
      row.optionName,
      row.product_code,
      row.sku_code,
    ].filter(Boolean).join(' ')
    return includesAny(haystack, needles)
  })
}

function liveValues(plan, analytics) {
  const matched = matchSales(plan, analytics.products || [])
  const liveSales = num(matched?.sales_amount)
  const directProfit = matched?.has_actual_cost ? matched?.actual_operating_profit : matched?.estimated_operating_profit
  const fallbackProfit = liveSales * (num(plan.operatingMargin) / 100)
  const liveOperatingProfit = matched ? num(directProfit ?? fallbackProfit) : fallbackProfit
  const targetRevenue = num(plan.targetRevenue || plan.revenue)
  const achievement = targetRevenue > 0 ? (liveSales / targetRevenue) * 100 : 0
  return {
    matched,
    liveSales,
    liveOrders: num(matched?.order_count),
    liveOperatingProfit,
    targetRevenue,
    achievement,
  }
}

function toneClass(value) {
  if (num(value) > 0) return 'text-blue-700'
  if (num(value) < 0) return 'text-rose-600'
  return 'text-slate-950'
}

function StatusBadge({ value }) {
  const text = value || '신청'
  const className = text.includes('손실')
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : text.includes('조건')
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-blue-200 bg-blue-50 text-blue-700'
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${className}`}>{text}</span>
}

export default function PromotionHistoryPage() {
  const [plans, setPlans] = useState([])
  const [analytics, setAnalytics] = useState({ summary: {}, products: [] })
  const [activeChannel, setActiveChannel] = useState('전체')
  const [startDate, setStartDate] = useState(firstDay)
  const [endDate, setEndDate] = useState(todayText)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setPlans(loadPlans())
    try {
      const res = await getExecutiveChannelSalesAnalytics({ startDate, endDate })
      setAnalytics(res.data || { summary: {}, products: [] })
    } catch (err) {
      setMessage(err?.response?.data?.message || '프로모션 실시간 데이터를 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const refreshSales = async () => {
    setSyncing(true)
    setMessage('')
    try {
      await importPlayAutoChannelSales({ startDate, endDate })
      await load()
      setMessage('프로모션 내역의 실시간 매출과 영업이익을 갱신했습니다.')
    } catch (err) {
      setMessage(err?.response?.data?.message || '실시간 판매 현황 갱신에 실패했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  const visiblePlans = useMemo(() => {
    const rows = activeChannel === '전체' ? plans : plans.filter((plan) => plan.channel === activeChannel)
    return rows.map((plan) => ({ ...plan, live: liveValues(plan, analytics) }))
  }, [plans, activeChannel, analytics])

  const channelSummary = useMemo(() => {
    const base = channelTabs.slice(1).map((channel) => ({ channel, count: 0, target: 0, liveSales: 0, liveProfit: 0 }))
    const byChannel = new Map(base.map((row) => [row.channel, row]))
    plans.forEach((plan) => {
      const row = byChannel.get(plan.channel) || byChannel.get('온라인')
      const live = liveValues(plan, analytics)
      row.count += 1
      row.target += live.targetRevenue
      row.liveSales += live.liveSales
      row.liveProfit += live.liveOperatingProfit
    })
    return Array.from(byChannel.values())
  }, [plans, analytics])

  const total = useMemo(() => visiblePlans.reduce((acc, plan) => {
    acc.count += 1
    acc.target += plan.live.targetRevenue
    acc.liveSales += plan.live.liveSales
    acc.liveProfit += plan.live.liveOperatingProfit
    return acc
  }, { count: 0, target: 0, liveSales: 0, liveProfit: 0 }), [visiblePlans])

  const deletePlan = (id) => {
    const next = plans.filter((plan) => plan.id !== id)
    setPlans(next)
    savePlans(next)
  }

  return (
    <div className="space-y-6 bg-slate-50 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">프로모션 내역</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">
            프로모션 마진에서 저장한 신청 내역을 채널별로 보고, 목표 매출 대비 실시간 매출과 영업이익을 바로 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded border border-slate-300 px-3 text-sm font-black" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded border border-slate-300 px-3 text-sm font-black" />
          <button onClick={load} className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700">조회</button>
          <button onClick={refreshSales} disabled={syncing} className="h-10 rounded bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50">
            {syncing ? '갱신 중' : '실시간 매출 업데이트'}
          </button>
        </div>
      </header>

      {message && <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">{message}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">신청 프로모션</p>
          <strong className="mt-4 block text-2xl font-black">{count(total.count)}건</strong>
          <p className="mt-2 text-xs font-bold text-slate-500">선택 채널 기준</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">목표 매출</p>
          <strong className="mt-4 block text-2xl font-black">{won(total.target)}</strong>
          <p className="mt-2 text-xs font-bold text-slate-500">서식 저장 목표 합계</p>
        </div>
        <div className="rounded border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <p className="text-xs font-black text-blue-700">실시간 매출</p>
          <strong className="mt-4 block text-2xl font-black text-blue-700">{won(total.liveSales)}</strong>
          <p className="mt-2 text-xs font-bold text-blue-600">목표 대비 {pct(total.target > 0 ? (total.liveSales / total.target) * 100 : 0)}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">실시간 영업이익</p>
          <strong className={`mt-4 block text-2xl font-black ${toneClass(total.liveProfit)}`}>{won(total.liveProfit)}</strong>
          <p className="mt-2 text-xs font-bold text-slate-500">매칭 데이터 기준</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {channelSummary.map((row) => (
          <button
            key={row.channel}
            onClick={() => setActiveChannel(row.channel)}
            className={`rounded border p-4 text-left shadow-sm ${activeChannel === row.channel ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}
          >
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
            {channelTabs.map((channel) => (
              <button
                key={channel}
                onClick={() => setActiveChannel(channel)}
                className={`rounded-full border px-4 py-2 text-xs font-black ${activeChannel === channel ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-black text-slate-500">
                <th className="p-3">프로모션</th>
                <th className="p-3">채널</th>
                <th className="p-3">기간</th>
                <th className="p-3 text-right">목표 매출</th>
                <th className="p-3 text-right">실시간 매출</th>
                <th className="p-3 text-right">달성률</th>
                <th className="p-3 text-right">실시간 영업이익</th>
                <th className="p-3">상태</th>
                <th className="p-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {visiblePlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">저장된 프로모션 신청 내역이 없습니다.</td>
                </tr>
              ) : visiblePlans.map((plan) => (
                <tr key={plan.id} className="border-b border-slate-100 align-top">
                  <td className="p-3">
                    <b className="block text-slate-950">{plan.promoName}</b>
                    <span className="mt-1 block text-xs text-slate-500">{plan.productName} · {plan.promoType}</span>
                  </td>
                  <td className="p-3">{plan.channel || '-'}</td>
                  <td className="p-3 text-xs text-slate-500">{plan.startDate || '-'} ~ {plan.endDate || '-'}</td>
                  <td className="p-3 text-right">{won(plan.live.targetRevenue)}</td>
                  <td className="p-3 text-right text-blue-700">{won(plan.live.liveSales)}</td>
                  <td className="p-3 text-right">{pct(plan.live.achievement)}</td>
                  <td className={`p-3 text-right ${toneClass(plan.live.liveOperatingProfit)}`}>{won(plan.live.liveOperatingProfit)}</td>
                  <td className="p-3"><StatusBadge value={plan.decision} /></td>
                  <td className="p-3 text-right">
                    <button onClick={() => deletePlan(plan.id)} className="rounded border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-600">삭제</button>
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
