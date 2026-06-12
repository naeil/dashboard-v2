import { useEffect, useMemo, useState } from 'react'
import { getAllCostData } from '../../api/productCostApi'
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

const won = (value) => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`
const count = (value) => Number(value || 0).toLocaleString('ko-KR')
const pct = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '-'
const num = (value) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}
const rate = (value) => num(value) / 100

const promoTypes = [
  { id: 'discount', label: '할인' },
  { id: 'onePlusOne', label: '1+1' },
  { id: 'bundle', label: '묶음 구성' },
  { id: 'coupon', label: '쿠폰' },
  { id: 'offlineEvent', label: '오프라인 행사' },
]

const channelOptions = ['온라인', '국내 오프라인', '해외 수출', 'B2B/납품']

function flattenCostRows(data) {
  return Object.entries(data?.channels || {}).flatMap(([channelName, rows]) =>
    (rows || []).map((row, index) => ({
      ...row,
      channelName,
      rowKey: `${channelName}-${row.id || row.product_code || row.sku_code || index}`,
    })),
  )
}

function productLabel(row) {
  return [row.product_name, row.qty_per_unit ? `${row.qty_per_unit}입` : '', row.sku_code || row.product_code]
    .filter(Boolean)
    .join(' / ')
}

function matchSalesProduct(costRow, products) {
  if (!costRow) return null
  const names = [costRow.product_name, costRow.product_code, costRow.sku_code].filter(Boolean).map((v) => String(v).toLowerCase())
  return (products || []).find((row) => {
    const haystack = [row.product_name, row.productName, row.option_name, row.optionName, row.product_code, row.sku_code]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return names.some((name) => name && haystack.includes(name))
  })
}

function deriveInitialForm(row) {
  const basePrice = num(row?.consumer_price) || num(row?.list_price)
  return {
    channel: '온라인',
    promoType: 'discount',
    promoName: '',
    expectedOrders: 100,
    unitsPerOrder: 1,
    basePrice,
    promoPrice: basePrice,
    channelFeeRate: Math.round(num(row?.channel_fee_rate) * 1000) / 10,
    marketingRate: Math.round(num(row?.marketing_rate) * 1000) / 10,
    adRate: Math.round(num(row?.ad_rate) * 1000) / 10,
    opexRate: Math.round(num(row?.opex_rate) * 1000) / 10,
    logisticsPerOrder: num(row?.consumer_ship_fee) + num(row?.storage_fee_unit),
    extraSupportPerUnit: 0,
    fixedEventCost: 0,
  }
}

function calculateScenario(row, form) {
  const unitsPerOrder = form.promoType === 'onePlusOne' ? 2 : Math.max(1, num(form.unitsPerOrder))
  const expectedOrders = Math.max(0, num(form.expectedOrders))
  const promoPrice = Math.max(0, num(form.promoPrice))
  const revenue = promoPrice * expectedOrders
  const productionCost = num(row?.production_cost) * unitsPerOrder * expectedOrders
  const logisticsCost = num(form.logisticsPerOrder) * expectedOrders
  const channelFee = revenue * rate(form.channelFeeRate)
  const marketingCost = revenue * rate(form.marketingRate)
  const adCost = revenue * rate(form.adRate)
  const opexCost = revenue * rate(form.opexRate)
  const supportCost = num(form.extraSupportPerUnit) * unitsPerOrder * expectedOrders
  const fixedEventCost = num(form.fixedEventCost)
  const variableCost = productionCost + logisticsCost + channelFee + marketingCost + adCost + opexCost + supportCost
  const grossProfit = revenue - productionCost
  const operatingProfit = revenue - variableCost - fixedEventCost
  const profitPerOrder = expectedOrders > 0 ? (revenue - variableCost) / expectedOrders : 0
  const breakEvenOrders = profitPerOrder > 0 ? Math.ceil(fixedEventCost / profitPerOrder) : null
  return {
    unitsPerOrder,
    expectedOrders,
    revenue,
    productionCost,
    logisticsCost,
    channelFee,
    marketingCost,
    adCost,
    opexCost,
    supportCost,
    fixedEventCost,
    grossProfit,
    operatingProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    operatingMargin: revenue > 0 ? (operatingProfit / revenue) * 100 : null,
    breakEvenOrders,
  }
}

function decisionFor(result) {
  if ((result.operatingMargin ?? -999) >= 15) return { label: '진행 가능', className: 'bg-blue-50 text-blue-700 border-blue-200' }
  if ((result.operatingMargin ?? -999) >= 5) return { label: '조건 확인', className: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: '손실 위험', className: 'bg-rose-50 text-rose-700 border-rose-200' }
}

function Field({ label, children }) {
  return (
    <label className="space-y-1 text-sm font-black text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  )
}

function NumberInput({ value, onChange, suffix = '' }) {
  return (
    <div className="flex items-center rounded border border-slate-300 bg-white px-3">
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full bg-transparent text-sm font-black text-slate-950 outline-none" inputMode="decimal" />
      {suffix && <span className="ml-2 text-xs font-black text-slate-500">{suffix}</span>}
    </div>
  )
}

export default function PromotionMarginPage() {
  const [costData, setCostData] = useState({ channels: {} })
  const [analytics, setAnalytics] = useState({ summary: {}, products: [] })
  const [startDate, setStartDate] = useState(firstDay)
  const [endDate, setEndDate] = useState(todayText)
  const [selectedRowKey, setSelectedRowKey] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(deriveInitialForm())
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const costRows = useMemo(() => flattenCostRows(costData), [costData])
  const filteredCostRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return costRows
    return costRows.filter((row) => productLabel(row).toLowerCase().includes(keyword))
  }, [costRows, search])
  const selectedRow = useMemo(
    () => costRows.find((row) => row.rowKey === selectedRowKey) || filteredCostRows[0] || costRows[0],
    [costRows, filteredCostRows, selectedRowKey],
  )
  const matchedSales = useMemo(() => matchSalesProduct(selectedRow, analytics.products), [selectedRow, analytics.products])
  const result = useMemo(() => calculateScenario(selectedRow, form), [selectedRow, form])
  const decision = decisionFor(result)

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const load = async () => {
    setLoading(true)
    try {
      const [costRes, salesRes] = await Promise.all([
        getAllCostData(),
        getExecutiveChannelSalesAnalytics({ startDate, endDate }),
      ])
      setCostData(costRes.data || { channels: {} })
      setAnalytics(salesRes.data || { summary: {}, products: [] })
    } catch (err) {
      setMessage(err?.response?.data?.message || '프로모션 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(saved)) setPlans(saved)
    } catch {
      setPlans([])
    }
  }, [])

  useEffect(() => {
    if (!selectedRow) return
    setForm((prev) => ({
      ...deriveInitialForm(selectedRow),
      promoName: prev.promoName,
      channel: prev.channel,
      promoType: prev.promoType,
      expectedOrders: prev.expectedOrders,
      unitsPerOrder: prev.unitsPerOrder,
    }))
  }, [selectedRow?.rowKey])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
  }, [plans])

  const refreshSales = async () => {
    setSyncing(true)
    setMessage('')
    try {
      await importPlayAutoChannelSales({ startDate, endDate })
      const res = await getExecutiveChannelSalesAnalytics({ startDate, endDate })
      setAnalytics(res.data || { summary: {}, products: [] })
      setMessage('실시간 판매 현황을 갱신했습니다.')
    } catch (err) {
      setMessage(err?.response?.data?.message || '실시간 판매 현황 갱신에 실패했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  const savePlan = () => {
    if (!selectedRow) return
    const plan = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      productName: selectedRow.product_name || '상품명 없음',
      productCode: selectedRow.product_code || '',
      skuCode: selectedRow.sku_code || '',
      sourceChannel: selectedRow.channelName || '',
      channel: form.channel,
      promoType: promoTypes.find((item) => item.id === form.promoType)?.label || form.promoType,
      promoName: form.promoName || `${selectedRow.product_name || '상품'} 프로모션`,
      startDate,
      endDate,
      expectedOrders: result.expectedOrders,
      unitsPerOrder: result.unitsPerOrder,
      promoPrice: num(form.promoPrice),
      targetRevenue: result.revenue,
      revenue: result.revenue,
      grossProfit: result.grossProfit,
      grossMargin: result.grossMargin,
      operatingMargin: result.operatingMargin,
      operatingProfit: result.operatingProfit,
      breakEvenOrders: result.breakEvenOrders,
      decision: decision.label,
    }
    setPlans((prev) => [plan, ...prev].slice(0, 50))
    setMessage('프로모션 마진 서식을 저장했고, 프로모션 내역에 연동했습니다.')
  }

  if (loading) return <div className="p-8 text-sm font-black text-slate-600">프로모션 마진 데이터를 불러오는 중입니다.</div>

  return (
    <div className="space-y-6 bg-slate-50 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">프로모션 마진 / 실시간 판매 판단</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">MD가 할인, 1+1, 오프라인 행사를 설계할 때 원가와 실시간 판매 흐름 기준으로 손익을 바로 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded border border-slate-300 px-3 text-sm font-black" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded border border-slate-300 px-3 text-sm font-black" />
          <button onClick={load} className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700">조회</button>
          <button onClick={refreshSales} disabled={syncing} className="h-10 rounded bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50">{syncing ? '갱신 중' : '실시간 판매 업데이트'}</button>
        </div>
      </header>

      {message && <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">{message}</div>}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">기간 실시간 매출</p><strong className="mt-4 block text-2xl font-black">{won(analytics.summary?.salesAmount)}</strong><p className="mt-2 text-xs font-bold text-slate-500">PlayAuto 주문 현황 기준</p></div>
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">기간 주문수</p><strong className="mt-4 block text-2xl font-black">{count(analytics.summary?.orderCount)}건</strong><p className="mt-2 text-xs font-bold text-slate-500">선택 기간 합계</p></div>
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">예상 행사 매출</p><strong className="mt-4 block text-2xl font-black">{won(result.revenue)}</strong><p className="mt-2 text-xs font-bold text-slate-500">{count(result.expectedOrders)}건 기준</p></div>
        <div className={`rounded border p-5 shadow-sm ${decision.className}`}><p className="text-xs font-black">행사 판단</p><strong className="mt-4 block text-2xl font-black">{decision.label}</strong><p className="mt-2 text-xs font-black">영업이익률 {pct(result.operatingMargin)}</p></div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <aside className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">프로모션 서식</h2>
          <div className="mt-4 space-y-4">
            <Field label="상품 검색"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품명, SKU, 코드 검색" className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none" /></Field>
            <Field label="상품 선택"><select value={selectedRow?.rowKey || ''} onChange={(e) => setSelectedRowKey(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm font-black outline-none">{filteredCostRows.map((row) => <option key={row.rowKey} value={row.rowKey}>{productLabel(row)}</option>)}</select></Field>
            <Field label="행사명"><input value={form.promoName} onChange={(e) => updateForm('promoName', e.target.value)} placeholder="예: 쿠팡 1+1 주말 특가" className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="채널"><select value={form.channel} onChange={(e) => updateForm('channel', e.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-black outline-none">{channelOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="행사 유형"><select value={form.promoType} onChange={(e) => updateForm('promoType', e.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-black outline-none">{promoTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="정상 판매가"><NumberInput value={form.basePrice} onChange={(v) => updateForm('basePrice', v)} suffix="원" /></Field>
              <Field label="행사 판매가"><NumberInput value={form.promoPrice} onChange={(v) => updateForm('promoPrice', v)} suffix="원" /></Field>
              <Field label="예상 주문수"><NumberInput value={form.expectedOrders} onChange={(v) => updateForm('expectedOrders', v)} suffix="건" /></Field>
              <Field label="주문당 구성수"><NumberInput value={form.promoType === 'onePlusOne' ? 2 : form.unitsPerOrder} onChange={(v) => updateForm('unitsPerOrder', v)} suffix="개" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="채널 수수료"><NumberInput value={form.channelFeeRate} onChange={(v) => updateForm('channelFeeRate', v)} suffix="%" /></Field>
              <Field label="광고비"><NumberInput value={form.adRate} onChange={(v) => updateForm('adRate', v)} suffix="%" /></Field>
              <Field label="마케팅비"><NumberInput value={form.marketingRate} onChange={(v) => updateForm('marketingRate', v)} suffix="%" /></Field>
              <Field label="판관비"><NumberInput value={form.opexRate} onChange={(v) => updateForm('opexRate', v)} suffix="%" /></Field>
              <Field label="주문당 물류비"><NumberInput value={form.logisticsPerOrder} onChange={(v) => updateForm('logisticsPerOrder', v)} suffix="원" /></Field>
              <Field label="행사 고정비"><NumberInput value={form.fixedEventCost} onChange={(v) => updateForm('fixedEventCost', v)} suffix="원" /></Field>
              <Field label="개당 쿠폰/지원금"><NumberInput value={form.extraSupportPerUnit} onChange={(v) => updateForm('extraSupportPerUnit', v)} suffix="원" /></Field>
            </div>
            <button onClick={savePlan} className="h-11 w-full rounded bg-slate-950 text-sm font-black text-white">서식 저장</button>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black text-slate-500">선택 상품</p><h2 className="mt-1 text-xl font-black">{selectedRow?.product_name || '상품을 선택하세요'}</h2><p className="mt-1 text-xs font-bold text-slate-500">{selectedRow?.channelName || '-'} / SKU {selectedRow?.sku_code || '-'}</p></div>
              <span className={`rounded-full border px-4 py-2 text-sm font-black ${decision.className}`}>{decision.label}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">제품 원가</p><b className="mt-2 block text-xl">{won(selectedRow?.production_cost)}</b></div>
              <div className="rounded bg-blue-50 p-4"><p className="text-xs font-black text-blue-700">공헌이익</p><b className="mt-2 block text-xl text-blue-700">{won(result.grossProfit)}</b><span className="text-xs font-black text-blue-600">{pct(result.grossMargin)}</span></div>
              <div className={`rounded p-4 ${result.operatingProfit >= 0 ? 'bg-blue-50' : 'bg-rose-50'}`}><p className="text-xs font-black text-slate-500">영업이익</p><b className={`mt-2 block text-xl ${result.operatingProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>{won(result.operatingProfit)}</b><span className="text-xs font-black">{pct(result.operatingMargin)}</span></div>
              <div className="rounded bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">손익분기 주문</p><b className="mt-2 block text-xl">{result.breakEvenOrders == null ? '-' : `${count(result.breakEvenOrders)}건`}</b><span className="text-xs font-bold text-slate-500">행사 고정비 기준</span></div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">선택 상품 실시간 판매</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">매출</p><b className="mt-2 block">{won(matchedSales?.sales_amount)}</b></div>
                <div className="rounded bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">주문</p><b className="mt-2 block">{count(matchedSales?.order_count)}건</b></div>
                <div className="rounded bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">객단가</p><b className="mt-2 block">{won(matchedSales?.average_order_value || (num(matchedSales?.sales_amount) / Math.max(1, num(matchedSales?.order_count))))}</b></div>
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">저장한 마진 서식</h2>
              <div className="mt-4 max-h-56 space-y-2 overflow-auto">
                {plans.length === 0 ? <p className="rounded bg-slate-50 p-4 text-sm font-bold text-slate-500">저장된 서식이 없습니다.</p> : plans.map((plan) => (
                  <div key={plan.id} className="rounded border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3"><b className="text-sm">{plan.promoName}</b><button onClick={() => setPlans((prev) => prev.filter((item) => item.id !== plan.id))} className="text-xs font-black text-rose-600">삭제</button></div>
                    <p className="mt-1 text-xs font-bold text-slate-500">{plan.productName} / {plan.channel} / {plan.promoType}</p>
                    <p className="mt-2 text-xs font-black">매출 {won(plan.targetRevenue || plan.revenue)} · 이익 {won(plan.operatingProfit)} · 이익률 {pct(plan.operatingMargin)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </section>
    </div>
  )
}
