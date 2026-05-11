import { useEffect, useMemo, useState } from 'react'
import {
  getBrands,
  getProductCosts,
  updateProductChannelCost,
  updateProductCosts,
} from '../api/salesApi'

function toInputValue(value) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? String(numericValue) : '0'
}

function normalizeDraftNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function createEmptyCostComponent(sortOrder = 0) {
  return {
    componentName: '',
    amount: '0',
    sortOrder,
  }
}

function hasNamedCostComponent(components = []) {
  return components.some((component) => String(component?.componentName || '').trim().length > 0)
}

function getCostComponentTotal(components = []) {
  return components.reduce((sum, component) => {
    if (!String(component?.componentName || '').trim()) return sum
    return sum + normalizeDraftNumber(component?.amount)
  }, 0)
}

function formatCurrency(value) {
  return `₩${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}`
}

function getAllocationDivisor(mode, monthlyOutboundCount) {
  if (mode !== 'AVERAGE_ALLOCATED') return 1
  return Math.max(Number(monthlyOutboundCount ?? 0), 1)
}

function calculateExpectedMarketPrice(commonDraft, channelDraft, mode, monthlyOutboundCount) {
  const divisor = getAllocationDivisor(mode, monthlyOutboundCount)
  const salePrice = normalizeDraftNumber(commonDraft?.salePrice)
  const unitCost = normalizeDraftNumber(commonDraft?.costPrice)
  const sharedCommonCosts =
    normalizeDraftNumber(commonDraft?.sgnaCost) +
    normalizeDraftNumber(commonDraft?.logisticsCost) +
    normalizeDraftNumber(commonDraft?.packagingCost) +
    normalizeDraftNumber(commonDraft?.otherCost)
  const sharedChannelCosts =
    normalizeDraftNumber(channelDraft?.adCost) +
    normalizeDraftNumber(channelDraft?.returnExchangeCost)
  const channelFeeValue = normalizeDraftNumber(channelDraft?.channelFeeValue)
  const allocatedFixedCosts = unitCost + (sharedCommonCosts / divisor) + (sharedChannelCosts / divisor)

  if ((channelDraft?.channelFeeType || 'RATE') === 'FIXED') {
    return allocatedFixedCosts + (channelFeeValue / divisor)
  }

  const normalizedRate = channelFeeValue / 100
  if (normalizedRate >= 1) return null
  return allocatedFixedCosts / Math.max(1 - normalizedRate, 0.0001)
}

function calculateCurrentMarketProfit(commonDraft, channelDraft, mode, monthlyOutboundCount) {
  const salePrice = normalizeDraftNumber(commonDraft?.salePrice)
  const divisor = getAllocationDivisor(mode, monthlyOutboundCount)
  const unitCost = normalizeDraftNumber(commonDraft?.costPrice)
  const sharedCommonCosts =
    normalizeDraftNumber(commonDraft?.sgnaCost) +
    normalizeDraftNumber(commonDraft?.logisticsCost) +
    normalizeDraftNumber(commonDraft?.packagingCost) +
    normalizeDraftNumber(commonDraft?.otherCost)
  const sharedChannelCosts =
    normalizeDraftNumber(channelDraft?.adCost) +
    normalizeDraftNumber(channelDraft?.returnExchangeCost)
  const channelFeeValue = normalizeDraftNumber(channelDraft?.channelFeeValue)
  const allocatedBaseCost = unitCost + (sharedCommonCosts / divisor) + (sharedChannelCosts / divisor)
  const channelFeeAmount = (channelDraft?.channelFeeType || 'RATE') === 'FIXED'
    ? (channelFeeValue / divisor)
    : salePrice * (channelFeeValue / 100)

  return salePrice - allocatedBaseCost - channelFeeAmount
}

function SummaryCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-3 break-keep text-[10px] font-bold leading-snug tracking-[0.1em] text-slate-400 sm:text-[11px] lg:text-xs">
        {label}
      </p>
      <p className="overflow-hidden text-[clamp(2.1rem,2.6vw,3rem)] font-black leading-none tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  )
}

function ChannelCostEditor({
  productId,
  shop,
  commonValue,
  calculationMode,
  monthlyOutboundCount,
  value,
  saving,
  onChange,
  onSave,
}) {
  const expectedMarketPrice = calculateExpectedMarketPrice(commonValue, value, calculationMode, monthlyOutboundCount)
  const currentMarketProfit = calculateCurrentMarketProfit(commonValue, value, calculationMode, monthlyOutboundCount)
  const isAverageMode = calculationMode === 'AVERAGE_ALLOCATED'
  const allocationBaseCount = Math.max(Number(monthlyOutboundCount ?? 0), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_120px] lg:items-end">
        <div>
          <p className="text-sm font-bold text-slate-900">{shop.shopName}</p>
          <p className="mt-1 text-xs text-slate-500">{shop.shopCode}</p>
        </div>

        <label className="block">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">수수료 유형</span>
          <select
            value={value.channelFeeType}
            onChange={(event) => onChange(productId, shop.shopId, 'channelFeeType', event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
          >
            <option value="RATE">비율(%)</option>
            <option value="FIXED">고정금액</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">수수료 값</span>
          <input
            type="text"
            inputMode="decimal"
            value={value.channelFeeValue}
            onChange={(event) => onChange(productId, shop.shopId, 'channelFeeValue', event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">광고비</span>
            <input
              type="text"
              inputMode="decimal"
              value={value.adCost}
              onChange={(event) => onChange(productId, shop.shopId, 'adCost', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">반품/교환비</span>
            <input
              type="text"
              inputMode="decimal"
              value={value.returnExchangeCost}
              onChange={(event) => onChange(productId, shop.shopId, 'returnExchangeCost', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onSave(productId, shop.shopId)}
          disabled={saving}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving ? '저장 중' : '저장'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">예상 판매가</p>
          <p className="mt-2 text-lg font-black text-emerald-900">
            {expectedMarketPrice === null ? '수수료율 확인 필요' : formatCurrency(expectedMarketPrice)}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            {isAverageMode
              ? `배분 기준 수량 ${allocationBaseCount.toLocaleString('ko-KR')}건 기준 평균 배분 판매가`
              : '건당 비용 기준 손익분기 판매가'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">현재 판매가 기준 예상 이익</p>
          <p className={`mt-2 text-lg font-black ${currentMarketProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(currentMarketProfit)}
          </p>
          <p className="mt-1 text-xs text-slate-500">판매가 입력값을 기준으로 계산됩니다.</p>
        </div>
      </div>
    </div>
  )
}

export default function ProductCosts({ isExpanded }) {
  const [companyId] = useState(1)
  const [selectedBrand, setSelectedBrand] = useState('ALL')
  const [calculationMode, setCalculationMode] = useState('PER_ORDER')
  const [brands, setBrands] = useState([])
  const [shops, setShops] = useState([])
  const [products, setProducts] = useState([])
  const [expandedProducts, setExpandedProducts] = useState({})
  const [expandedCostDetails, setExpandedCostDetails] = useState({})
  const [commonDrafts, setCommonDrafts] = useState({})
  const [channelDrafts, setChannelDrafts] = useState({})
  const [savingCommonProductId, setSavingCommonProductId] = useState(null)
  const [savingChannelKey, setSavingChannelKey] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await getBrands(companyId)
        setBrands(response.data || [])
      } catch (error) {
        console.error('Brand API error:', error)
        setBrands([])
      }
    }

    fetchBrands()
  }, [companyId])

  useEffect(() => {
    const fetchCosts = async () => {
      try {
        setLoading(true)
        const brandId = selectedBrand === 'ALL' ? null : Number(selectedBrand)
        const response = await getProductCosts(companyId, brandId)
        const data = response.data || { shops: [], products: [] }
        setShops(data.shops || [])
        setProducts(data.products || [])
      } catch (error) {
        console.error('Product cost API error:', error)
        setShops([])
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchCosts()
  }, [companyId, selectedBrand])

  useEffect(() => {
    setCommonDrafts(
      Object.fromEntries(
        products.map((product) => [
          product.productId,
          {
            salePrice: toInputValue(product.salePrice),
            costPrice: toInputValue(product.costPrice),
            supplyPrice: toInputValue(product.supplyPrice),
            sgnaCost: toInputValue(product.sgnaCost),
            logisticsCost: toInputValue(product.logisticsCost),
            packagingCost: toInputValue(product.packagingCost),
            otherCost: toInputValue(product.otherCost),
            costComponents: (product.costComponents || []).map((component, index) => ({
              componentName: component.componentName || '',
              amount: toInputValue(component.amount),
              sortOrder: component.sortOrder ?? index,
            })),
          },
        ])
      )
    )

    setChannelDrafts(
      Object.fromEntries(
        products.map((product) => [
          product.productId,
          Object.fromEntries(
            shops.map((shop) => {
              const existing = product.channelCosts?.find((item) => item.shopId === shop.shopId)
              return [
                shop.shopId,
                {
                  channelFeeType: existing?.channelFeeType || 'RATE',
                  channelFeeValue: toInputValue(existing?.channelFeeValue),
                  adCost: toInputValue(existing?.adCost),
                  returnExchangeCost: toInputValue(existing?.returnExchangeCost),
                },
              ]
            })
          ),
        ])
      )
    )
  }, [products, shops])

  const summary = useMemo(() => {
    const totalProducts = products.length
    const configuredProducts = products.filter((product) =>
      Number(product.salePrice ?? 0) > 0 ||
      Number(product.costPrice ?? 0) > 0 ||
      Number(product.supplyPrice ?? 0) > 0 ||
      Number(product.sgnaCost ?? 0) > 0 ||
      Number(product.logisticsCost ?? 0) > 0 ||
      Number(product.packagingCost ?? 0) > 0 ||
      Number(product.otherCost ?? 0) > 0
    ).length
    const connectedMarkets = shops.length
    const totalRealStock = products.reduce((sum, product) => sum + Number(product.realStock ?? 0), 0)

    return { totalProducts, configuredProducts, connectedMarkets, totalRealStock }
  }, [products, shops])

  const updateCommonDraft = (productId, field, value) => {
    if (!/^\d*(\.\d{0,2})?$/.test(value)) return

    setCommonDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: value,
      },
    }))
  }

  const updateCostComponentDraft = (productId, index, field, value) => {
    if (field === 'amount' && !/^\d*(\.\d{0,2})?$/.test(value)) return

    setCommonDrafts((current) => {
      const nextComponents = [...(current[productId]?.costComponents || [])]
      const existing = nextComponents[index] || createEmptyCostComponent(index)
      nextComponents[index] = {
        ...existing,
        [field]: value,
        sortOrder: index,
      }

      const hasDetails = hasNamedCostComponent(nextComponents)
      return {
        ...current,
        [productId]: {
          ...current[productId],
          costComponents: nextComponents,
          costPrice: hasDetails
            ? toInputValue(getCostComponentTotal(nextComponents))
            : current[productId]?.costPrice ?? '0',
        },
      }
    })
  }

  const addCostComponentDraft = (productId) => {
    setExpandedCostDetails((current) => ({
      ...current,
      [productId]: true,
    }))

    setCommonDrafts((current) => {
      const currentComponents = current[productId]?.costComponents || []
      return {
        ...current,
        [productId]: {
          ...current[productId],
          costComponents: [...currentComponents, createEmptyCostComponent(currentComponents.length)],
        },
      }
    })
  }

  const removeCostComponentDraft = (productId, index) => {
    setCommonDrafts((current) => {
      const nextComponents = (current[productId]?.costComponents || [])
        .filter((_, currentIndex) => currentIndex !== index)
        .map((component, currentIndex) => ({
          ...component,
          sortOrder: currentIndex,
        }))
      const hasDetails = hasNamedCostComponent(nextComponents)

      return {
        ...current,
        [productId]: {
          ...current[productId],
          costComponents: nextComponents,
          costPrice: hasDetails
            ? toInputValue(getCostComponentTotal(nextComponents))
            : current[productId]?.costPrice ?? '0',
        },
      }
    })
  }

  const updateChannelDraft = (productId, shopId, field, value) => {
    if (field !== 'channelFeeType' && !/^\d*(\.\d{0,2})?$/.test(value)) return

    setChannelDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [shopId]: {
          ...current[productId]?.[shopId],
          [field]: value,
        },
      },
    }))
  }

  const handleSaveCommonCosts = async (productId) => {
    const draft = commonDrafts[productId]
    if (!draft) return

    try {
      setSavingCommonProductId(productId)
      const response = await updateProductCosts(productId, companyId, {
        salePrice: normalizeDraftNumber(draft.salePrice),
        costPrice: normalizeDraftNumber(draft.costPrice),
        supplyPrice: normalizeDraftNumber(draft.supplyPrice),
        sgnaCost: normalizeDraftNumber(draft.sgnaCost),
        logisticsCost: normalizeDraftNumber(draft.logisticsCost),
        packagingCost: normalizeDraftNumber(draft.packagingCost),
        otherCost: normalizeDraftNumber(draft.otherCost),
        costComponents: (draft.costComponents || [])
          .map((component, index) => ({
            componentName: String(component.componentName || '').trim(),
            amount: normalizeDraftNumber(component.amount),
            sortOrder: index,
          }))
          .filter((component) => component.componentName),
      })

      const updated = response.data
      setProducts((current) =>
        current.map((product) => (product.productId === productId ? updated : product))
      )
    } catch (error) {
      console.error('Common cost update API error:', error)
      window.alert('공통 비용 저장에 실패했습니다.')
    } finally {
      setSavingCommonProductId(null)
    }
  }

  const handleSaveChannelCost = async (productId, shopId) => {
    const draft = channelDrafts[productId]?.[shopId]
    if (!draft) return

    const savingKey = `${productId}-${shopId}`

    try {
      setSavingChannelKey(savingKey)
      const response = await updateProductChannelCost(productId, shopId, companyId, {
        channelFeeType: draft.channelFeeType,
        channelFeeValue: normalizeDraftNumber(draft.channelFeeValue),
        adCost: normalizeDraftNumber(draft.adCost),
        returnExchangeCost: normalizeDraftNumber(draft.returnExchangeCost),
      })

      const updated = response.data
      setProducts((current) =>
        current.map((product) => {
          if (product.productId !== productId) return product

          const nextChannelCosts = [...(product.channelCosts || [])]
          const existingIndex = nextChannelCosts.findIndex((item) => item.shopId === shopId)
          if (existingIndex >= 0) {
            nextChannelCosts[existingIndex] = updated
          } else {
            nextChannelCosts.push(updated)
          }

          return {
            ...product,
            channelCosts: nextChannelCosts,
          }
        })
      )
    } catch (error) {
      console.error('Channel cost update API error:', error)
      window.alert('마켓별 비용 저장에 실패했습니다.')
    } finally {
      setSavingChannelKey(null)
    }
  }

  return (
    <main
      className={`min-h-screen bg-slate-50 p-8 transition-all duration-300 ${
        isExpanded ? 'ml-64' : 'ml-20'
      }`}
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">비용 관리</h1>
          <p className="mt-3 text-slate-500">
            수집된 상품 기준으로 판매가, 원가, 공급가와 공통 비용, 마켓별 비용을 관리합니다.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1">
            {[
              ['PER_ORDER', '건당 비용 기준'],
              ['AVERAGE_ALLOCATED', '평균 배분 비용 기준'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalculationMode(mode)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  calculationMode === mode
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {calculationMode === 'AVERAGE_ALLOCATED'
              ? '평균 배분 비용 기준은 최근 월 출고량을 우선 사용하고, 값이 없으면 실재고를 임시 분모로 사용합니다.'
              : '건당 비용 기준은 입력한 비용을 주문 1건당 비용으로 보고 계산합니다.'}
          </p>
        </div>

        <div className="inline-block rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            브랜드 필터
          </label>
          <div className="relative min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-primary">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full appearance-none cursor-pointer border-none bg-transparent py-2 pl-3 pr-12 text-sm font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">전체 브랜드</option>
              {brands.map((brand) => (
                <option key={brand.brandId} value={brand.brandId}>
                  {brand.brandName}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
              >
                <path
                  d="M3.5 6L8 10.5L12.5 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
        <SummaryCard label="수집 상품 수" value={Number(summary.totalProducts).toLocaleString('ko-KR')} />
        <SummaryCard label="기본 비용 설정 상품 수" value={Number(summary.configuredProducts).toLocaleString('ko-KR')} />
        <SummaryCard label="연결 마켓 수" value={Number(summary.connectedMarkets).toLocaleString('ko-KR')} />
        <SummaryCard label="총 실재고" value={Number(summary.totalRealStock).toLocaleString('ko-KR')} />
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-8 py-6">
          <h2 className="text-2xl font-black text-slate-900">수집 상품 비용 설정</h2>
        </div>

        {loading ? (
          <div className="px-8 py-16 text-center text-slate-500">비용 관리 데이터를 불러오는 중입니다.</div>
        ) : products.length === 0 ? (
          <div className="px-8 py-16 text-center text-slate-500">표시할 수집 상품이 없습니다.</div>
        ) : (
          <div className="space-y-4 px-6 py-6">
            {products.map((product) => {
              const draft = commonDrafts[product.productId] || {}
              const isExpandedRow = Boolean(expandedProducts[product.productId])
              const isCostDetailExpanded = Boolean(expandedCostDetails[product.productId])
              const costComponents = draft.costComponents || []
              const hasCostDetails = hasNamedCostComponent(costComponents)
              const costComponentTotal = getCostComponentTotal(costComponents)

              return (
                <article key={product.productId} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {product.brandName}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">SKU {product.skuCd || '-'}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-black text-slate-900">{product.productName}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {`PROD NO ${product.prodNo ?? '-'} · 실재고 ${Number(product.realStock ?? 0).toLocaleString('ko-KR')} · 안전재고 ${Number(product.safeStock ?? 0).toLocaleString('ko-KR')}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProducts((current) => ({
                            ...current,
                            [product.productId]: !current[product.productId],
                          }))
                        }
                        className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-base">
                          {isExpandedRow ? 'expand_less' : 'expand_more'}
                        </span>
                        마켓별 비용
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-7">
                    {[
                      ['salePrice', '판매가'],
                      ['costPrice', '원가'],
                      ['supplyPrice', '공급가'],
                      ['sgnaCost', '판관비'],
                      ['logisticsCost', '물류비'],
                      ['packagingCost', '포장비'],
                      ['otherCost', '기타 비용'],
                    ].map(([field, label]) => (
                      <label key={field} className="block">
                        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {label}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draft[field] ?? '0'}
                          onChange={(event) => updateCommonDraft(product.productId, field, event.target.value)}
                          readOnly={field === 'costPrice' && hasCostDetails}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
                        />
                        {field === 'costPrice' && hasCostDetails && (
                          <span className="mt-2 block text-[11px] font-medium text-emerald-600">
                            상세 입력 합산값이 자동 반영됩니다.
                          </span>
                        )}
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 px-6 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">원가 상세 입력</p>
                        <p className="mt-1 text-xs text-slate-500">
                          필름지, 원재료, 부자재처럼 세부 원가를 입력하면 원가가 자동 합산됩니다.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          상세 합계 {Number(hasCostDetails ? costComponentTotal : normalizeDraftNumber(draft.costPrice)).toLocaleString('ko-KR')}원
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCostDetails((current) => ({
                              ...current,
                              [product.productId]: !current[product.productId],
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-base">
                            {isCostDetailExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                          원가 상세 입력
                        </button>
                      </div>
                    </div>

                    {isCostDetailExpanded && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        {costComponents.length === 0 && (
                          <p className="text-sm text-slate-500">등록된 원가 상세 항목이 없습니다. 항목 추가 버튼으로 입력을 시작하세요.</p>
                        )}

                        {costComponents.map((component, index) => (
                          <div
                            key={`${product.productId}-cost-component-${index}`}
                            className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1.6fr_1fr_100px] lg:items-end"
                          >
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                항목명
                              </span>
                              <input
                                type="text"
                                value={component.componentName}
                                onChange={(event) => updateCostComponentDraft(product.productId, index, 'componentName', event.target.value)}
                                placeholder="예: 필름지, 밀가루, 포장재"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                금액
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={component.amount}
                                onChange={(event) => updateCostComponentDraft(product.productId, index, 'amount', event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => removeCostComponentDraft(product.productId, index)}
                              className="rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                            >
                              삭제
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addCostComponentDraft(product.productId)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                          원가 항목 추가
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleSaveCommonCosts(product.productId)}
                      disabled={savingCommonProductId === product.productId}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {savingCommonProductId === product.productId ? '저장 중' : '공통 비용 저장'}
                    </button>
                  </div>

                  {isExpandedRow && (
                    <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-6 py-6">
                      {shops.map((shop) => (
                        <ChannelCostEditor
                          key={`${product.productId}-${shop.shopId}`}
                          productId={product.productId}
                          shop={shop}
                          commonValue={draft}
                          calculationMode={calculationMode}
                          monthlyOutboundCount={product.monthlyOutboundCount ?? product.realStock ?? 0}
                          value={channelDrafts[product.productId]?.[shop.shopId] || {
                            channelFeeType: 'RATE',
                            channelFeeValue: '0',
                            adCost: '0',
                            returnExchangeCost: '0',
                          }}
                          saving={savingChannelKey === `${product.productId}-${shop.shopId}`}
                          onChange={updateChannelDraft}
                          onSave={handleSaveChannelCost}
                        />
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}



