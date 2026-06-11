import { useEffect, useMemo, useState } from 'react'
import { getAllCostData } from '../../api/productCostApi'
import { getExecutiveChannelSalesAnalytics, importPlayAutoChannelSales } from '../../api/executiveApi'
import {
    savePromotionForm,
    submitPromotionForm,
    getPromotionHistory,
} from '../../api/promotionMarginApi'

// ─── 상수 ────────────────────────────────────────────────────────────────────
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

const channelOptions = [
  { id: 'online',  label: '온라인' },
  { id: 'offline', label: '오프라인' },
  { id: 'export',  label: '해외 수출' },
  ]

// 히스토리 채널 탭
const HISTORY_TABS = [
  { id: null,      label: '전체' },
  { id: 'online',  label: '온라인' },
  { id: 'offline', label: '오프라인' },
  { id: 'export',  label: '해외 수출' },
  ]

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

function deriveInitialForm(row) {
    const basePrice = num(row?.consumer_price) || num(row?.list_price)
    return {
          channel: 'online',
          promoType: 'discount',
          promoName: '',
          expectedOrders: 100,
          unitsPerOrder: 1,
          basePrice,
          promoPrice: basePrice,
          discountRate: 0,
          channelFeeRate: Math.round(num(row?.channel_fee_rate) * 1000) / 10,
          marketingRate: Math.round(num(row?.marketing_rate) * 1000) / 10,
          adRate: Math.round(num(row?.ad_rate) * 1000) / 10,
          opexRate: Math.round(num(row?.opex_rate) * 1000) / 10,
          logisticsPerOrder: num(row?.consumer_ship_fee) + num(row?.storage_fee_unit),
          extraSupportPerUnit: 0,
          fixedEventCost: 0,
          promoStartDate: firstDay,
          promoEndDate: todayText,
          skuCode: row?.sku_code || row?.product_code || '',
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
    const operatingProfit = revenue - variableCost - fixedEventCost
    return { unitsPerOrder, expectedOrders, revenue, productionCost, logisticsCost, channelFee, marketingCost, adCost, opexCost, supportCost, fixedEventCost, variableCost, operatingProfit }
}

// ─── 프로모션 내역 탭 컴포넌트 ────────────────────────────────────────────────
function PromotionHistoryTab({ companyId = 1 }) {
    const [activeChannel, setActiveChannel] = useState(null)
    const [summaries, setSummaries] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

  useEffect(() => {
        setLoading(true)
        setError(null)
        getPromotionHistory(companyId, activeChannel)
          .then(setSummaries)
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false))
  }, [companyId, activeChannel])

<<<<<<< HEAD
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
    setPlans((prev) => [plan, ...prev].slice(0, 20))
    setMessage('프로모션 마진 서식을 저장했습니다.')
  }

  if (loading) {
    return <div className="p-8 text-sm font-black text-slate-600">프로모션 마진 데이터를 불러오는 중입니다.</div>
  }
=======
  const fmt = (v) => Math.round(Number(v || 0)).toLocaleString('ko-KR')
    const fmtW = (v) => `${fmt(v)}원`
    const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`
>>>>>>> b5c97179018675e12f088f23e25b40a6f5652ce0

  return (
        <div className="space-y-6">
          {/* 채널 탭 */}
              <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                {HISTORY_TABS.map((t) => (
                    <button
                                  key={String(t.id)}
                                  onClick={() => setActiveChannel(t.id)}
                                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                                  activeChannel === t.id
                                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                  }`}
                                >
                      {t.label}
                    </button>button>
                  ))}
              </div>div>
        
          {loading && <p className="text-center text-gray-400 py-10">불러오는 중...</p>p>}
          {error && <p className="text-center text-red-400 py-10">{error}</p>p>}
        
          {!loading && !error && summaries.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                            <span className="material-icons text-4xl mb-2 block">receipt_long</span>span>
                            <p>등록된 프로모션 내역이 없습니다.</p>p>
                            <p className="text-sm mt-1">프로모션 마진 서식을 작성하고 제출하면 여기에 표시됩니다.</p>p>
                  </div>div>
              )}
        
          {!loading && summaries.map((summary) => (
                  <div key={summary.channel} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* 채널 헤더 */}
                            <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    summary.channel === 'online'  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                    summary.channel === 'offline' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                                    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  }`}>
                                                        {summary.channel === 'online' ? '온라인' : summary.channel === 'offline' ? '오프라인' : '해외 수출'}
                                                      </span>span>
                                                      <span className="text-sm text-gray-500">프로모션 {summary.promotionCount}건</span>span>
                                        </div>div>
                                        <span className={`text-sm font-semibold ${
                                  Number(summary.overallAchievementRate) >= 100 ? 'text-green-500' : 'text-yellow-500'
                  }`}>달성률 {fmtPct(summary.overallAchievementRate)}</span>span>
                            </div>div>
                  
                    {/* 채널 요약 집계 */}
                            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700">
                                        <div className="px-5 py-4 text-center">
                                                      <p className="text-xs text-gray-500 mb-1">목표 매출</p>p>
                                                      <p className="text-base font-bold text-gray-800 dark:text-gray-100">{fmtW(summary.totalTargetRevenue)}</p>p>
                                        </div>div>
                                        <div className="px-5 py-4 text-center">
                                                      <p className="text-xs text-gray-500 mb-1">실시간 매출</p>p>
                                                      <p className="text-base font-bold text-blue-600 dark:text-blue-400">{fmtW(summary.totalActualRevenue)}</p>p>
                                        </div>div>
                                        <div className="px-5 py-4 text-center">
                                                      <p className="text-xs text-gray-500 mb-1">실시간 영업이익</p>p>
                                                      <p className={`text-base font-bold ${Number(summary.totalActualOperatingProfit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                        {fmtW(summary.totalActualOperatingProfit)}
                                                      </p>p>
                                        </div>div>
                            </div>div>
                  
                    {/* 개별 프로모션 목록 */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                              {(summary.items || []).map((item) => (
                                  <div key={item.id} className="px-5 py-4">
                                                  <div className="flex items-start justify-between mb-3">
                                                                    <div>
                                                                                        <p className="font-medium text-gray-800 dark:text-gray-100">{item.productName}</p>p>
                                                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                                                          {item.promotionType} · {item.promoStartDate} ~ {item.promoEndDate}
                                                                                          {item.skuCode ? ` · ${item.skuCode}` : ''}
                                                                                          </p>p>
                                                                    </div>div>
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                        Number(item.revenueAchievementRate) >= 100
                                                          ? 'bg-green-100 text-green-700'
                                                          : Number(item.revenueAchievementRate) >= 50
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-red-100 text-red-700'
                                  }`}>
                                                                      {fmtPct(item.revenueAchievementRate)}
                                                                    </span>span>
                                                  </div>div>
                                  
                                    {/* 3컬럼 지표 */}
                                                  <div className="grid grid-cols-3 gap-3 text-center">
                                                                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                                                                                        <p className="text-[11px] text-gray-400 mb-0.5">목표 매출</p>p>
                                                                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{fmtW(item.targetRevenue)}</p>p>
                                                                                        <p className="text-[10px] text-gray-400">{(item.targetQty || 0).toLocaleString()}개</p>p>
                                                                    </div>div>
                                                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                                                                                        <p className="text-[11px] text-blue-400 mb-0.5">실시간 매출</p>p>
                                                                                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">{fmtW(item.actualRevenue)}</p>p>
                                                                                        <p className="text-[10px] text-gray-400">{(item.actualQty || 0).toLocaleString()}개</p>p>
                                                                    </div>div>
                                                                    <div className={`rounded-lg px-3 py-2 ${Number(item.actualOperatingProfit) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                                                                        <p className="text-[11px] text-gray-400 mb-0.5">실시간 영업이익</p>p>
                                                                                        <p className={`text-sm font-semibold ${Number(item.actualOperatingProfit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                                                          {fmtW(item.actualOperatingProfit)}
                                                                                          </p>p>
                                                                                        <p className="text-[10px] text-gray-400">목표 {fmtW(item.targetOperatingProfit)}</p>p>
                                                                    </div>div>
                                                  </div>div>
                                  </div>div>
                                ))}
                            </div>div>
                  </div>div>
                ))}
        </div>div>
      )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function PromotionMarginPage({ companyId = 1 }) {
    // 최상단 탭: '서식' | '내역'
    const [mainTab, setMainTab] = useState('form')
      
        const [costData, setCostData] = useState(null)
            const [salesData, setSalesData] = useState(null)
                const [loading, setLoading] = useState(true)
                    const [selectedRowKey, setSelectedRowKey] = useState(null)
                        const [form, setForm] = useState(null)
                            const [savedPlans, setSavedPlans] = useState(() => {
                                  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
                                  catch { return [] }
                            })
                                const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
    const [submitStatus, setSubmitStatus] = useState(null) // null | 'submitting' | 'done' | 'error'
    const [savedFormId, setSavedFormId] = useState(null)
      
        useEffect(() => {
              Promise.all([
                      getAllCostData(companyId),
                      getExecutiveChannelSalesAnalytics(companyId, firstDay, todayText).catch(() => null),
                    ]).then(([cost, sales]) => {
                      setCostData(cost)
                              setSalesData(sales)
                                      setLoading(false)
              })
        }, [companyId])
          
            const costRows = useMemo(() => flattenCostRows(costData), [costData])
              
                const selectedRow = useMemo(
                      () => costRows.find((r) => r.rowKey === selectedRowKey) ?? null,
                      [costRows, selectedRowKey],
                    )
                  
                    useEffect(() => {
                          if (selectedRowKey) setForm(deriveInitialForm(selectedRow))
                    }, [selectedRowKey])
                      
                        const scenario = useMemo(() => {
                              if (!form || !selectedRow) return null
                                    return calculateScenario(selectedRow, form)
                        }, [form, selectedRow])
                          
                            // 서식 저장 (임시저장 draft)
    async function handleSaveForm() {
          if (!form || !selectedRow) return
                setSaveStatus('saving')
                      try {
                              const payload = {
                                        companyId,
                                        formName: `${selectedRow.product_name || '상품'} - ${channelOptions.find(c => c.id === form.channel)?.label || form.channel} 프로모션`,
                                        channel: form.channel,
                                        promotionType: form.promoType,
                                        productName: selectedRow.product_name || '',
                                        skuCode: form.skuCode || selectedRow.sku_code || '',
                                        salePrice: num(form.promoPrice),
                                        discountRate: num(form.discountRate),
                                        discountAmount: num(form.basePrice) - num(form.promoPrice),
                                        cogs: num(selectedRow?.production_cost),
                                        logisticsCost: num(form.logisticsPerOrder),
                                        marketingCost: scenario ? (scenario.marketingCost + scenario.adCost) : 0,
                                        platformFeeRate: num(form.channelFeeRate),
                                        otherCost: scenario ? (scenario.opexCost + scenario.supportCost) : 0,
                                        targetQty: num(form.expectedOrders),
                                        promoStartDate: form.promoStartDate || firstDay,
                                        promoEndDate: form.promoEndDate || todayText,
                                        memo: form.promoName || '',
                              }
                                      const result = await savePromotionForm(payload)
                                              setSavedFormId(result.formId)
                                                      // 로컬스토리지에도 저장
                              const plan = { ...form, productLabel: productLabel(selectedRow), scenario, savedAt: new Date().toISOString(), formId: result.formId }
                                      const updated = [plan, ...savedPlans.filter((p) => p.productLabel !== plan.productLabel)].slice(0, 20)
                                              setSavedPlans(updated)
                                                      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
                                                              setSaveStatus('saved')
                      } catch {
                              setSaveStatus('error')
                      }
          setTimeout(() => setSaveStatus(null), 3000)
    }
  
    // 서식 제출 → 프로모션 내역 연동
    async function handleSubmitForm() {
          if (!savedFormId) { alert('먼저 "서식 저장"을 눌러 저장하세요.'); return }
          setSubmitStatus('submitting')
                try {
                        await submitPromotionForm(savedFormId, companyId)
                                setSubmitStatus('done')
                                        setTimeout(() => { setSubmitStatus(null); setMainTab('history') }, 1500)
                } catch {
                        setSubmitStatus('error')
                                setTimeout(() => setSubmitStatus(null), 3000)
                }
    }
  
    const f = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
      
        return (
              <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
                {/* 페이지 타이틀 */}
                    <div className="flex items-center justify-between">
                            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                      <span className="material-icons text-blue-500">sell</span>span>
                                      프로모션 마진
                            </h1>h1>
                    </div>div>
              
                {/* 메인 탭: 프로모션 마진 서식 / 프로모션 내역 */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
                      {[
                { id: 'form',    label: '프로모션 마진 서식', icon: 'edit_note' },
                { id: 'history', label: '프로모션 내역',       icon: 'receipt_long' },
                        ].map((t) => (
                                    <button
                                                  key={t.id}
                                                  onClick={() => setMainTab(t.id)}
                                                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                                  mainTab === t.id
                                                                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                                  }`}
                                                >
                                                <span className="material-icons text-[18px]">{t.icon}</span>span>
                                      {t.label}
                                    </button>button>
                                  ))}
                    </div>div>
              
                {/* ── 프로모션 마진 서식 탭 ──────────────────────────────────────────── */}
                {mainTab === 'form' && (
                        <div className="space-y-4">
                          {loading ? (
                                      <p className="text-center text-gray-400 py-10">상품 원가 데이터 로딩 중...</p>p>
                                    ) : costRows.length === 0 ? (
                                      <p className="text-center text-gray-400 py-10">원가 데이터가 없습니다. 제품 원가 관리 메뉴에서 먼저 데이터를 입력해주세요.</p>p>
                                    ) : (
                                      <>
                                        {/* 상품 선택 */}
                                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                                                      프로모션 대상 상품 선택
                                                                    </label>label>
                                                                    <select
                                                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                                                                        value={selectedRowKey || ''}
                                                                                        onChange={(e) => setSelectedRowKey(e.target.value)}
                                                                                      >
                                                                                      <option value="">-- 상품을 선택하세요 --</option>option>
                                                                      {costRows.map((row) => (
                                                                                                            <option key={row.rowKey} value={row.rowKey}>
                                                                                                                                  [{row.channelName}] {productLabel(row)}
                                                                                                              </option>option>
                                                                                                          ))}
                                                                    </select>select>
                                                    </div>div>
                                      
                                        {/* 서식 입력 */}
                                        {form && selectedRow && (
                                                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
                                                                          <h2 className="font-semibold text-gray-800 dark:text-gray-100">프로모션 서식</h2>h2>
                                                        
                                                          {/* 기본 정보 */}
                                                                          <div className="grid grid-cols-2 gap-4">
                                                                                              <div>
                                                                                                                    <label className="block text-xs text-gray-500 mb-1">채널</label>label>
                                                                                                                    <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.channel} onChange={f('channel')}>
                                                                                                                      {channelOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>option>)}
                                                                                                                      </select>select>
                                                                                                </div>div>
                                                                                              <div>
                                                                                                                    <label className="block text-xs text-gray-500 mb-1">프로모션 유형</label>label>
                                                                                                                    <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.promoType} onChange={f('promoType')}>
                                                                                                                      {promoTypes.map(p => <option key={p.id} value={p.id}>{p.label}</option>option>)}
                                                                                                                      </select>select>
                                                                                                </div>div>
                                                                                              <div className="col-span-2">
                                                                                                                    <label className="block text-xs text-gray-500 mb-1">프로모션 명칭 (메모)</label>label>
                                                                                                                    <input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" placeholder="예: 여름 특가 이벤트" value={form.promoName} onChange={f('promoName')} />
                                                                                                </div>div>
                                                                                              <div>
                                                                                                                    <label className="block text-xs text-gray-500 mb-1">프로모션 시작일</label>label>
                                                                                                                    <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.promoStartDate} onChange={f('promoStartDate')} />
                                                                                                </div>div>
                                                                                              <div>
                                                                                                                    <label className="block text-xs text-gray-500 mb-1">프로모션 종료일</label>label>
                                                                                                                    <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.promoEndDate} onChange={f('promoEndDate')} />
                                                                                                </div>div>
                                                                          </div>div>
                                                        
                                                          {/* 판매 조건 */}
                                                                          <div>
                                                                                              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">판매 조건</h3>h3>
                                                                                              <div className="grid grid-cols-3 gap-3">
                                                                                                                    <div>
                                                                                                                                            <label className="block text-xs text-gray-500 mb-1">기준가 (원)</label>label>
                                                                                                                                            <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.basePrice} onChange={f('basePrice')} />
                                                                                                                      </div>div>
                                                                                                                    <div>
                                                                                                                                            <label className="block text-xs text-gray-500 mb-1">프로모션가 (원)</label>label>
                                                                                                                                            <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.promoPrice} onChange={f('promoPrice')} />
                                                                                                                      </div>div>
                                                                                                                    <div>
                                                                                                                                            <label className="block text-xs text-gray-500 mb-1">목표 수량 (건)</label>label>
                                                                                                                                            <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form.expectedOrders} onChange={f('expectedOrders')} />
                                                                                                                      </div>div>
                                                                                                </div>div>
                                                                          </div>div>
                                                        
                                                          {/* 비용 구조 */}
                                                                          <div>
                                                                                              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">비용 구조</h3>h3>
                                                                                              <div className="grid grid-cols-3 gap-3">
                                                                                                {[
                                                          { key: 'channelFeeRate', label: '채널 수수료율 (%)' },
                                                          { key: 'marketingRate',  label: '마케팅 비율 (%)' },
                                                          { key: 'adRate',         label: '광고 비율 (%)' },
                                                          { key: 'opexRate',       label: '운영비 비율 (%)' },
                                                          { key: 'logisticsPerOrder', label: '건당 물류비 (원)' },
                                                          { key: 'extraSupportPerUnit', label: '추가 지원 (원/개)' },
                                                          { key: 'fixedEventCost',  label: '고정 행사비 (원)' },
                                                                                ].map(({ key, label }) => (
                                                                                                          <div key={key}>
                                                                                                                                    <label className="block text-xs text-gray-500 mb-1">{label}</label>label>
                                                                                                                                    <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" value={form[key]} onChange={f(key)} />
                                                                                                            </div>div>
                                                                                                        ))}
                                                                                                </div>div>
                                                                          </div>div>
                                                        
                                                          {/* 시나리오 결과 */}
                                                          {scenario && (
                                                                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                                                                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">📊 예상 결과</h3>h3>
                                                                                                    <div className="grid grid-cols-3 gap-3 text-center">
                                                                                                                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                                                                                                                                      <p className="text-xs text-gray-400 mb-1">목표 매출</p>p>
                                                                                                                                                      <p className="font-bold text-gray-800 dark:text-gray-100">{won(scenario.revenue)}</p>p>
                                                                                                                              </div>div>
                                                                                                                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                                                                                                                                      <p className="text-xs text-gray-400 mb-1">총 변동비</p>p>
                                                                                                                                                      <p className="font-bold text-red-500">{won(scenario.variableCost + scenario.fixedEventCost)}</p>p>
                                                                                                                              </div>div>
                                                                                                                            <div className={`rounded-lg p-3 ${scenario.operatingProfit >= 0 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                                                                                                                                                      <p className="text-xs text-gray-400 mb-1">예상 영업이익</p>p>
                                                                                                                                                      <p className={`font-bold ${scenario.operatingProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{won(scenario.operatingProfit)}</p>p>
                                                                                                                              </div>div>
                                                                                                      </div>div>
                                                                                </div>div>
                                                                          )}
                                                        
                                                          {/* 저장 버튼 */}
                                                                          <div className="flex gap-3 pt-2">
                                                                                              <button
                                                                                                                      onClick={handleSaveForm}
                                                                                                                      disabled={saveStatus === 'saving'}
                                                                                                                      className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                                                                                    >
                                                                                                {saveStatus === 'saving' ? '저장 중...' : saveStatus === 'saved' ? '✓ 저장됨' : saveStatus === 'error' ? '저장 실패' : '서식 저장'}
                                                                                                </button>button>
                                                                                              <button
                                                                                                                      onClick={handleSubmitForm}
                                                                                                                      disabled={submitStatus === 'submitting' || !savedFormId}
                                                                                                                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                                                                                                                                                submitStatus === 'done'
                                                                                                                                                  ? 'bg-green-500 text-white'
                                                                                                                                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                                                                                        }`}
                                                                                                                    >
                                                                                                {submitStatus === 'submitting' ? '제출 중...' :
                                                                                                                         submitStatus === 'done'        ? '✓ 프로모션 내역에 등록됨' :
                                                                                                                         submitStatus === 'error'       ? '제출 실패' :
                                                                                                                         !savedFormId                   ? '(서식 저장 먼저)' :
                                                                                                                         '서식 저장 (제출 → 내역 연동)'}
                                                                                                </button>button>
                                                                          </div>div>
                                                        </div>div>
                                                    )}
                                      </>>
                                    )}
                        </div>div>
                    )}
              
                {/* ── 프로모션 내역 탭 ───────────────────────────────────────────────── */}
                {mainTab === 'history' && (
                        <PromotionHistoryTab companyId={companyId} />
                      )}
              </div>div>
            )
}</></div>
