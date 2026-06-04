import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveChannelSales,
  getExecutiveChannelSalesAnalytics,
  getNaverCpcPerformance,
  importPlayAutoChannelSales,
} from '../../api/executiveApi'
import { getBrands } from '../../api/salesApi'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

const toISO = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = new Date()
const ALL = '전체'
const CATEGORY_STORAGE_KEY = 'naeil.salesAnalysis.categories'

const BRAND_TREE = {
  하이프리: [
    { label: '프리하닭', keyword: '프리하닭' },
    { label: '단백깡', keyword: '깡' },
    { label: '프리당', keyword: '프리당' },
  ],
  국민한상: [
    { label: '국민돈까스', keyword: '돈까스' },
    { label: '삼겹살', keyword: '삼겹살' },
  ],
}

const DEFAULT_CATEGORIES = [
  '식품', '건강식품', '간편식', '축산/정육', '소스/양념', '패션의류잡화',
  '뷰티', '출산/유아동', '주방용품', '생활용품', '가구/홈데코', '가전/디지털',
  '스포츠/레저', '자동차용품', '도서',
]

function normalizeBrand(row) {
  const id = row?.id ?? row?.brandId ?? row?.brand_id ?? ''
  const name = row?.brand_name ?? row?.brandName ?? row?.name ?? ''
  return {
    ...row,
    id,
    brand_name: String(name || '').trim() || `브랜드 ${id}`,
  }
}

const METHOD_FILTERS = [
  { key: 'online', label: '판매자배송', icon: 'storefront' },
  { key: 'offline', label: '오프라인', icon: 'store' },
  { key: 'overseas', label: '해외', icon: 'flight_takeoff' },
  { key: 'b2b', label: 'B2B', icon: 'business_center' },
]

const sourceOptions = [
  { value: 'MANUAL', label: '온라인 직접 입력' },
  { value: 'OFFLINE', label: '오프라인 매출' },
  { value: 'OVERSEAS', label: '해외 매출' },
  { value: 'B2B', label: 'B2B 납품' },
]

const channelOptions = [
  { value: '스마트스토어', label: '스마트스토어' },
  { value: '공식몰', label: '공식몰' },
  { value: '쿠팡', label: '쿠팡' },
  { value: '오프라인', label: '오프라인' },
  { value: '오프라인 도매', label: '오프라인 도매' },
  { value: '오프라인 매장', label: '오프라인 매장' },
  { value: '해외 수출', label: '해외 수출' },
  { value: '쇼피', label: '쇼피' },
  { value: '아마존', label: '아마존' },
  { value: 'B2B 납품', label: 'B2B 납품' },
]

function getPreset(preset) {
  const t = new Date()
  switch (preset) {
    case 'today':
      return { start: toISO(t), end: toISO(t) }
    case 'yesterday': {
      const y = new Date(t)
      y.setDate(t.getDate() - 1)
      return { start: toISO(y), end: toISO(y) }
    }
    case 'last30': {
      const s = new Date(t)
      s.setDate(t.getDate() - 29)
      return { start: toISO(s), end: toISO(t) }
    }
    case 'last90': {
      const s = new Date(t)
      s.setDate(t.getDate() - 89)
      return { start: toISO(s), end: toISO(t) }
    }
    case 'monthly':
      return { start: toISO(new Date(t.getFullYear(), t.getMonth(), 1)), end: toISO(t) }
    case 'weekly':
    default: {
      const s = new Date(t)
      s.setDate(t.getDate() - 6)
      return { start: toISO(s), end: toISO(t) }
    }
  }
}

function sourceGroup(row) {
  const type = String(row.source_type || '').toUpperCase()
  const channel = String(row.channel_name || '')
  if (type === 'PLAYAUTO') return 'online'
  if (type === 'OFFLINE' || channel.includes('오프라인') || channel.includes('매장')) return 'offline'
  if (type === 'OVERSEAS' || channel.includes('해외') || channel.includes('수출') || channel.includes('쇼피') || channel.includes('아마존')) return 'overseas'
  if (type === 'B2B' || channel.includes('B2B') || channel.includes('납품')) return 'b2b'
  return 'online'
}

function computeManualSalesValues(values) {
  const salesAmount = Number(values.sales_amount || 0)
  const netProfit = Number(values.net_profit || 0)
  const orderCount = Number(values.order_count || 0)
  return {
    ...values,
    margin_rate: salesAmount > 0 && values.net_profit != null ? Number(((netProfit / salesAmount) * 100).toFixed(2)) : values.margin_rate || '',
    average_order_value: salesAmount > 0 && orderCount > 0 ? Math.round(salesAmount / orderCount) : values.average_order_value || '',
  }
}

function compactWon(value) {
  const amount = Number(value || 0)
  if (Math.abs(amount) >= 10000) return `${(amount / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`
  return amount.toLocaleString('ko-KR')
}

function shortDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value || '')
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function MetricCard({ icon, label, value, change = 0, active = false }) {
  const positive = Number(change) >= 0
  return (
    <div className={`relative min-h-[136px] border-r border-slate-200 px-5 py-4 last:border-r-0 ${active ? 'after:absolute after:inset-x-0 after:-bottom-3 after:mx-auto after:h-0 after:w-0 after:border-x-8 after:border-t-8 after:border-x-transparent after:border-t-blue-500' : ''}`}>
      <span className="material-symbols-outlined text-[20px] text-blue-500">{icon}</span>
      <p className="mt-2 text-3xl font-black leading-none text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-bold text-slate-600">{label}</p>
      <span className={`mt-3 inline-flex rounded px-2 py-1 text-xs font-bold ${positive ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
        {positive ? '↗' : '↘'} {Math.abs(Number(change)).toFixed(2)}%
      </span>
    </div>
  )
}

function TrendChart({ rows }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const points = rows.length ? rows : []
  const maxSales = Math.max(1, ...points.map((row) => Number(row.sales_amount || 0)))
  const maxOrders = Math.max(1, ...points.map((row) => Number(row.order_count || 0)))
  const width = 820
  const height = 240
  const padX = 52
  const padY = 28
  const xFor = (idx) => points.length <= 1 ? padX : padX + (idx / (points.length - 1)) * (width - padX * 2)
  const ySales = (value) => height - padY - (Number(value || 0) / maxSales) * (height - padY * 2)
  const yOrders = (value) => height - padY - (Number(value || 0) / maxOrders) * (height - padY * 2)
  const salesPath = points.map((row, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx)} ${ySales(row.sales_amount)}`).join(' ')
  const orderPath = points.map((row, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx)} ${yOrders(row.order_count)}`).join(' ')
  const hovered = hoverIndex != null ? points[hoverIndex] : null
  const tooltipX = hoverIndex != null ? Math.min(width - 210, Math.max(20, xFor(hoverIndex) + 12)) : 0
  const tooltipY = hovered ? Math.max(20, Math.min(ySales(hovered.sales_amount), yOrders(hovered.order_count)) - 78) : 0

  return (
    <section className="rounded border border-slate-200 bg-white p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-black text-slate-950">주문 & 실결제 매출 트렌드</h3>
          <span className="text-xs font-bold text-slate-400">PlayAuto pay_amt 일자별 집계</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1 text-orange-600"><span className="h-3 w-3 rounded bg-orange-500" />판매량</span>
          <span className="flex items-center gap-1 text-blue-600"><span className="h-3 w-3 rounded bg-blue-500" />실결제 매출</span>
        </div>
      </div>
      {points.length ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full overflow-visible">
          {[0, 1, 2, 3, 4].map((line) => {
            const y = padY + line * ((height - padY * 2) / 4)
            return <line key={line} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
          })}
          <path d={orderPath} fill="none" stroke="#f97316" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <path d={salesPath} fill="none" stroke="#2f6bff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((row, idx) => (
            <g key={`${row.sales_date}-${idx}`}>
              <rect
                x={idx === 0 ? 0 : xFor(idx) - ((width - padX * 2) / Math.max(points.length - 1, 1)) / 2}
                y="0"
                width={points.length <= 1 ? width : (width - padX * 2) / Math.max(points.length - 1, 1)}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              <circle cx={xFor(idx)} cy={ySales(row.sales_amount)} r="4" fill="#2f6bff" />
              <circle cx={xFor(idx)} cy={yOrders(row.order_count)} r="4" fill="#f97316" />
              <text x={xFor(idx)} y={height - 4} textAnchor="middle" className="fill-slate-400 text-[12px] font-bold">{shortDate(row.sales_date)}</text>
            </g>
          ))}
          {hovered && (
            <g pointerEvents="none">
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={padY} y2={height - padY} stroke="#94a3b8" strokeDasharray="4 4" />
              <rect x={tooltipX} y={tooltipY} width="190" height="72" rx="8" fill="#0f172a" opacity="0.94" />
              <text x={tooltipX + 12} y={tooltipY + 20} className="fill-white text-[12px] font-black">{shortDate(hovered.sales_date)}</text>
              <text x={tooltipX + 12} y={tooltipY + 42} className="fill-blue-200 text-[12px] font-bold">실결제 매출 {won(hovered.sales_amount)}</text>
              <text x={tooltipX + 12} y={tooltipY + 61} className="fill-orange-200 text-[12px] font-bold">주문 {count(hovered.order_count, '건')}</text>
            </g>
          )}
        </svg>
      ) : (
        <div className="flex h-[280px] items-center justify-center text-sm font-bold text-slate-400">선택 기간의 일자별 매출 데이터가 없습니다</div>
      )}
    </section>
  )
}

function DonutBreakdown({ channels }) {
  const top = [...channels].sort((a, b) => Number(b.sales_amount || 0) - Number(a.sales_amount || 0)).slice(0, 4)
  const total = top.reduce((sum, row) => sum + Number(row.sales_amount || 0), 0)
  const colors = ['#fdcb7a', '#2946d3', '#f97316', '#7c2d12']
  let acc = 0
  const gradient = total > 0
    ? top.map((row, idx) => {
      const start = acc
      const ratio = (Number(row.sales_amount || 0) / total) * 100
      acc += ratio
      return `${colors[idx]} ${start}% ${acc}%`
    }).join(', ')
    : '#e5e7eb 0% 100%'

  return (
    <section className="rounded border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-black text-slate-950">Top 유입경로 <span className="text-xs font-bold text-slate-500">by 매출</span></h3>
      <div className="mt-6 flex items-center justify-center">
        <div className="grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="h-20 w-20 rounded-full bg-white" />
        </div>
      </div>
      <div className="mt-6 space-y-2">
        {top.map((row, idx) => (
          <div key={`${row.source_type}-${row.channel_name}`} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3" style={{ backgroundColor: colors[idx] }} />
            <span className="flex-1 font-bold text-slate-700">{row.channel_name}</span>
            <span className="font-black text-slate-950">{total > 0 ? ((Number(row.sales_amount || 0) / total) * 100).toFixed(1) : '0.0'}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProductRow({ row }) {
  const sales = Number(row.sales_amount || 0)
  const orders = Number(row.order_count || 0)
  const averageOrderValue = orders > 0 ? Math.round(sales / orders) : 0
  const hasActualCost = Boolean(row.has_actual_cost)
  const profit = hasActualCost ? Number(row.actual_operating_profit || 0) : 0
  const margin = hasActualCost && sales > 0 ? (profit / sales) * 100 : 0
  return (
    <div className="grid grid-cols-1 items-center gap-5 border-t border-slate-100 px-5 py-5 xl:grid-cols-[minmax(320px,1.6fr)_minmax(420px,1fr)_220px]">
      <div>
        <p className="line-clamp-2 text-sm font-black text-slate-950">{row.product_name || '-'}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">브랜드 {row.brand_name || '-'} · SKU {row.sku || '-'}</p>
        <p className="mt-2 text-xs font-bold text-blue-600">{row.channel_name}</p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div><p className="text-xl font-black text-slate-950">{orders}</p><p className="text-xs font-bold text-slate-500">주문</p></div>
        <div><p className="text-xl font-black text-slate-950">{averageOrderValue.toLocaleString('ko-KR')}</p><p className="text-xs font-bold text-slate-500">객단가</p></div>
        <div><p className={`text-xl font-black ${hasActualCost ? (profit >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>{hasActualCost ? pct(margin) : '-'}</p><p className="text-xs font-bold text-slate-500">이익률</p></div>
      </div>
      <div className="border-slate-200 text-right xl:border-l xl:pl-6">
        <p className="text-sm font-bold text-slate-500">실결제 매출</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{sales.toLocaleString('ko-KR')}</p>
        <p className={`mt-3 text-xs font-bold ${hasActualCost ? (profit >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>
          {hasActualCost ? `실제 영업이익 ${won(profit)}` : '원가 미매칭'}
        </p>
      </div>
    </div>
  )
}

export default function ChannelSalesPage() {
  const initialPreset = getPreset('weekly')
  const [preset, setPreset] = useState('weekly')
  const [startDate, setStartDate] = useState(initialPreset.start)
  const [endDate, setEndDate] = useState(initialPreset.end)
  const [brands, setBrands] = useState([])
  const [selectedChannel, setSelectedChannel] = useState('쿠팡')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedProductGroup, setSelectedProductGroup] = useState('')
  const [searchText, setSearchText] = useState('')
  const [analytics, setAnalytics] = useState({ summary: {}, channels: [], products: [], trend: [] })
  const [manualRecords, setManualRecords] = useState([])
  const [selectedMethods, setSelectedMethods] = useState(['online'])
  const [openPanel, setOpenPanel] = useState('')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categoryAdmin, setCategoryAdmin] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingValue, setEditingValue] = useState('')
  const [sortBy, setSortBy] = useState('salesDesc')
  const [productFilter, setProductFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [naverCpc, setNaverCpc] = useState({ summary: {}, rows: [] })
  const [naverCpcLoading, setNaverCpcLoading] = useState(false)
  const [naverCpcError, setNaverCpcError] = useState('')
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const selectedBrandName = brands.find((b) => String(b.id) === String(selectedBrandId))?.brand_name || ''
  const productGroupOptions = BRAND_TREE[selectedBrandName] || []

  const loadAnalytics = (sd = startDate, ed = endDate, bid = selectedBrandId, query = searchText, group = selectedProductGroup, channel = selectedChannel) =>
    getExecutiveChannelSalesAnalytics({
      startDate: sd,
      endDate: ed,
      ...(channel ? { channel } : {}),
      ...(bid ? { brandId: bid } : {}),
      ...(query.trim() ? { search: query.trim() } : {}),
      ...(group ? { productGroup: group } : {}),
    }).then((res) => {
      setAnalytics(res.data || { summary: {}, channels: [], products: [], trend: [] })
      setLastUpdatedAt(new Date())
    })

  const loadManualRecords = () =>
    getExecutiveChannelSales().then((res) => {
      const rows = Array.isArray(res.data) ? res.data : []
      setManualRecords(rows.filter((r) => String(r.source_type || '').toUpperCase() !== 'PLAYAUTO'))
    })

  const naverCpcQuery = (query = searchText, group = selectedProductGroup, brandName = selectedBrandName) =>
    (query || group || brandName || '').trim()

  const loadNaverCpc = (from = startDate, to = endDate, query = searchText, group = selectedProductGroup, brandName = selectedBrandName) => {
    setNaverCpcLoading(true)
    setNaverCpcError('')
    const cpcQuery = naverCpcQuery(query, group, brandName)
    return getNaverCpcPerformance({ from, to, ...(cpcQuery ? { query: cpcQuery } : {}) })
      .then((res) => setNaverCpc(res.data || { summary: {}, rows: [] }))
      .catch((err) => {
        setNaverCpc({ summary: {}, rows: [] })
        setNaverCpcError(err?.response?.data?.message || '네이버 CPC 데이터 조회 실패')
      })
      .finally(() => setNaverCpcLoading(false))
  }

  useEffect(() => {
    getBrands(1).then((res) => {
      const rows = Array.isArray(res.data) ? res.data : []
      setBrands(rows.map(normalizeBrand).filter((brand) => brand.id && brand.brand_name))
    })
    loadAnalytics()
    loadNaverCpc()
    loadManualRecords()
    try {
      const saved = JSON.parse(window.localStorage.getItem(CATEGORY_STORAGE_KEY) || '[]')
      if (Array.isArray(saved) && saved.length) setCategories(saved)
    } catch {
      setCategories(DEFAULT_CATEGORIES)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadAnalytics(startDate, endDate, selectedBrandId, searchText, selectedProductGroup, selectedChannel)
      loadNaverCpc(startDate, endDate, searchText, selectedProductGroup, selectedBrandName)
    }, 350)
    return () => window.clearTimeout(id)
  }, [searchText])

  useEffect(() => {
    if (!autoSync) return undefined
    const id = window.setInterval(() => {
      loadAnalytics(startDate, endDate, selectedBrandId, searchText, selectedProductGroup, selectedChannel)
        .catch((err) => setMessage(err?.response?.data?.message || '화면 갱신 실패'))
    }, 15000)
    return () => window.clearInterval(id)
  }, [autoSync, startDate, endDate, selectedBrandId, searchText, selectedProductGroup, selectedChannel])

  function applyPreset(nextPreset) {
    setPreset(nextPreset)
    if (nextPreset === 'custom') return
    const range = getPreset(nextPreset)
    setStartDate(range.start)
    setEndDate(range.end)
    loadAnalytics(range.start, range.end, selectedBrandId, searchText, selectedProductGroup, selectedChannel)
    loadNaverCpc(range.start, range.end, searchText, selectedProductGroup, selectedBrandName)
  }

  function handleChannelChange(channel) {
    setSelectedChannel(channel)
    loadAnalytics(startDate, endDate, selectedBrandId, searchText, selectedProductGroup, channel)
  }

  function handleBrandChange(bid) {
    const nextBrandName = brands.find((b) => String(b.id) === String(bid))?.brand_name || ''
    setSelectedBrandId(bid)
    setSelectedProductGroup('')
    loadAnalytics(startDate, endDate, bid, searchText, '', selectedChannel)
    loadNaverCpc(startDate, endDate, searchText, '', nextBrandName)
  }

  function handleProductGroupChange(keyword) {
    setSelectedProductGroup(keyword)
    loadAnalytics(startDate, endDate, selectedBrandId, searchText, keyword, selectedChannel)
    loadNaverCpc(startDate, endDate, searchText, keyword, selectedBrandName)
  }

  function toggleMethod(key) {
    setSelectedMethods((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])
  }

  function addCategory() {
    const value = newCategory.trim()
    if (!value || categories.includes(value)) return
    setCategories((prev) => [...prev, value])
    setNewCategory('')
  }

  function saveCategory(oldValue) {
    const value = editingValue.trim()
    if (!value) return
    setCategories((prev) => prev.map((item) => item === oldValue ? value : item))
    if (selectedCategory === oldValue) setSelectedCategory(value)
    setEditingCategory('')
    setEditingValue('')
  }

  function deleteCategory(value) {
    setCategories((prev) => prev.filter((item) => item !== value))
    if (selectedCategory === value) setSelectedCategory('')
  }

  async function handleImport() {
    setImporting(true)
    setMessage('')
    try {
      const res = await importPlayAutoChannelSales({ startDate, endDate })
      await loadAnalytics(startDate, endDate, selectedBrandId, searchText, selectedProductGroup, selectedChannel)
      setMessage(`PlayAuto ${count((res.data || {}).upsertedCount || 0, '건')} 반영 완료`)
    } catch (err) {
      setMessage(err?.response?.data?.message || 'PlayAuto 반영 실패')
    } finally {
      setImporting(false)
    }
  }

  const channels = analytics.channels || []
  const products = analytics.products || []
  const trend = analytics.trend || []
  const summary = analytics.summary || {}

  const filteredChannels = useMemo(() =>
    channels.filter((row) => selectedMethods.length === 0 || selectedMethods.includes(sourceGroup(row))),
  [channels, selectedMethods])

  const filteredProducts = useMemo(() => {
    let rows = [...products]
    if (productFilter === 'sold') rows = rows.filter((row) => Number(row.sales_amount || 0) > 0)
    if (productFilter === 'unsold') rows = rows.filter((row) => Number(row.sales_amount || 0) <= 0)
    rows.sort((a, b) => {
      if (sortBy === 'orderDesc') return Number(b.order_count || 0) - Number(a.order_count || 0)
      if (sortBy === 'profitDesc') {
        const profitA = a.has_actual_cost ? a.actual_operating_profit : a.estimated_operating_profit
        const profitB = b.has_actual_cost ? b.actual_operating_profit : b.estimated_operating_profit
        return Number(profitB || 0) - Number(profitA || 0)
      }
      return Number(b.sales_amount || 0) - Number(a.sales_amount || 0)
    })
    return rows
  }, [products, productFilter, sortBy])

  const sourceSummary = useMemo(() => {
    const base = { online: { sales: 0, orders: 0 }, offline: { sales: 0, orders: 0 }, overseas: { sales: 0, orders: 0 }, b2b: { sales: 0, orders: 0 } }
    channels.forEach((row) => {
      const group = sourceGroup(row)
      base[group].sales += Number(row.sales_amount || 0)
      base[group].orders += Number(row.order_count || 0)
    })
    return base
  }, [channels])

  const soldProducts = products.filter((row) => Number(row.sales_amount || 0) > 0).length
  const unsoldProducts = Math.max(0, products.length - soldProducts)
  const lastUpdatedText = lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'

  return (
    <div className="space-y-7 bg-white text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-blue-600">monitoring</span>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">판매 분석</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-3 py-1.5 text-xs font-black ${autoSync ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
            {autoSync ? '화면 자동 갱신중' : '수동 갱신'}
          </span>
          <button onClick={() => setAutoSync((v) => !v)} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-black text-slate-700">자동 갱신 전환</button>
          <button onClick={handleImport} disabled={importing} className="rounded border border-blue-500 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 disabled:opacity-50">
            {importing ? 'PlayAuto 매출 수집 중...' : 'PlayAuto 매출 수집'}
          </button>
        </div>
      </header>

      <section className="relative flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-5">
        <div className="flex flex-wrap items-center gap-0">
          <button onClick={() => setOpenPanel(openPanel === 'method' ? '' : 'method')} className="h-11 rounded-l border border-slate-300 bg-white px-4 text-sm font-black text-slate-950">
            🛍 {METHOD_FILTERS.filter((item) => selectedMethods.includes(item.key)).map((item) => item.label).join(' + ') || '판매방식'}⌄
          </button>
          <button onClick={() => setOpenPanel(openPanel === 'category' ? '' : 'category')} className="h-11 border-y border-r border-slate-300 bg-white px-4 text-sm font-black text-slate-950">
            {selectedCategory || '카테고리'}⌄
          </button>
          <button onClick={() => setOpenPanel(openPanel === 'date' ? '' : 'date')} className="h-11 rounded-r border-y border-r border-slate-300 bg-white px-4 text-sm font-black text-slate-950">
            {preset === 'weekly' ? '최근 7일' : preset === 'monthly' ? '월간' : preset === 'today' ? '오늘' : preset === 'yesterday' ? '어제' : preset === 'last30' ? '최근 30일' : preset === 'last90' ? '최근 90일' : '직접 선택'} 📅
          </button>
        </div>

        <div className="flex min-w-[360px] max-w-[560px] flex-1 items-center justify-end">
          <select value={selectedChannel} onChange={(e) => handleChannelChange(e.target.value)} className="h-11 border border-r-0 border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">
            <option value="">전체 채널</option>
            {channelOptions.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
          </select>
          <select value={selectedBrandId} onChange={(e) => handleBrandChange(e.target.value)} className="h-11 border border-r-0 border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">
            <option value="">전체 브랜드</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.brand_name}</option>)}
          </select>
          <select value={selectedProductGroup} onChange={(e) => handleProductGroupChange(e.target.value)} disabled={!productGroupOptions.length} className="h-11 border border-r-0 border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 disabled:bg-slate-50">
            <option value="">{selectedBrandId ? '전체 세부 브랜드' : '메인 브랜드 먼저 선택'}</option>
            {productGroupOptions.map((group) => <option key={group.label} value={group.keyword}>{group.label}</option>)}
          </select>
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="브랜드, 제품명, SKU 검색" className="h-11 min-w-0 flex-1 rounded-r border border-slate-300 px-4 text-sm font-bold outline-none focus:border-blue-500" />
        </div>

        {openPanel === 'method' && (
          <div className="absolute left-0 top-[66px] z-20 w-[380px] rounded border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <p className="font-black">판매방식 선택</p>
              <button onClick={() => setOpenPanel('')} className="text-2xl leading-none">×</button>
            </div>
            {METHOD_FILTERS.map((item) => (
              <label key={item.key} className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-4 py-4 text-sm font-black">
                <span className="flex items-center gap-3"><span className="material-symbols-outlined text-blue-500">{item.icon}</span>{item.label}</span>
                <input type="checkbox" checked={selectedMethods.includes(item.key)} onChange={() => toggleMethod(item.key)} className="h-4 w-4 accent-blue-600" />
              </label>
            ))}
            <div className="flex justify-between p-4">
              <button onClick={() => setSelectedMethods([])} className="rounded border border-slate-300 px-6 py-2 text-sm font-black">초기화</button>
              <button onClick={() => setOpenPanel('')} className="rounded bg-blue-600 px-8 py-2 text-sm font-black text-white">선택</button>
            </div>
          </div>
        )}

        {openPanel === 'category' && (
          <div className="absolute left-0 top-[66px] z-20 w-[min(970px,calc(100vw-80px))] rounded border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <p className="font-black">카테고리 선택</p>
                <button onClick={() => setCategoryAdmin((v) => !v)} className={`rounded border px-3 py-1 text-xs font-black ${categoryAdmin ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}>관리자 모드</button>
              </div>
              <button onClick={() => setOpenPanel('')} className="text-2xl leading-none">×</button>
            </div>
            <div className="grid max-h-[360px] grid-cols-[190px_1fr] overflow-hidden p-4">
              <div className="overflow-y-auto border-r border-slate-200 pr-3">
                {categories.map((category) => (
                  <button key={category} onClick={() => setSelectedCategory(category)} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold ${selectedCategory === category ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    {category}<span>›</span>
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto px-5">
                {categoryAdmin ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="새 카테고리명" className="h-10 flex-1 rounded border border-slate-300 px-3 text-sm font-bold" />
                      <button onClick={addCategory} className="rounded bg-blue-600 px-4 text-sm font-black text-white">추가</button>
                    </div>
                    {categories.map((category) => (
                      <div key={category} className="flex items-center gap-2 rounded border border-slate-200 p-3">
                        {editingCategory === category ? (
                          <>
                            <input value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="h-9 flex-1 rounded border border-slate-300 px-3 text-sm font-bold" />
                            <button onClick={() => saveCategory(category)} className="rounded bg-blue-600 px-3 py-2 text-xs font-black text-white">저장</button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-black text-slate-800">{category}</span>
                            <button onClick={() => { setEditingCategory(category); setEditingValue(category) }} className="rounded border border-slate-300 px-3 py-2 text-xs font-black">수정</button>
                          </>
                        )}
                        <button onClick={() => deleteCategory(category)} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600">삭제</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {categories.map((category) => (
                      <button key={category} onClick={() => { setSelectedCategory(category); setOpenPanel('') }} className="rounded border border-slate-200 px-4 py-3 text-left text-sm font-black hover:border-blue-400 hover:bg-blue-50">{category}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 p-4">
              <button onClick={() => setSelectedCategory('')} className="rounded border border-slate-300 px-6 py-2 text-sm font-black">초기화</button>
            </div>
          </div>
        )}

        {openPanel === 'date' && (
          <div className="absolute left-0 top-[66px] z-20 w-[700px] rounded border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <p className="font-black">날짜 선택</p>
              <button onClick={() => setOpenPanel('')} className="text-2xl leading-none">×</button>
            </div>
            <div className="flex flex-wrap gap-3 p-4">
              {[
                ['today', '오늘'], ['yesterday', '어제'], ['weekly', '최근 7일'],
                ['last30', '최근 30일'], ['last90', '최근 90일'], ['monthly', '월간'], ['custom', '직접 선택'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => applyPreset(key)} className={`rounded-full border px-5 py-2 text-sm font-black ${preset === key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-700'}`}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-3 border-t border-slate-100 p-4">
              <input type="date" value={startDate} onChange={(e) => { setPreset('custom'); setStartDate(e.target.value) }} className="h-10 rounded border border-slate-300 px-3 text-sm font-bold" />
              <span className="text-slate-400">~</span>
              <input type="date" value={endDate} onChange={(e) => { setPreset('custom'); setEndDate(e.target.value) }} className="h-10 rounded border border-slate-300 px-3 text-sm font-bold" />
              <button onClick={() => { loadAnalytics(startDate, endDate, selectedBrandId, searchText, selectedProductGroup, selectedChannel); loadNaverCpc(startDate, endDate, searchText, selectedProductGroup, selectedBrandName); setOpenPanel('') }} className="ml-auto rounded bg-blue-600 px-6 py-2 text-sm font-black text-white">{startDate} ~ {endDate} 선택 완료</button>
            </div>
          </div>
        )}
      </section>

      {message && <p className={`text-sm font-black ${message.includes('실패') ? 'text-rose-600' : 'text-emerald-700'}`}>{message}</p>}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_290px]">
        <div className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard icon="payments" label="실결제 매출" value={Number(summary.salesAmount || 0).toLocaleString('ko-KR')} change={0} active />
            <MetricCard icon="inventory_2" label="주문" value={count(summary.orderCount || 0)} change={0} />
            <MetricCard icon="receipt_long" label="객단가" value={won(summary.averageOrderValue || 0)} change={0} />
            <MetricCard icon="campaign" label="네이버 CPC 광고비" value={won(naverCpc.summary?.cost || 0)} change={0} />
            <MetricCard icon="account_balance_wallet" label="실제 영업이익" value={won(summary.actualOperatingProfit || 0)} change={0} />
            <MetricCard icon="percent" label="실제 이익률" value={pct(summary.actualOperatingMargin || 0)} change={0} />
          </div>
        </div>
        <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-950">네이버 CPC 성과</h3>
            <span className="material-symbols-outlined">chevron_right</span>
          </div>
          {naverCpcLoading ? (
            <p className="mt-4 text-sm font-bold text-slate-400">네이버 CPC 조회 중...</p>
          ) : naverCpcError ? (
            <p className="mt-4 text-sm font-bold text-rose-600">{naverCpcError}</p>
          ) : Number(naverCpc.summary?.cost || 0) <= 0 && Number(naverCpc.summary?.impressions || 0) <= 0 ? (
            <p className="mt-4 text-sm font-bold text-slate-400">선택 기간 네이버 CPC 데이터 없음</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between"><span className="font-bold text-slate-600">광고 매출</span><b>{compactWon(naverCpc.summary?.conversionValue)}</b></p>
              <p className="flex justify-between"><span className="font-bold text-slate-600">집행 광고비</span><b>{compactWon(naverCpc.summary?.cost)}</b></p>
              <p className="flex justify-between"><span className="font-bold text-slate-600">노출 / 클릭</span><b>{count(naverCpc.summary?.impressions)} / {count(naverCpc.summary?.clicks)}</b></p>
              <p className="flex justify-between"><span className="font-bold text-slate-600">CTR / CPC</span><b>{pct(naverCpc.summary?.ctr)} / {won(naverCpc.summary?.avgCpc)}</b></p>
              <p className="flex justify-between"><span className="font-bold text-slate-600">ROAS</span><b>{pct(naverCpc.summary?.roas)}</b></p>
            </div>
          )}
        </section>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <TrendChart rows={trend} />
        <DonutBreakdown channels={filteredChannels} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-black text-slate-950">옵션목록 (총 {products.length})</h2>
            <span className="text-sm font-bold text-slate-500">{preset === 'weekly' ? '최근 7일' : `${startDate} ~ ${endDate}`}</span>
          </div>
          <div className="flex gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded border border-slate-300 bg-white px-3 text-sm font-black">
              <option value="salesDesc">매출높은 순</option>
              <option value="orderDesc">주문많은 순</option>
              <option value="profitDesc">이익높은 순</option>
            </select>
            <button className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-black text-emerald-700">엑셀 다운로드⌄</button>
          </div>
        </div>
        <div className="flex">
          {[
            ['all', `전체`],
            ['sold', `판매된 옵션 (${soldProducts})`],
            ['unsold', `판매 없는 옵션 (${unsoldProducts})`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setProductFilter(key)} className={`min-w-[150px] border border-slate-300 px-8 py-3 text-sm font-black ${productFilter === key ? 'bg-blue-600 text-white' : 'bg-white text-slate-800'}`}>{label}</button>
          ))}
        </div>
        <div className="rounded border border-slate-200 bg-white">
          <div className="grid grid-cols-1 gap-5 px-5 py-4 text-xs font-black text-slate-500 xl:grid-cols-[minmax(280px,1.6fr)_minmax(520px,1.4fr)_220px]">
            <span>옵션</span>
            <span className="text-center">주문 및 이익 <span className="font-bold text-slate-400">최근 갱신 {lastUpdatedText}</span></span>
            <span className="text-right">실결제 매출</span>
          </div>
          {filteredProducts.length ? filteredProducts.map((row) => <ProductRow key={`${row.channel_name}-${row.sku}-${row.product_name}`} row={row} />) : (
            <div className="border-t border-slate-100 py-14 text-center text-sm font-bold text-slate-400">선택 조건에 맞는 옵션이 없습니다</div>
          )}
        </div>
      </section>

      <details className="rounded border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-black text-slate-800">오프라인 / 해외 / B2B 매출 직접 입력</summary>
        {manualRecords.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">채널</th><th>구분</th><th>기준일</th><th>매출</th><th>영업이익</th><th /></tr></thead>
              <tbody>
                {manualRecords.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-3 font-bold">{row.channel_name}</td>
                    <td>{row.source_type}</td>
                    <td>{String(row.report_month || '').slice(0, 10)}</td>
                    <td>{won(row.sales_amount)}</td>
                    <td>{won(row.net_profit)}</td>
                    <td className="text-right">
                      <button
                        onClick={async () => {
                          if (!window.confirm('이 매출 기록을 삭제할까요?')) return
                          setDeletingId(row.id)
                          await deleteExecutiveRecord('channel-sales', row.id)
                          await loadManualRecords()
                          setDeletingId(null)
                        }}
                        disabled={deletingId === row.id}
                        className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black text-rose-600 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5">
          <RecordForm
            title="매출 직접 입력"
            fields={[
              { name: 'source_type', label: '매출 구분', type: 'select', required: true, options: sourceOptions },
              { name: 'channel_name', label: '채널명', type: 'select', required: true, options: channelOptions },
              { name: 'report_month', label: '기준일', type: 'date', required: true },
              { name: 'sales_amount', label: '실제 매출', type: 'number', required: true },
              { name: 'net_profit', label: '영업이익', type: 'number' },
              { name: 'margin_rate', label: '마진율 자동계산', type: 'number', readOnly: true },
              { name: 'order_count', label: '주문/거래 수', type: 'number' },
              { name: 'average_order_value', label: '객단가 자동계산', type: 'number', readOnly: true },
              { name: 'ad_cost', label: '광고비', type: 'number' },
              { name: 'roas', label: 'ROAS', type: 'number' },
            ]}
            initialValues={{ source_type: 'OFFLINE', channel_name: '오프라인', report_month: toISO(today) }}
            computeValues={computeManualSalesValues}
            submitLabel="매출 반영"
            onSubmit={async (values) => {
              await createExecutiveRecord('channel-sales', values)
              await loadManualRecords()
              await loadAnalytics(startDate, endDate, selectedBrandId, searchText, selectedProductGroup)
            }}
          />
        </div>
      </details>
    </div>
  )
}
