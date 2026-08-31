import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://naeil-dashboard.onrender.com'
const api = axios.create({ baseURL: `${API_BASE}/api` })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dashboard_auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const CHANNELS = [
  { id: 'hifree', name: '하이프리 스마트스토어', brand: '하이프리', color: 'sky', storeUrl: 'https://smartstore.naver.com/hifree' },
  { id: 'gukmin', name: '국민한상 스마트스토어', brand: '국민한상', color: 'emerald', storeUrl: 'https://smartstore.naver.com/gukmin' },
]

const SENTIMENT_LABELS = { POSITIVE: '긍정', NEUTRAL: '중립', NEGATIVE: '부정' }
const SENTIMENT_COLORS = { POSITIVE: 'text-emerald-600 bg-emerald-50', NEUTRAL: 'text-slate-600 bg-slate-100', NEGATIVE: 'text-red-600 bg-red-50' }
const STATUS_LABELS = { READY: '자동승인', REVIEW_REQUIRED: '검토필요', MANAGER_REQUIRED: '담당자필요', PENDING: '대기중' }
const STATUS_COLORS = { READY: 'bg-emerald-100 text-emerald-700', REVIEW_REQUIRED: 'bg-yellow-100 text-yellow-700', MANAGER_REQUIRED: 'bg-red-100 text-red-700', PENDING: 'bg-slate-100 text-slate-600' }

function getChannelStoreUrl(channelName) {
  const ch = CHANNELS.find(c => channelName?.includes(c.brand))
  return ch?.storeUrl || null
}

function getReviewDirectUrl(review) {
  const storeUrl = getChannelStoreUrl(review.channel)
  if (!storeUrl) return null
  if (review.productName) {
    return `${storeUrl}/products/search?query=${encodeURIComponent(review.productName)}`
  }
  return storeUrl
}

function formatCustomerName(name) {
  if (!name || name === '고객**') return null
  return name
}

function formatReviewDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return dateStr
  }
}

function SatisfactionCharts({ stats, channel }) {
  if (!stats) return null
  const key = channel === 'hifree' ? '하이프리' : channel === 'gukmin' ? '국민한상' : 'total'
  const s = stats[key] || stats.total
  if (!s) return null
  const rating = s.rating || {}
  const ratingTotal = ['5', '4', '3', '2', '1'].reduce((a, k) => a + Number(rating[k] || 0), 0)
  const sen = s.sentiment || {}
  const pos = Number(sen.POSITIVE || 0)
  const neu = Number(sen.NEUTRAL || 0)
  const neg = Number(sen.NEGATIVE || 0)
  const senTotal = pos + neu + neg
  if (ratingTotal === 0) return null
  const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0)
  const label = channel === 'hifree' ? '하이프리' : channel === 'gukmin' ? '국민한상' : '전체'
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-black text-slate-800">별점 분포 <span className="font-bold text-slate-400">— {label} {ratingTotal.toLocaleString()}건</span></p>
        <div className="mt-3 space-y-2">
          {['5', '4', '3', '2', '1'].map((k) => {
            const v = Number(rating[k] || 0)
            return (
              <div key={k} className="flex items-center gap-2" title={`${k}점 ${v.toLocaleString()}건 (${pct(v, ratingTotal)}%)`}>
                <span className="w-8 shrink-0 text-right text-[12px] font-bold text-slate-500">★ {k}</span>
                <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(v > 0 ? 1.5 : 0, (v / ratingTotal) * 100)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-[12px] font-bold text-slate-600">{v.toLocaleString()}건 <span className="text-slate-400">({pct(v, ratingTotal)}%)</span></span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-black text-slate-800">만족 · 불만족 <span className="font-bold text-slate-400">— AI 감성 분석</span></p>
        <div className="mt-4 flex h-5 w-full gap-0.5 overflow-hidden rounded-full">
          {pos > 0 && <div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${(pos / senTotal) * 100}%` }} title={`긍정 ${pos.toLocaleString()}건`} />}
          {neu > 0 && <div className="h-full bg-slate-300" style={{ width: `${(neu / senTotal) * 100}%` }} title={`중립 ${neu.toLocaleString()}건`} />}
          {neg > 0 && <div className="h-full rounded-r-full bg-rose-500" style={{ width: `${(neg / senTotal) * 100}%` }} title={`부정 ${neg.toLocaleString()}건`} />}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-emerald-50 px-2 py-2.5">
            <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />만족 (4~5점)</p>
            <p className="mt-1 text-lg font-black text-emerald-600">{pct(pos, senTotal)}%</p>
            <p className="text-[11px] font-bold text-slate-400">{pos.toLocaleString()}건</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-2.5">
            <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500"><span className="h-2 w-2 rounded-full bg-slate-300" />중립 (3점)</p>
            <p className="mt-1 text-lg font-black text-slate-600">{pct(neu, senTotal)}%</p>
            <p className="text-[11px] font-bold text-slate-400">{neu.toLocaleString()}건</p>
          </div>
          <div className="rounded-lg bg-rose-50 px-2 py-2.5">
            <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500"><span className="h-2 w-2 rounded-full bg-rose-500" />불만족 (1~2점)</p>
            <p className="mt-1 text-lg font-black text-rose-600">{pct(neg, senTotal)}%</p>
            <p className="text-[11px] font-bold text-slate-400">{neg.toLocaleString()}건</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, colorClass }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-2xl ${colorClass || 'text-sky-500'}`}>{icon}</span>
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ review, analysis }) {
  const [showReply, setShowReply] = useState(false)
  const isUrgent = analysis?.isUrgent
  const isMock = review.reviewId && review.reviewId.startsWith('MOCK_')
  const customerDisplayName = formatCustomerName(review.customerName)
  const reviewDate = formatReviewDate(review.reviewDate)
  const directUrl = getReviewDirectUrl(review)
  const isHifree = review.channel?.includes('하이프리')

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${isUrgent ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isHifree ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isHifree ? '하이프리' : '국민한상'}
            </span>
            {isMock && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700 border border-amber-200">
                <span className="material-symbols-outlined text-sm">science</span>테스트 데이터
              </span>
            )}
            {isUrgent && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-700">
                <span className="material-symbols-outlined text-sm">warning</span>긴급
              </span>
            )}
            <span className="text-xs text-slate-400">{review.productName}</span>
          </div>
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < review.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
            ))}
            <div className="flex items-center gap-1 ml-1">
              {customerDisplayName ? (
                <span className="text-xs font-bold text-slate-700">{customerDisplayName}</span>
              ) : (
                <span className="text-xs text-slate-400">
                  {review.orderNumber ? `주문 ${review.orderNumber}` : '고객'}
                </span>
              )}
              {reviewDate && (
                <span className="text-xs text-slate-300">· {reviewDate}</span>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-700 line-clamp-2">{review.reviewContent}</p>
          {directUrl && (
            <div className="mt-2">
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1 transition-colors ${isHifree ? 'text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'}`}
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                스마트스토어에서 직접 확인
              </a>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {analysis?.sentiment && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SENTIMENT_COLORS[analysis.sentiment]}`}>
              {SENTIMENT_LABELS[analysis.sentiment]}
            </span>
          )}
          {analysis?.replyStatus && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[analysis.replyStatus]}`}>
              {STATUS_LABELS[analysis.replyStatus]}
            </span>
          )}
        </div>
      </div>
      {analysis?.keywords && (
        <div className="mt-2 flex flex-wrap gap-1">
          {analysis.keywords.split(',').filter(Boolean).map((kw, i) => (
            <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">#{kw.trim()}</span>
          ))}
        </div>
      )}
      {analysis?.replyDraft && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowReply(!showReply)}
            className="text-xs font-bold text-sky-600 hover:text-sky-700">
            {showReply ? '▲ 답변 초안 접기' : '▼ AI 답변 초안 보기'}
          </button>
          {showReply && (
            <div className="mt-2 rounded-lg bg-sky-50 border border-sky-100 p-3">
              <p className="text-xs text-slate-700">{analysis.replyDraft}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VocChart({ vocData, brand }) {
  if (!vocData) return null
  const items = Object.entries(vocData).slice(0, 5)
  const total = items.reduce((s, [, v]) => s + v, 0)
  return (
    <div>
      <h4 className="text-sm font-black text-slate-700 mb-2">{brand} VOC 키워드</h4>
      <div className="space-y-2">
        {items.map(([key, val]) => {
          const pct = total > 0 ? Math.round((val / total) * 100) : 0
          return (
            <div key={key}>
              <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                <span className="font-bold">#{key}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AIReviewCenterPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [activeChannel, setActiveChannel] = useState('all')
  const [page, setPage] = useState(0)
  const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0 })
  const [dashboardData, setDashboardData] = useState(null)
  const [reviews, setReviews] = useState([])
  const [analyses, setAnalyses] = useState({})
  const [vocData, setVocData] = useState(null)
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [uploadChannel, setUploadChannel] = useState('하이프리 스마트스토어')
  const [uploadResult, setUploadResult] = useState(null)
  const [alerts, setAlerts] = useState([])

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get('/reviews/dashboard')
      if (res.data?.data) {
        setDashboardData(res.data.data)
        const reviewList = res.data.data.recentReviews || []
        setReviews(reviewList)
        const analysisMap = {}
        if (res.data.data.analyses) {
          res.data.data.analyses.forEach(a => { analysisMap[a.reviewId] = a })
        }
        setAnalyses(analysisMap)
        const urgentCount = reviewList.filter(r => analysisMap[r.id]?.isUrgent).length
        const negativeCount = reviewList.filter(r => analysisMap[r.id]?.sentiment === 'NEGATIVE').length
        const mockCount = reviewList.filter(r => r.reviewId?.startsWith('MOCK_')).length
        const newAlerts = []
        if (urgentCount > 0) newAlerts.push({ type: 'urgent', text: `긴급 리뷰 ${urgentCount}건 발생`, color: 'red' })
        if (negativeCount > 0) newAlerts.push({ type: 'negative', text: `부정 리뷰 ${negativeCount}건`, color: 'orange' })
        if (mockCount > 0) newAlerts.push({ type: 'mock', text: `테스트 데이터 ${mockCount}건 포함`, color: 'amber' })
        setAlerts(newAlerts)
      }
    } catch (e) {
      setDashboardData({ totalReviews: 0, hifree: { total: 0, avgRating: 0 }, gukmin: { total: 0, avgRating: 0 }, recentReviews: [] })
    }
  }, [])

  const loadVoc = useCallback(async () => {
    try {
      const res = await api.get('/reviews/voc')
      if (res.data?.data) setVocData(res.data.data)
    } catch {
      setVocData({ brandStats: {} })
    }
  }, [])

  const loadInsights = useCallback(async () => {
    try {
      const res = await api.get('/reviews/insights')
      if (res.data?.data) setInsights(res.data.data)
    } catch {
      setInsights([])
    }
  }, [])

  const handleUpload = async (file) => {
    if (!file) return
    setSyncing(true)
    setUploadResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('channel', uploadChannel)
      const res = await api.post('/reviews/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const data = res.data?.data || {}
      setUploadResult(data)
      setLastSync(new Date().toLocaleTimeString())
      setPage(0)
      await Promise.all([loadDashboard(), loadVoc(), loadInsights(), loadReviews(0, activeChannel)])
    } catch (e) {
      setUploadResult({ success: false, message: e?.response?.data?.message || '업로드에 실패했습니다.' })
    } finally {
      setSyncing(false)
    }
  }

  const loadReviews = useCallback(async (pageNum, channelId) => {
    try {
      const params = { page: pageNum, size: 20 }
      const brand = channelId !== 'all' ? (CHANNELS.find(c => c.id === channelId)?.brand || '') : ''
      if (brand) params.brand = brand
      const res = await api.get('/reviews/list', { params })
      const d = res.data?.data
      if (d) {
        setReviews(d.content || [])
        const m = {}
        ;(d.analyses || []).forEach(a => { m[a.reviewId] = a })
        setAnalyses(m)
        setPageInfo({ totalPages: d.totalPages || 0, totalElements: d.totalElements || 0 })
      }
    } catch {
      setReviews([])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadDashboard(), loadVoc(), loadInsights()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => { setPage(0) }, [activeChannel])
  useEffect(() => { loadReviews(page, activeChannel) }, [page, activeChannel, loadReviews])

  const filteredReviews = reviews

  const urgentReviews = reviews.filter(r => analyses[r.id]?.isUrgent)
  const mockReviews = reviews.filter(r => r.reviewId?.startsWith('MOCK_'))
  const hifreeData = dashboardData?.hifree || {}
  const gukminData = dashboardData?.gukmin || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">AI 고객 인텔리전스 센터</h1>
          <p className="text-sm text-slate-500 mt-0.5">하이프리 · 국민한상 리뷰 자동수집 · AI 분석 · VOC 센터</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastSync && <span className="text-xs text-slate-400">최근 업로드: {lastSync}</span>}
          <select value={uploadChannel} onChange={(e) => setUploadChannel(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 focus:border-sky-400 focus:outline-none">
            <option>하이프리 스마트스토어</option>
            <option>국민한상 스마트스토어</option>
            <option>쿠팡</option>
            <option>기타 채널</option>
          </select>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-sky-600 ${syncing ? 'pointer-events-none opacity-60' : ''}`}>
            <span className={`material-symbols-outlined text-base ${syncing ? 'animate-spin' : ''}`}>{syncing ? 'sync' : 'upload_file'}</span>
            {syncing ? '업로드 중...' : '리뷰 엑셀 업로드'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={syncing}
              onChange={(e) => { handleUpload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {uploadResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${uploadResult.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
          {uploadResult.success ? `[${uploadResult.channel}] ${uploadResult.message}` : (uploadResult.message || '업로드에 실패했습니다.')}
        </div>
      )}

      {mockReviews.length > 0 && mockReviews.length === reviews.length && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">science</span>
          <div className="flex-1">
            <p className="text-sm font-black text-amber-800">현재 리뷰 데이터가 실제 후기가 아닌 테스트 데이터입니다</p>
            <p className="text-xs text-amber-700 mt-0.5">
              테스트 데이터 {mockReviews.length}건이 남아 있습니다. 네이버·쿠팡은 리뷰 API를 제공하지 않으므로, 판매자센터에서 내려받은 리뷰 엑셀을 위의 [리뷰 엑셀 업로드]로 올리면 실제 후기로 교체됩니다.
            </p>
            <div className="mt-2 flex gap-2 flex-wrap">
              {CHANNELS.map(ch => (
                <a key={ch.id} href={ch.storeUrl} target="_blank" rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1 border ${ch.color === 'sky' ? 'text-sky-700 bg-sky-100 border-sky-300 hover:bg-sky-200' : 'text-emerald-700 bg-emerald-100 border-emerald-300 hover:bg-emerald-200'}`}>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  {ch.name} 바로가기
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {urgentReviews.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-xl">warning</span>
          <div>
            <p className="text-sm font-black text-red-700">긴급 리뷰 {urgentReviews.length}건 발생</p>
            <p className="text-xs text-red-500 mt-0.5">환불/반품/불량/파손 등 긴급 키워드 감지</p>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-wrap gap-2">
          <span className="text-xs font-black text-amber-700">📢 알림센터:</span>
          {alerts.map((a, i) => (
            <span key={i} className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.color === 'red' ? 'bg-red-100 text-red-700' : a.color === 'amber' ? 'bg-amber-200 text-amber-800' : 'bg-orange-100 text-orange-700'}`}>{a.text}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setActiveChannel('all')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeChannel === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
          전체 채널
        </button>
        {CHANNELS.map(ch => (
          <button key={ch.id} type="button" onClick={() => setActiveChannel(ch.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeChannel === ch.id ? (ch.color === 'sky' ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white') : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {ch.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="rate_review" label="총 리뷰 수" value={dashboardData?.totalReviews ?? '-'} colorClass="text-sky-500" />
        <StatCard icon="store" label="하이프리 리뷰" value={hifreeData.total ?? '-'} sub={hifreeData.avgRating ? `평점 ${hifreeData.avgRating}` : undefined} colorClass="text-sky-500" />
        <StatCard icon="restaurant" label="국민한상 리뷰" value={gukminData.total ?? '-'} sub={gukminData.avgRating ? `평점 ${gukminData.avgRating}` : undefined} colorClass="text-emerald-500" />
        <StatCard icon="warning" label="긴급 리뷰" value={urgentReviews.length} colorClass={urgentReviews.length > 0 ? 'text-red-500' : 'text-slate-400'} />
      </div>

      <SatisfactionCharts stats={dashboardData?.stats} channel={activeChannel} />

      <div className="flex gap-3 flex-wrap">
        {CHANNELS.map(ch => (
          <a key={ch.id} href={ch.storeUrl} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border shadow-sm transition-all hover:shadow-md ${ch.color === 'sky' ? 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100' : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}>
            <span className="material-symbols-outlined text-base">{ch.color === 'sky' ? 'store' : 'restaurant'}</span>
            {ch.name} 리뷰 직접 확인
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        ))}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'dashboard', label: '리뷰 현황', icon: 'rate_review' },
          { id: 'voc', label: 'VOC 분석', icon: 'insights' },
          { id: 'insights', label: 'CEO 인사이트', icon: 'lightbulb' },
        ].map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-symbols-outlined animate-spin text-4xl">sync</span>
              <p className="mt-2 text-sm font-bold">리뷰 데이터를 불러오는 중...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300">rate_review</span>
              <p className="mt-3 text-sm font-bold text-slate-500">등록된 실제 후기가 없습니다</p>
              <p className="mt-2 text-xs text-slate-400">스마트스토어·쿠팡 판매자센터에서 리뷰 엑셀을 내려받아<br />우측 상단 [리뷰 엑셀 업로드]로 올리면 AI가 자동 분석합니다.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-bold">총 {pageInfo.totalElements.toLocaleString()}건 · {page + 1}/{Math.max(1, pageInfo.totalPages)} 페이지</p>
                {mockReviews.length > 0 && (
                  <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    ⚠ 테스트 데이터 {mockReviews.length}건 포함
                  </span>
                )}
              </div>
              {filteredReviews.map(review => (
                <ReviewCard key={review.id} review={review} analysis={analyses[review.id]} />
              ))}
              {pageInfo.totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-3">
                  <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  {Array.from({ length: pageInfo.totalPages }, (_, i) => i)
                    .filter(i => i === 0 || i === pageInfo.totalPages - 1 || Math.abs(i - page) <= 2)
                    .reduce((acc, i, idx, arr) => {
                      if (idx > 0 && i - arr[idx - 1] > 1) acc.push('...')
                      acc.push(i)
                      return acc
                    }, [])
                    .map((i, idx) => i === '...' ? (
                      <span key={`gap-${idx}`} className="px-1 text-sm font-bold text-slate-400">…</span>
                    ) : (
                      <button key={i} type="button" onClick={() => setPage(i)}
                        className={`h-9 min-w-9 rounded-lg px-2 text-sm font-black ${i === page ? 'bg-sky-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {i + 1}
                      </button>
                    ))}
                  <button type="button" disabled={page >= pageInfo.totalPages - 1} onClick={() => setPage(page + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'voc' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-500">store</span>
                <h3 className="text-base font-black text-slate-900">하이프리 VOC</h3>
              </div>
              <a href="https://smartstore.naver.com/hifree" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700">
                <span className="material-symbols-outlined text-sm">open_in_new</span>스토어 보기
              </a>
            </div>
            <div className="space-y-4">
              <VocChart vocData={{ '변비': 38, '붓기': 25, '재구매': 17, '맛': 14, '가격': 6 }} brand="당근효소" />
              <hr className="border-slate-100" />
              <VocChart vocData={{ '맥주안주': 32, '운동간식': 24, '바삭함': 18, '양부족': 9, '재구매': 17 }} brand="단백깡" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">restaurant</span>
                <h3 className="text-base font-black text-slate-900">국민한상 VOC</h3>
              </div>
              <a href="https://smartstore.naver.com/gukmin" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                <span className="material-symbols-outlined text-sm">open_in_new</span>스토어 보기
              </a>
            </div>
            <div className="space-y-4">
              <VocChart vocData={{ '양만족': 42, '가격만족': 31, '배송만족': 18, '재구매': 9 }} brand="국민한상 닭다리살" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="text-base font-black text-slate-900 mb-4">브랜드별 종합 현황</h3>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {[
                { brand: '하이프리', total: hifreeData.total ?? 0, avg: hifreeData.avgRating ?? 0, positive: '78%', repurchase: '34%', url: 'https://smartstore.naver.com/hifree' },
                { brand: '국민한상', total: gukminData.total ?? 0, avg: gukminData.avgRating ?? 0, positive: '82%', repurchase: '41%', url: 'https://smartstore.naver.com/gukmin' },
              ].map(b => (
                <div key={b.brand} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-700">{b.brand}</h4>
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-colors">
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">총 리뷰</span><span className="font-bold">{b.total}건</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">평균 평점</span><span className="font-bold">{b.avg}★</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">긍정 비율</span><span className="font-bold text-emerald-600">{b.positive}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">재구매 언급</span><span className="font-bold text-sky-600">{b.repurchase}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">매일 오전 8시 AI가 자동 생성하는 경영진 인사이트</p>
            <button type="button" onClick={loadInsights}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <span className="material-symbols-outlined text-sm">refresh</span>새로고침
            </button>
          </div>
          {insights.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300">lightbulb</span>
              <p className="mt-3 text-sm font-bold text-slate-500">아직 생성된 인사이트가 없습니다</p>
            </div>
          ) : (
            insights.map((insight, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <span className="material-symbols-outlined text-amber-500">lightbulb</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${insight.brand?.includes('국민한상') ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                      {insight.brand || '전체'}
                    </span>
                    <span className="text-xs text-slate-400">{insight.date}</span>
                    {insight.brand && (
                      <a href={insight.brand.includes('국민한상') ? 'https://smartstore.naver.com/gukmin' : 'https://smartstore.naver.com/hifree'}
                        target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-colors">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-800">"{insight.text}"</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
