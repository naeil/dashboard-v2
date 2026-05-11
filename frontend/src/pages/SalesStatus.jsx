import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks
} from 'date-fns'
import { getBrands, getProductMarketSales, getProductSales, getShopSales, getSummary, getTrend, refreshTodaySales } from '../api/salesApi'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const KRW = (value) => `₩${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}`

const PLATFORM_COLORS = {
  NAVER_SMARTSTORE: '#2DB400',
  COUPANG: '#E42828',
  GMARKET: '#2B66FF',
  ELEVEN_STREET: '#FF3333',
  AUCTION: '#E60023',
  IMWEB: '#111827',
  LOTTE_ON: '#DC2626',
  KAKAO_TALK_STORE: '#FEE500',
  NONGSAN_SHOPPINGMALL: '#94A3B8',
  OTHER: '#94A3B8'
}

const PLATFORM_LABELS = {
  NAVER_SMARTSTORE: '스마트스토어',
  COUPANG: '쿠팡',
  GMARKET: '지마켓',
  ELEVEN_STREET: '11번가',
  AUCTION: '옥션',
  IMWEB: '아임웹',
  LOTTE_ON: '롯데ON',
  KAKAO_TALK_STORE: '카카오톡 스토어',
  NONGSAN_SHOPPINGMALL: '기타',
  OTHER: '기타'
}

const VIEW_TYPES = ['DAY', 'WEEK', 'MONTH', 'CUSTOM']
const TREND_GRANULARITIES = ['DAY', 'WEEK', 'MONTH']

function toAlphaColor(hex, alpha = 0.12) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(148, 163, 184, ${alpha})`

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex

  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function resolveShopPlatform(shop) {
  const platform = String(shop?.platform ?? '').toUpperCase()
  if (platform && PLATFORM_COLORS[platform]) return platform

  const name = String(shop?.shopName ?? '').toLowerCase()
  const code = String(shop?.shopCode ?? '').toUpperCase()

  if (name.includes('스마트스토어') || code === 'A077') return 'NAVER_SMARTSTORE'
  if (name.includes('쿠팡') || code === 'B378') return 'COUPANG'
  if (name.includes('지마켓') || code === 'A006') return 'GMARKET'
  if (name.includes('11번가') || code === 'A112') return 'ELEVEN_STREET'
  if (name.includes('옥션') || code === 'A001') return 'AUCTION'
  if (name.includes('아임웹') || code === 'B005') return 'IMWEB'
  if (name.includes('롯데') || code === 'A524') return 'LOTTE_ON'
  if (name.includes('카카오') || code === 'B688') return 'KAKAO_TALK_STORE'

  return 'OTHER'
}
function toDateInputValue(date) {
  return format(date, 'yyyy-MM-dd')
}

function normalizeRange(start, end) {
  return start <= end ? { start, end } : { start: end, end: start }
}

function getInitialCustomRange() {
  const end = new Date()
  const start = subDays(end, 6)

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end)
  }
}

function getInitialDailyDate() {
  return toDateInputValue(new Date())
}

function getInitialWeeklyDate() {
  return toDateInputValue(new Date())
}

function getInitialMonthlyValue() {
  return format(new Date(), 'yyyy-MM')
}

function parseDailyDate(dailyDate, fallbackDate) {
  if (!dailyDate) return fallbackDate

  const parsed = parseISO(dailyDate)
  if (Number.isNaN(parsed.getTime())) return fallbackDate

  return parsed
}

function parseMonthlyDate(monthlyValue, fallbackDate) {
  if (!monthlyValue) return fallbackDate

  const parsed = parseISO(`${monthlyValue}-01`)
  if (Number.isNaN(parsed.getTime())) return fallbackDate

  return parsed
}

function isSameYearMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function parseCustomRange(customRange) {
  if (!customRange?.start || !customRange?.end) return null

  const start = parseISO(customRange.start)
  const end = parseISO(customRange.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  return normalizeRange(start, end)
}

function getPresetMetricRange(viewType, now) {
  if (viewType === 'MONTH') return { start: subMonths(now, 1), end: now }
  if (viewType === 'WEEK') return { start: subDays(now, 6), end: now }
  return { start: now, end: now }
}

function getMetricRange(viewType, now, dailyDate, customRange) {
  if (viewType === 'DAY') {
    const selectedDate = parseDailyDate(dailyDate, now)
    return { start: selectedDate, end: selectedDate }
  }
  if (viewType === 'WEEK') {
    const selectedDate = parseDailyDate(dailyDate, now)
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const end = start <= now && now <= endOfWeek(start, { weekStartsOn: 1 })
      ? now
      : endOfWeek(start, { weekStartsOn: 1 })
    return { start, end }
  }
  if (viewType === 'MONTH') {
    const selectedMonth = parseMonthlyDate(customRange?.monthValue, now)
    const start = startOfMonth(selectedMonth)
    const end = isSameYearMonth(selectedMonth, now) ? now : endOfMonth(selectedMonth)
    return { start, end }
  }
  if (viewType === 'CUSTOM') return parseCustomRange(customRange)
  return getPresetMetricRange(viewType, now)
}

function getPreviousRangeForMetricRange(metricRange) {
  const totalDays = differenceInCalendarDays(metricRange.end, metricRange.start) + 1
  return {
    start: subDays(metricRange.start, totalDays),
    end: subDays(metricRange.start, 1)
  }
}

function getPreviousMetricRange(viewType, now, dailyDate, customRange) {
  if (viewType === 'DAY') {
    const selectedDate = parseDailyDate(dailyDate, now)
    return {
      start: subDays(selectedDate, 1),
      end: subDays(selectedDate, 1)
    }
  }

  if (viewType === 'WEEK' || viewType === 'MONTH') {
    const metricRange = getMetricRange(viewType, now, dailyDate, customRange)
    return metricRange ? getPreviousRangeForMetricRange(metricRange) : null
  }

  if (viewType === 'CUSTOM') {
    const metricRange = getMetricRange(viewType, now, dailyDate, customRange)
    return metricRange ? getPreviousRangeForMetricRange(metricRange) : null
  }

  if (viewType === 'MONTH') {
    return { start: subMonths(now, 2), end: subDays(subMonths(now, 1), 1) }
  }
  if (viewType === 'WEEK') {
    return { start: subDays(now, 13), end: subDays(now, 7) }
  }

  return { start: subDays(now, 1), end: subDays(now, 1) }
}

function getTrendGranularityForRange(start, end) {
  const totalDays = differenceInCalendarDays(end, start) + 1

  if (totalDays <= 45) return 'DAY'
  if (totalDays <= 180) return 'WEEK'
  return 'MONTH'
}

function getTrendRange(viewType, now, dailyDate, customRange, customTrendGranularity) {
  if (viewType === 'DAY') {
    const selectedDate = parseDailyDate(dailyDate, now)
    return {
      start: subDays(selectedDate, 9),
      end: selectedDate,
      granularity: 'DAY'
    }
  }

  if (viewType === 'WEEK') {
    const metricRange = getMetricRange(viewType, now, dailyDate, customRange)
    if (!metricRange) return null

    return {
      start: startOfWeek(subWeeks(metricRange.end, 7), { weekStartsOn: 1 }),
      end: metricRange.end,
      granularity: 'WEEK'
    }
  }

  if (viewType === 'MONTH') {
    const metricRange = getMetricRange(viewType, now, dailyDate, customRange)
    if (!metricRange) return null

    return {
      start: startOfMonth(subMonths(metricRange.end, 7)),
      end: metricRange.end,
      granularity: 'MONTH'
    }
  }

  if (viewType === 'CUSTOM') {
    const metricRange = getMetricRange(viewType, now, dailyDate, customRange)
    if (!metricRange) return null

    const granularity = customTrendGranularity || getTrendGranularityForRange(metricRange.start, metricRange.end)

    if (granularity === 'MONTH') {
      return {
        start: startOfMonth(metricRange.start),
        end: metricRange.end,
        granularity
      }
    }

    if (granularity === 'WEEK') {
      return {
        start: startOfWeek(metricRange.start, { weekStartsOn: 1 }),
        end: metricRange.end,
        granularity
      }
    }

    return {
      start: metricRange.start,
      end: metricRange.end,
      granularity
    }
  }

  return {
    start: subDays(now, 9),
    end: now,
    granularity: 'DAY'
  }
}

function getMetricPeriodLabel(viewType, now, dailyDate, customRange) {
  const metricRange = getMetricRange(viewType, now, dailyDate, customRange)
  if (!metricRange) return '-'

  const { start, end } = metricRange
  if (viewType === 'DAY' || differenceInCalendarDays(end, start) === 0) {
    return format(end, 'M/d')
  }

  return `${format(start, 'M/d')}~${format(end, 'M/d')}`
}

function buildTrendBuckets(granularity, start, end) {
  if (granularity === 'MONTH') {
    const buckets = []
    for (let cursor = startOfMonth(start); cursor <= end; cursor = addMonths(cursor, 1)) {
      buckets.push(format(cursor, 'yyyy-MM-dd'))
    }
    return buckets
  }

  if (granularity === 'WEEK') {
    const buckets = []
    for (let cursor = startOfWeek(start, { weekStartsOn: 1 }); cursor <= end; cursor = addWeeks(cursor, 1)) {
      buckets.push(format(cursor, 'yyyy-MM-dd'))
    }
    return buckets
  }

  const buckets = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    buckets.push(format(cursor, 'yyyy-MM-dd'))
  }
  return buckets
}

function formatTrendLabel(granularity, bucket, rangeStart, rangeEnd) {
  const date = parseISO(bucket)
  if (granularity === 'MONTH') return format(date, 'yyyy/MM')
  if (granularity === 'WEEK') {
    const bucketEnd = addDays(date, 6)
    const resolvedStart = rangeStart && rangeStart > date && rangeStart <= bucketEnd ? rangeStart : date
    const resolvedEnd = rangeEnd && rangeEnd >= date && rangeEnd < bucketEnd ? rangeEnd : bucketEnd
    return `${format(resolvedStart, 'M/d')}~${format(resolvedEnd, 'M/d')}`
  }
  return format(date, 'MM/dd')
}

function getGrowthLabel(viewType) {
  if (viewType === 'CUSTOM') return '직전 동일 기간 대비 성장'
  if (viewType === 'MONTH') return '직전 1개월 대비 성장'
  if (viewType === 'WEEK') return '직전 1주 대비 성장'
  return '전일 대비 성장'
}

export default function SalesStatus({ isExpanded }) {
  const [companyId] = useState(1)
  const [viewType, setViewType] = useState('DAY')
  const [selectedBrand, setSelectedBrand] = useState('ALL')
  const [dailyDate, setDailyDate] = useState(() => getInitialDailyDate())
  const [weeklyDate, setWeeklyDate] = useState(() => getInitialWeeklyDate())
  const [monthlyValue, setMonthlyValue] = useState(() => getInitialMonthlyValue())
  const [customRange, setCustomRange] = useState(() => getInitialCustomRange())
  const [customTrendGranularity, setCustomTrendGranularity] = useState('DAY')
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [shops, setShops] = useState([])
  const [brands, setBrands] = useState([])
  const [trendData, setTrendData] = useState({ labels: [], datasets: [] })
  const [trendGranularity, setTrendGranularity] = useState('DAY')
  const [growthInfo, setGrowthInfo] = useState({ label: '전일 대비 성장', value: null })
  const [visibleCount, setVisibleCount] = useState(10)
  const [selectedProductMarketDetail, setSelectedProductMarketDetail] = useState(null)
  const [productMarketSales, setProductMarketSales] = useState([])
  const [isProductMarketSalesLoading, setIsProductMarketSalesLoading] = useState(false)
  const [productMarketSalesError, setProductMarketSalesError] = useState(null)
  const [isRefreshingTodaySales, setIsRefreshingTodaySales] = useState(false)
  const [refreshNotice, setRefreshNotice] = useState(null)
  const [trendTooltip, setTrendTooltip] = useState({
    visible: false,
    title: '',
    x: 0,
    y: 0,
    items: []
  })
  const trendTooltipHoverRef = useRef(false)

  const fetchAll = useCallback(async () => {
    try {
      const now = new Date()
      const brandId = selectedBrand === 'ALL' ? null : Number(selectedBrand)
      const anchorDate = viewType === 'WEEK' ? weeklyDate : dailyDate
      const rangeContext = viewType === 'MONTH' ? { ...customRange, monthValue: monthlyValue } : customRange
      const metricRange = getMetricRange(viewType, now, anchorDate, rangeContext)
      const previousMetricRange = getPreviousMetricRange(viewType, now, anchorDate, rangeContext)
      const trendRange = getTrendRange(viewType, now, anchorDate, rangeContext, customTrendGranularity)

      if (!metricRange || !previousMetricRange || !trendRange) {
        return
      }

      const [summaryRes, previousSummaryRes, productRes, shopRes, trendRes] = await Promise.all([
        getSummary(companyId, metricRange.start, metricRange.end, brandId),
        getSummary(companyId, previousMetricRange.start, previousMetricRange.end, brandId),
        getProductSales(companyId, metricRange.start, metricRange.end, brandId),
        getShopSales(companyId, metricRange.start, metricRange.end, brandId),
        getTrend(companyId, trendRange.start, trendRange.end, trendRange.granularity, brandId)
      ])

      setSummary(summaryRes.data)
      setProducts(productRes.data || [])
      setShops(shopRes.data || [])

      const currentGross = Number(summaryRes.data?.totalGrossAmount ?? 0)
      const previousGross = Number(previousSummaryRes.data?.totalGrossAmount ?? 0)
      const growthValue = previousGross > 0 ? ((currentGross - previousGross) / previousGross) * 100 : null

      setGrowthInfo({
        label: getGrowthLabel(viewType),
        value: growthValue
      })

      const rawTrend = trendRes.data || []
      const buckets = buildTrendBuckets(trendRange.granularity, trendRange.start, trendRange.end)
      const platforms = [...new Set(rawTrend.map((item) => item.platform))]
      const trendValueMap = new Map(
        rawTrend.map((item) => [`${item.date}|${item.platform}`, Math.round(Number(item.netRevenue ?? 0))])
      )

      const datasets = platforms.map((platform) => ({
        label: platform,
        data: buckets.map((bucket) => trendValueMap.get(`${bucket}|${platform}`) ?? 0),
        backgroundColor: PLATFORM_COLORS[platform] || '#94A3B8',
        borderRadius: 4
      }))

      setTrendData({
        labels: buckets.map((value) => formatTrendLabel(trendRange.granularity, value, metricRange.start, trendRange.end)),
        datasets
      })
      setTrendGranularity(trendRange.granularity)
    } catch (error) {
      console.error('Sales dashboard API error:', error)
    }
  }, [companyId, customRange, customTrendGranularity, dailyDate, monthlyValue, selectedBrand, viewType, weeklyDate])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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
    setVisibleCount(10)
  }, [dailyDate, monthlyValue, selectedBrand, viewType, weeklyDate, customRange.start, customRange.end])

  useEffect(() => {
    if (!refreshNotice) return undefined

    const timeoutId = window.setTimeout(() => setRefreshNotice(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [refreshNotice])

  const nonZeroShops = useMemo(
    () => [...shops]
      .filter((shop) => Number(shop.totalNetRevenue ?? 0) > 0)
      .sort((a, b) => Number(b.totalNetRevenue ?? 0) - Number(a.totalNetRevenue ?? 0)),
    [shops]
  )

  const totalShopRevenue = useMemo(
    () => nonZeroShops.reduce((sum, shop) => sum + Number(shop.totalNetRevenue ?? 0), 0),
    [nonZeroShops]
  )

  const currentMetricRange = useMemo(() => {
    const now = new Date()
    const anchorDate = viewType === 'WEEK' ? weeklyDate : dailyDate
    const rangeContext = viewType === 'MONTH' ? { ...customRange, monthValue: monthlyValue } : customRange
    return getMetricRange(viewType, now, anchorDate, rangeContext)
  }, [customRange, dailyDate, monthlyValue, viewType, weeklyDate])

  const metricPeriodLabel = useMemo(
    () => {
      const anchorDate = viewType === 'WEEK' ? weeklyDate : dailyDate
      const rangeContext = viewType === 'MONTH' ? { ...customRange, monthValue: monthlyValue } : customRange
      return getMetricPeriodLabel(viewType, new Date(), anchorDate, rangeContext)
    },
    [customRange, dailyDate, monthlyValue, viewType, weeklyDate]
  )

  const isTodayDailyView = useMemo(
    () => viewType === 'DAY' && dailyDate === getInitialDailyDate(),
    [dailyDate, viewType]
  )

  const marketShareData = useMemo(() => ({
    labels: nonZeroShops.map((shop) => shop.shopName),
    datasets: [
      {
        data: nonZeroShops.map((shop) => Number(shop.totalNetRevenue ?? 0)),
        backgroundColor: nonZeroShops.map((shop) => PLATFORM_COLORS[resolveShopPlatform(shop)] || '#94A3B8'),
        borderWidth: 0,
        hoverOffset: 8,
        cutout: '68%'
      }
    ]
  }), [nonZeroShops])

  const handleTrendTooltip = useCallback((context) => {
    const { chart, tooltip } = context

    if (!tooltip || tooltip.opacity === 0) {
      if (trendTooltipHoverRef.current) return
      setTrendTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      return
    }

    const items = (tooltip.dataPoints || [])
      .filter((point) => Number(point.parsed?.y ?? 0) > 0)
      .map((point) => ({
        label: PLATFORM_LABELS[point.dataset.label] || point.dataset.label,
        value: KRW(point.parsed.y),
        color: point.dataset.backgroundColor,
        backgroundColor: toAlphaColor(point.dataset.backgroundColor)
      }))

    if (items.length === 0) {
      if (trendTooltipHoverRef.current) return
      setTrendTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      return
    }

    setTrendTooltip({
      visible: true,
      title: tooltip.title?.[0] || '',
      x: chart.canvas.offsetLeft + tooltip.caretX + 16,
      y: chart.canvas.offsetTop + tooltip.caretY - 16,
      items
    })
  }, [])

  const handleRefreshTodaySales = useCallback(async () => {
    if (isRefreshingTodaySales) return

    setIsRefreshingTodaySales(true)
    setRefreshNotice(null)

    try {
      const response = await refreshTodaySales(companyId)
      await fetchAll()
      setRefreshNotice({
        type: 'success',
        message: response.data?.message || '오늘 주문 재수집이 완료되었습니다.'
      })
    } catch (error) {
      setRefreshNotice({
        type: 'error',
        message: error.response?.data?.message || '오늘 주문 재수집에 실패했습니다.'
      })
    } finally {
      setIsRefreshingTodaySales(false)
    }
  }, [companyId, fetchAll, isRefreshingTodaySales])

  const handleOpenProductMarketDetail = useCallback(async (product) => {
    if (!currentMetricRange) return

    setSelectedProductMarketDetail(product)
    setIsProductMarketSalesLoading(true)
    setProductMarketSalesError(null)

    try {
      const response = await getProductMarketSales(
        product.productId,
        companyId,
        currentMetricRange.start,
        currentMetricRange.end
      )
      setProductMarketSales(response.data || [])
    } catch (error) {
      console.error('Product market detail API error:', error)
      setProductMarketSales([])
      setProductMarketSalesError('마켓별 비교 데이터를 불러오지 못했습니다.')
    } finally {
      setIsProductMarketSalesLoading(false)
    }
  }, [companyId, currentMetricRange])

  const closeProductMarketDetail = useCallback(() => {
    setSelectedProductMarketDetail(null)
    setProductMarketSales([])
    setProductMarketSalesError(null)
    setIsProductMarketSalesLoading(false)
  }, [])

  useEffect(() => {
    closeProductMarketDetail()
  }, [closeProductMarketDetail, selectedBrand, dailyDate, weeklyDate, monthlyValue, customRange.start, customRange.end, viewType])

  const selectedProductCostSnapshot = useMemo(
    () => (productMarketSales.length > 0 ? productMarketSales[0] : null),
    [productMarketSales]
  )

  const selectedProductMarketSummary = useMemo(() => (
    productMarketSales.reduce((accumulator, item) => ({
      totalGrossAmount: accumulator.totalGrossAmount + Number(item.totalGrossAmount ?? 0),
      totalNetRevenue: accumulator.totalNetRevenue + Number(item.totalNetRevenue ?? 0),
      totalShippingFee: accumulator.totalShippingFee + Number(item.totalShippingFee ?? 0),
      totalOrderCount: accumulator.totalOrderCount + Number(item.totalOrderCount ?? 0),
      profitAmount: accumulator.profitAmount + Number(item.profitAmount ?? 0),
    }), {
      totalGrossAmount: 0,
      totalNetRevenue: 0,
      totalShippingFee: 0,
      totalOrderCount: 0,
      profitAmount: 0,
    })
  ), [productMarketSales])

  return (
    <main className={`min-h-screen p-8 transition-all duration-300 ${isExpanded ? 'ml-64' : 'ml-20'}`}>
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-black tracking-tight text-primary">매출 현황</h1>
          <p className="break-keep text-sm text-on-surface-variant">브랜드별 전체 매출과 상품별 실적을 한눈에 확인합니다.</p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-[34px] shrink-0 items-center overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary">
              <span className="material-symbols-outlined pl-3 text-sm text-slate-400">storefront</span>
              <select
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value)}
                className="mr-2 h-full cursor-pointer border-none bg-transparent pl-2 pr-10 text-xs font-bold text-slate-700 outline-none focus:ring-0"
              >
                <option value="ALL">전체 브랜드</option>
                {brands.map((brand) => (
                  <option key={brand.brandId} value={brand.brandId}>
                    {brand.brandName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap rounded-lg bg-surface-container p-1">
              {VIEW_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setViewType(type)}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                    viewType === type
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {type === 'DAY' && '일간'}
                  {type === 'WEEK' && '주간'}
                  {type === 'MONTH' && '월간'}
                  {type === 'CUSTOM' && '직접 선택'}
                </button>
              ))}
            </div>
          </div>

          {false && viewType === 'DAY' && (
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(event) => setDailyDate(event.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-primary"
                />
                <button
                  onClick={() => setDailyDate(getInitialDailyDate())}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  오늘
                </button>
              </div>
            </div>
          )}

          {viewType === 'CUSTOM' && (
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(event) => setCustomRange((prev) => ({ ...prev, start: event.target.value }))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-primary"
                />
                <span className="text-sm text-slate-400">~</span>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(event) => setCustomRange((prev) => ({ ...prev, end: event.target.value }))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-primary"
                />
                <button
                  onClick={() => setCustomRange(getInitialCustomRange())}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  최근 7일                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-12 items-stretch gap-6">
        <div className="relative col-span-12 flex min-h-[240px] flex-col justify-between overflow-hidden rounded-xl bg-primary p-8 text-on-primary lg:col-span-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tracking-wide text-primary-fixed-dim">누적 총 매출액</span>
              <span className="text-sm font-medium text-primary-fixed">({metricPeriodLabel})</span>
              {viewType === 'DAY' && (
                <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-primary-fixed transition-colors hover:bg-white/20">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  <input
                    type="date"
                    value={dailyDate}
                    onChange={(event) => setDailyDate(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="일간 날짜 선택"
                  />
                </label>
              )}
              {viewType === 'WEEK' && (
                <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-primary-fixed transition-colors hover:bg-white/20">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  <input
                    type="date"
                    value={weeklyDate}
                    max={getInitialWeeklyDate()}
                    onChange={(event) => setWeeklyDate(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="주간 날짜 선택"
                  />
                </label>
              )}
              {viewType === 'MONTH' && (
                <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-primary-fixed transition-colors hover:bg-white/20">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  <input
                    type="month"
                    value={monthlyValue}
                    max={getInitialMonthlyValue()}
                    onChange={(event) => setMonthlyValue(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="월간 월 선택"
                  />
                </label>
              )}
              {isTodayDailyView && (
                <button
                  type="button"
                  onClick={handleRefreshTodaySales}
                  disabled={isRefreshingTodaySales}
                  className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold transition-colors ${
                    isRefreshingTodaySales
                      ? 'cursor-not-allowed bg-white/10 text-white/50'
                      : 'bg-white/10 text-primary-fixed hover:bg-white/20'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[16px] ${isRefreshingTodaySales ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  <span>{isRefreshingTodaySales ? '수집 중...' : '오늘 주문 새로고침'}</span>
                </button>
              )}
            </div>
            <h2 className="mt-2 text-[1.9rem] font-black leading-tight sm:text-[2.25rem] lg:text-[2.7rem] xl:text-[3.05rem] 2xl:text-[3.35rem]">
              {summary ? KRW(summary.totalGrossAmount) : '₩0'}
            </h2>
            {refreshNotice && (
              <p
                className={`mt-3 text-xs font-semibold ${
                  refreshNotice.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {refreshNotice.message}
              </p>
            )}
          </div>

          <div className="relative z-10 mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1800px]:grid-cols-4">
            <div className="flex min-h-[128px] flex-col justify-between rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="break-keep text-[0.72rem] font-semibold text-primary-fixed-dim sm:text-[0.78rem] lg:text-[0.84rem]">
                배송비 제외 매출액
              </p>
              <p className="overflow-hidden text-[0.92rem] font-black leading-none text-primary-fixed sm:text-[1rem] lg:text-[1.15rem] xl:text-[1.28rem] 2xl:text-[1.42rem]">
                {summary ? KRW(summary.totalNetRevenue) : '₩0'}
              </p>
            </div>
            <div className="flex min-h-[128px] flex-col justify-between rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="break-keep text-[0.72rem] font-semibold text-primary-fixed-dim sm:text-[0.78rem] lg:text-[0.84rem]">
                배송비 합계
              </p>
              <p className="overflow-hidden text-[0.92rem] font-black leading-none text-primary-fixed sm:text-[1rem] lg:text-[1.15rem] xl:text-[1.28rem] 2xl:text-[1.42rem]">
                {summary ? KRW(summary.totalShippingFee) : '₩0'}
              </p>
            </div>
            <div className="flex min-h-[128px] flex-col justify-between rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="break-keep text-[0.72rem] font-semibold text-primary-fixed-dim sm:text-[0.78rem] lg:text-[0.84rem]">수익</p>
              <p className="overflow-hidden text-[0.92rem] font-black leading-none text-primary-fixed sm:text-[1rem] lg:text-[1.15rem] xl:text-[1.28rem] 2xl:text-[1.42rem]">
                {summary ? KRW(summary.profitAmount) : '₩0'}
              </p>
            </div>
            <div className="flex min-h-[128px] flex-col justify-between rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="break-keep text-[0.72rem] font-semibold text-primary-fixed-dim sm:text-[0.78rem] lg:text-[0.84rem]">
                {growthInfo.label}
              </p>
              <p
                className={`flex items-center text-[0.9rem] font-black leading-none sm:text-[1rem] lg:text-[1.1rem] xl:text-[1.24rem] 2xl:text-[1.42rem] ${
                  growthInfo.value === null
                    ? 'text-slate-300'
                    : growthInfo.value >= 0
                      ? 'text-green-400'
                      : 'text-rose-300'
                }`}
              >
                {growthInfo.value !== null && (
                  <span className="material-symbols-outlined mr-1 text-[0.72rem] sm:text-[0.8rem] lg:text-[0.9rem]">
                    {growthInfo.value >= 0 ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                )}
                {growthInfo.value === null ? '-' : `${Math.abs(growthInfo.value).toFixed(1)}%`}
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-6">
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="mb-1 block text-xs font-semibold text-on-surface-variant">광고 환산 매출액</span>
                <p className="text-xl font-bold text-slate-400">-</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5">
            <div>
              <span className="mb-1 block text-xs font-semibold text-on-surface-variant">객단가</span>
              <p className="text-xl font-bold text-primary">
                {summary && Number(summary.totalCustomerCount ?? 0) > 0
                  ? KRW(Number(summary.totalGrossAmount ?? 0) / Number(summary.totalCustomerCount ?? 0))
                  : '₩0'}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-rose-100 bg-rose-50/50 p-5">
            <div>
              <div className="flex items-start justify-between">
                <span className="mb-1 block text-xs font-semibold text-rose-600">주문 취소</span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-600">
                  {summary?.cancelCount || 0}건                </span>
              </div>
              <p className="text-xl font-bold text-rose-700">{summary ? KRW(summary.totalCancelAmount || 0) : '₩0'}</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-orange-100 bg-orange-50/50 p-5">
            <div>
              <span className="mb-1 block text-xs font-semibold text-orange-600">주문고객 / 주문건수</span>
            </div>
            <p className="text-xl font-bold text-orange-700">
              {(summary?.totalCustomerCount || 0).toLocaleString('ko-KR')}명/ {(summary?.totalOrderCount || 0).toLocaleString('ko-KR')}건            </p>
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                <span className="material-symbols-outlined">insights</span>
              </div>
              <div>
                <p className="text-sm font-bold">실시간 분석 인사이트</p>
                <p className="text-xs text-on-surface-variant">
                  현재 상위 마켓은 {nonZeroShops[0]?.shopName || '데이터 없음'}이고, 브랜드 필터에 따라 추이와 매출 비중이 함께 바뀝니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-12 items-stretch gap-6">
        <div className="col-span-12 flex h-full flex-col rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-8 pb-5 pt-8 xl:col-span-8">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="shrink-0 whitespace-nowrap text-lg font-bold text-primary">매출 추이 분석</h3>
                {viewType === 'CUSTOM' && (
                  <div className="inline-flex w-fit items-center self-start bg-transparent px-0 py-0 xl:self-auto">
                    <div className="flex rounded-full bg-surface-container p-1">
                      {TREND_GRANULARITIES.map((granularity) => (
                        <button
                          key={granularity}
                          onClick={() => setCustomTrendGranularity(granularity)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                            customTrendGranularity === granularity
                              ? 'bg-surface-container-lowest text-primary shadow-sm'
                              : 'text-on-surface-variant hover:text-primary'
                          }`}
                        >
                          {granularity === 'DAY' ? '일별' : granularity === 'WEEK' ? '주별' : '월별'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
              {trendData.datasets.map((dataset) => (
                <div
                  key={dataset.label}
                  className="inline-flex items-center gap-3 whitespace-nowrap rounded-full bg-surface-container px-3 py-1.5"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: dataset.backgroundColor }}></span>
                  <span className="text-xs font-medium">
                    {PLATFORM_LABELS[dataset.label] || dataset.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[350px] flex-1">
            <Bar
              className="!h-full !w-full"
              style={{ height: '100%', width: '100%' }}
              data={trendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: false,
                    mode: 'index',
                    intersect: false,
                    external: handleTrendTooltip
                  }
                },
                scales: {
                  x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                      font: { size: trendGranularity === 'DAY' ? 9 : 10 },
                      autoSkip: trendGranularity === 'DAY' ? false : trendData.labels.length > 14,
                      maxTicksLimit: trendGranularity === 'DAY' ? undefined : (trendData.labels.length > 14 ? 12 : undefined),
                      maxRotation: trendGranularity === 'DAY' ? 55 : 0,
                      minRotation: trendGranularity === 'DAY' ? 55 : 0,
                      padding: trendGranularity === 'DAY' ? 6 : 4
                    }
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                      font: { size: 10 },
                      callback: (value) => `${Math.round(value / 10000).toLocaleString('ko-KR')}만`
                    }
                  }
                }
              }}
            />

            {trendTooltip.visible && (
              <div
                className="pointer-events-auto absolute z-20 max-h-[260px] min-w-[300px] max-w-[380px] overflow-y-auto rounded-xl px-4 py-3 text-white shadow-2xl ring-1 backdrop-blur-md"
                style={{
                  backgroundColor: '#D9E2F2',
                  borderColor: '#B7C4DA',
                  left: `${trendTooltip.x}px`,
                  top: `${trendTooltip.y}px`,
                  transform: 'translate(0, -100%)'
                }}
                onMouseEnter={() => {
                  trendTooltipHoverRef.current = true
                }}
                onMouseLeave={() => {
                  trendTooltipHoverRef.current = false
                  setTrendTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
                }}
                onWheel={(event) => {
                  event.stopPropagation()
                }}
              >
                <div className="mb-3 border-b pb-2 text-sm font-bold" style={{ borderColor: '#B7C4DA', color: '#0F172A' }}>
                  {trendTooltip.title}
                </div>

                <div className="space-y-1">
                  {trendTooltip.items.map((item) => (
                    <div
                      key={`${trendTooltip.title}-${item.label}`}
                      className="flex items-center justify-between gap-4 px-1 py-1"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm border border-white/70"
                          style={{ backgroundColor: item.color }}
                        ></span>
                        <span className="whitespace-nowrap text-sm font-semibold" style={{ color: '#0F172A' }}>{item.label}</span>
                      </div>
                      <span className="whitespace-nowrap text-sm font-bold" style={{ color: '#0F172A' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 flex flex-col rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-8 pb-5 pt-8 xl:col-span-4">
          <div className="mb-6 flex items-start justify-between shrink-0">
            <div>
              <h3 className="text-lg font-bold text-primary">마켓플레이스 비중</h3>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-on-surface-variant">전체 매출</p>
              <p className="text-lg font-black text-primary">{summary ? KRW(summary.totalGrossAmount) : '₩0'}</p>
            </div>
          </div>

          <div className="relative mx-auto mb-8 h-56 w-56 shrink-0">
            <Doughnut
              data={marketShareData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label(context) {
                        const value = Number(context.parsed ?? 0)
                        const ratio = totalShopRevenue > 0 ? ((value / totalShopRevenue) * 100).toFixed(1) : '0.0'
                        return `${context.label}: ${KRW(value)} (${ratio}%)`
                      }
                    }
                  }
                }
              }}
            />
          </div>

          <div className="flex flex-1 flex-col">
            <div className={`space-y-4 ${nonZeroShops.length > 3 ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
              {nonZeroShops.map((shop) => (
                <div key={shop.shopId} className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLORS[resolveShopPlatform(shop)] || '#94A3B8' }}
                    ></div>
                    <span className="text-sm font-bold">{shop.shopName}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black">{KRW(shop.totalNetRevenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-surface-container px-8 py-6">
          <h3 className="text-lg font-bold text-primary">상품별 실적 상세</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-center">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">상품명 / ID</th>
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">총 매출액</th>
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">객단가</th>
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">주문건수</th>
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {products.slice(0, visibleCount).map((product) => (
                <tr
                  key={product.productId}
                  className="group cursor-pointer transition-colors hover:bg-surface-container-low"
                  onClick={() => handleOpenProductMarketDetail(product)}
                >
                  <td className="px-8 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-sm font-bold text-primary">{product.productName}</p>
                      <p className="text-[11px] text-on-surface-variant">{product.externalProductId || '-'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-sm font-medium text-on-surface-variant">{KRW(product.totalGrossAmount)}</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-sm font-medium text-on-surface-variant">{KRW(product.averageOrderValue)}</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-sm font-black text-primary">
                      {Number(product.totalOrderCount ?? 0).toLocaleString('ko-KR')}건                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleOpenProductMarketDetail(product)
                      }}
                      className="rounded-full p-2 transition-colors hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length > visibleCount && (
          <div className="flex justify-center border-t border-surface-container bg-surface-bright/50 px-8 py-6">
            <button
              onClick={() => setVisibleCount((prev) => prev + 10)}
              className="flex items-center space-x-2 rounded-full bg-surface-container-high px-6 py-2.5 text-xs font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-white active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>더보기(현재 {visibleCount}/{products.length})</span>
            </button>
          </div>
        )}
      </div>

      {selectedProductMarketDetail && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[920px] flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">오픈마켓별 비교</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{selectedProductMarketDetail.productName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  SKU {selectedProductMarketDetail.externalProductId || '-'} · {metricPeriodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProductMarketDetail}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">총 매출액</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{KRW(selectedProductMarketSummary.totalGrossAmount)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">배송비 제외 매출</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{KRW(selectedProductMarketSummary.totalNetRevenue)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">배송비 합계</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{KRW(selectedProductMarketSummary.totalShippingFee)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">수익</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{KRW(selectedProductMarketSummary.profitAmount)}</p>
                </div>
              </div>

              {selectedProductCostSnapshot && (
                <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-lg font-black text-slate-900">상품 공통 비용 기준</h4>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                      주문 {selectedProductMarketSummary.totalOrderCount.toLocaleString('ko-KR')}건 기준
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
                    {[
                      ['판매가', selectedProductCostSnapshot.salePrice],
                      ['원가', selectedProductCostSnapshot.costPrice],
                      ['공급가', selectedProductCostSnapshot.supplyPrice],
                      ['판관비', selectedProductCostSnapshot.sgnaCost],
                      ['물류비', selectedProductCostSnapshot.logisticsCost],
                      ['포장비', selectedProductCostSnapshot.packagingCost],
                      ['기타 비용', selectedProductCostSnapshot.otherCost],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{KRW(value)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h4 className="text-lg font-black text-slate-900">마켓별 매출 및 비용 비교</h4>
                </div>

                {isProductMarketSalesLoading ? (
                  <div className="px-6 py-16 text-center text-slate-500">마켓별 비교 데이터를 불러오는 중입니다.</div>
                ) : productMarketSalesError ? (
                  <div className="px-6 py-16 text-center text-rose-500">{productMarketSalesError}</div>
                ) : productMarketSales.length === 0 ? (
                  <div className="px-6 py-16 text-center text-slate-500">표시할 마켓별 실적이 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-white">
                        <tr className="border-b border-slate-200">
                          {['마켓', '총 매출액', '배송비 제외', '배송비', '주문건수', '객단가', '기본 비용', '수수료', '광고비', '반품/교환비', '수익'].map((label) => (
                            <th key={label} className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productMarketSales.map((item) => (
                          <tr key={`${item.shopId}-${item.shopCode}`} className="bg-white">
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-bold text-slate-900">{item.shopName}</span>
                                <span className="text-[11px] text-slate-500">{item.shopCode}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center text-sm font-bold text-slate-900">{KRW(item.totalGrossAmount)}</td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">{KRW(item.totalNetRevenue)}</td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">{KRW(item.totalShippingFee)}</td>
                            <td className="px-4 py-4 text-center text-sm font-bold text-slate-900">{Number(item.totalOrderCount ?? 0).toLocaleString('ko-KR')}건</td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">{KRW(item.averageOrderValue)}</td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">{KRW(item.baseCostAmount)}</td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">
                              <div className="flex flex-col items-center">
                                <span>{KRW(item.channelFeeAmount)}</span>
                                <span className="text-[11px] text-slate-400">
                                  {item.channelFeeType === 'FIXED' ? `고정 ${KRW(item.channelFeeValue)}` : `${Number(item.channelFeeValue ?? 0).toLocaleString('ko-KR')}%`}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">
                              <div className="flex flex-col items-center">
                                <span>{KRW(item.adCostAmount)}</span>
                                <span className="text-[11px] text-slate-400">설정값 {KRW(item.adCost)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center text-sm text-slate-600">
                              <div className="flex flex-col items-center">
                                <span>{KRW(item.returnExchangeCostAmount)}</span>
                                <span className="text-[11px] text-slate-400">설정값 {KRW(item.returnExchangeCost)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center text-sm font-black text-slate-900">{KRW(item.profitAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}




