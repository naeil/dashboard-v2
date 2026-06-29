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

function StatCard({ icon, label, value, sub, colorClass }) {
    return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-2xl ${colorClass || 'text-sky-500'}`}>{icon}</span>span>
                        <div>
                                  <p className="text-xs font-bold text-slate-500">{label}</p>p>
                                  <p className="text-2xl font-black text-slate-900">{value}</p>p>
                          {sub && <p className="text-xs text-slate-400">{sub}</p>p>}
                        </div>div>
                </div>div>
          </div>div>
        )
}

function ReviewCard({ review, analysis, onReplyEdit }) {
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
                                                                          </span>span>
                                                                {isMock && (
                                                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700 border border-amber-200">
                                                                      <span className="material-symbols-outlined text-sm">science</span>span>테스트 데이터
                                                      </span>span>
                                                                          )}
                                                                {isUrgent && (
                                                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-700">
                                                                      <span className="material-symbols-outlined text-sm">warning</span>span>긴급
                                                      </span>span>
                                                                          )}
                                                                          <span className="text-xs text-slate-400">{review.productName}</span>span>
                                                                {review.optionName && review.optionName !== '기본' && (
                                                      <span className="text-xs text-slate-300">({review.optionName})</span>span>
                                                                          )}
                                                              </div>div>
                                                              <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                {Array.from({ length: 5 }).map((_, i) => (
                                                      <span key={i} className={`text-sm ${i < review.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>span>
                                                    ))}
                                                                          <div className="flex items-center gap-1 ml-1">
                                                                            {customerDisplayName ? (
                                                        <span className="text-xs font-bold text-slate-700">{customerDisplayName}</span>span>
                                                      ) : (
                                                        <span className="text-xs text-slate-400">
                                                          {review.orderNumber ? `주문 ${review.orderNumber}` : '고객'}
                                                        </span>span>
                                                                                        )}
                                                                            {reviewDate && (
                                                        <span className="text-xs text-slate-300">· {reviewDate}</span>span>
                                                                                        )}
                                                                          </div>div>
                                                              </div>div>
                                                              <p className="mt-2 text-sm text-slate-700 line-clamp-2">{review.reviewContent}</p>p>
                                                      {directUrl && (
                                                    <div className="mt-2">
                                                                  <a
                                                                                    href={directUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className={`inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1 transition-colors ${isHifree ? 'text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'}`}
                                                                                  >
                                                                                  <span className="material-symbols-outlined text-sm">open_in_new</span>span>
                                                                                  스마트스토어에서 직접 확인
                                                                  </a>a>
                                                    </div>div>
                                                              )}
                                                    </div>div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                      {analysis?.sentiment && (
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SENTIMENT_COLORS[analysis.sentiment]}`}>
                                                      {SENTIMENT_LABELS[analysis.sentiment]}
                                                    </span>span>
                                                              )}
                                                      {analysis?.replyStatus && (
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[analysis.replyStatus]}`}>
                                                      {STATUS_LABELS[analysis.replyStatus]}
                                                    </span>span>
                                                              )}
                                                    </div>div>
                                            </div>div>
                                        {analysis?.keywords && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                  {analysis.keywords.split(',').filter(Boolean).map((kw, i) => (
                                                              <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">#{kw.trim()}</span>span>
                                                            ))}
                                                </div>div>
                                            )}
                                        {analysis?.replyDraft && (
                                                <div className="mt-3">
                                                          <button type="button" onClick={() => setShowReply(!showReply)}
                                                                        className="text-xs font-bold text-sky-600 hover:text-sky-700">
                                                            {showReply ? '▲ 답변 초안 접기' : '▼ AI 답변 초안 보기'}
                                                          </button>button>
                                                  {showReply && (
                                                              <div className="mt-2 rounded-lg bg-sky-50 border border-sky-100 p-3">
                                                                            <p className="text-xs text-slate-700">{analysis.replyDraft}</p>p>
                                                              </div>div>
                                                          )}
                                                </div>div>
                                            )}
                                      </div>div>
                                    )
                                  }
                                  
                                  function VocChart({ vocData, brand }) {
                                      if (!vocData) return null
                                          const items = Object.entries(vocData).slice(0, 5)
                                              const total = items.reduce((s, [, v]) => s + v, 0)
                                                  return (
                                                        <div>
                                                              <h4 className="text-sm font-black text-slate-700 mb-2">{brand} VOC 키워드</h4>h4>
                                                              <div className="space-y-2">
                                                                {items.map(([key, val]) => {
                                                                    const pct = total > 0 ? Math.round((val / total) * 100) : 0
                                                                                return (
                                                                                              <div key={key}>
                                                                                                            <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                                                                                                                            <span className="font-bold">#{key}</span>span>
                                                                                                                            <span>{pct}%</span>span>
                                                                                                              </div>div>
                                                                                                            <div className="h-2 rounded-full bg-slate-100">
                                                                                                                            <div className="h-2 rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
                                                                                                              </div>div>
                                                                                                </div>div>
                                                                                            )
                                                                })}
                                                              </div>div>
                                                        </div>div>
                                                      )
                                                    }
                                                    
                                                    export default function AIReviewCenterPage() {
                                                        const [activeTab, setActiveTab] = useState('dashboard')
                                                            const [activeChannel, setActiveChannel] = useState('all')
                                                                const [dashboardData, setDashboardData] = useState(null)
                                                                    const [reviews, setReviews] = useState([])
                                                                        const [analyses, setAnalyses] = useState({})
                                                                            const [vocData, setVocData] = useState(null)
                                                                                const [insights, setInsights] = useState([])
                                                                                    const [loading, setLoading] = useState(false)
                                                                                        const [syncing, setSyncing] = useState(false)
                                                                                            const [lastSync, setLastSync] = useState(null)
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
                                                                                                                                                                                                          if (mockCount > 0) newAlerts.push({ type: 'mock', text: `테스트 데이터 ${mockCount}건 포함 (실제 리뷰 수집 필요)`, color: 'amber' })
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
                                                                                                                } catch (e) {
                                                                                                                      setVocData({
                                                                                                                                brandStats: { '하이프리': 45, '국민한상': 32 },
                                                                                                                                hifreeKeywords: { '변비': 38, '붓기': 25, '재구매': 17, '맛': 14, '가격': 6 },
                                                                                                                                gukminKeywords: { '배송': 42, '양만족': 31, '가격': 18, '품질': 9 }
                                                                                                                        })
                                                                                                                }
                                                                                                          }, [])
                                                                                                          
                                                                                                            const loadInsights = useCallback(async () => {
                                                                                                                  try {
                                                                                                                          const res = await api.get('/reviews/insights')
                                                                                                                                  if (res.data?.data) setInsights(res.data.data)
                                                                                                                    } catch (e) {
                                                                                                                          setInsights([
                                                                                                                            { brand: '하이프리', text: '당근효소 고객은 변비보다 붓기 개선 목적으로 구매하는 비중이 증가하고 있습니다.', date: new Date().toLocaleDateString() },
                                                                                                                            { brand: '하이프리', text: '단백깡 리뷰에서 맥주안주 언급량이 증가하고 있습니다.', date: new Date().toLocaleDateString() },
                                                                                                                            { brand: '국민한상', text: '국민한상 제품군은 배송 만족도가 전월 대비 상승했습니다.', date: new Date().toLocaleDateString() },
                                                                                                                                  ])
                                                                                                                    }
                                                                                                              }, [])
                                                                                                              
                                                                                                                const handleSync = async (channel) => {
                                                                                                                      setSyncing(true)
                                                                                                                            try {
                                                                                                                                    const body = channel !== 'all' ? { channel: CHANNELS.find(c => c.id === channel)?.name } : {}
                                                                                                                                            await api.post('/reviews/sync', body)
                                                                                                                                                    setLastSync(new Date().toLocaleTimeString())
                                                                                                                                                            await loadDashboard()
                                                                                                                              } catch (e) {
                                                                                                                                    console.error('Sync failed', e)
                                                                                                                              } finally {
                                                                                                                                    setSyncing(false)
                                                                                                                              }
                                                                                                                  }
                                                                                                                  
                                                                                                                    useEffect(() => {
                                                                                                                          setLoading(true)
                                                                                                                                Promise.all([loadDashboard(), loadVoc(), loadInsights()]).finally(() => setLoading(false))
                                                                                                                                      const interval = setInterval(() => { handleSync('all') }, 10 * 60 * 1000)
                                                                                                                                            return () => clearInterval(interval)
                                                                                                                      }, [])
                                                                                                                      
                                                                                                                        const filteredReviews = activeChannel === 'all'
                                                                                                                              ? reviews
                                                                                                                              : reviews.filter(r => {
                                                                                                                                        const ch = CHANNELS.find(c => c.id === activeChannel)
                                                                                                                                                  return r.channel?.includes(ch?.brand || '')
                                                                                                                                })
                                                                                                                          
                                                                                                                            const urgentReviews = reviews.filter(r => analyses[r.id]?.isUrgent)
                                                                                                                                const mockReviews = reviews.filter(r => r.reviewId?.startsWith('MOCK_'))
                                                                                                                                    const hifreeData = dashboardData?.hifree || {}
                                                                                                                                        const gukminData = dashboardData?.gukmin || {}
                                                                                                                                          
                                                                                                                                            return (
                                                                                                                                                  <div className="space-y-6">
                                                                                                                                                    {/* 헤더 */}
                                                                                                                                                        <div className="flex items-center justify-between">
                                                                                                                                                                <div>
                                                                                                                                                                          <h1 className="text-2xl font-black text-slate-900">AI 고객 인텔리전스 센터</h1>h1>
                                                                                                                                                                          <p className="text-sm text-slate-500 mt-0.5">하이프리 · 국민한상 리뷰 자동수집 · AI 분석 · VOC 센터</p>p>
                                                                                                                                                                  </div>div>
                                                                                                                                                                <div className="flex items-center gap-3">
                                                                                                                                                                  {lastSync && <span className="text-xs text-slate-400">최근 동기화: {lastSync}</span>span>}
                                                                                                                                                                          <button type="button" onClick={() => handleSync(activeChannel)}
                                                                                                                                                                                        disabled={syncing}
                                                                                                                                                                                        className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-sky-600 disabled:opacity-60 transition-colors">
                                                                                                                                                                                      <span className={`material-symbols-outlined text-base ${syncing ? 'animate-spin' : ''}`}>sync</span>span>
                                                                                                                                                                            {syncing ? '수집 중...' : '리뷰 수집'}
                                                                                                                                                                            </button>button>
                                                                                                                                                                  </div>div>
                                                                                                                                                          </div>div>
                                                                                                                                                  
                                                                                                                                                    {/* 테스트 데이터 경고 배너 */}
                                                                                                                                                    {mockReviews.length > 0 && mockReviews.length === reviews.length && (
                                                                                                                                                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                                                                                                                                                                      <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">science</span>span>
                                                                                                                                                                      <div className="flex-1">
                                                                                                                                                                                  <p className="text-sm font-black text-amber-800">현재 리뷰 데이터가 실제 후기가 아닌 테스트 데이터입니다</p>p>
                                                                                                                                                                                  <p className="text-xs text-amber-700 mt-0.5">
                                                                                                                                                                                                총 {mockReviews.length}건의 테스트 데이터가 표시되고 있습니다.
                                                                                                                                                                                                실제 스마트스토어 리뷰를 수집하려면 "리뷰 수집" 버튼을 클릭하거나
                                                                                                                                                                                                스마트스토어 API 연동 설정을 확인하세요.
                                                                                                                                                                                    </p>p>
                                                                                                                                                                                  <div className="mt-2 flex gap-2 flex-wrap">
                                                                                                                                                                                    {CHANNELS.map(ch => (
                                                                                                                                                                              <a key={ch.id} href={ch.storeUrl} target="_blank" rel="noopener noreferrer"
                                                                                                                                                                                                  className={`inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1 border ${ch.color === 'sky' ? 'text-sky-700 bg-sky-100 border-sky-300 hover:bg-sky-200' : 'text-emerald-700 bg-emerald-100 border-emerald-300 hover:bg-emerald-200'}`}>
                                                                                                                                                                                                <span className="material-symbols-outlined text-sm">open_in_new</span>span>
                                                                                                                                                                                {ch.name} 바로가기
                                                                                                                                                                                </a>a>
                                                                                                                                                                            ))}
                                                                                                                                                                                    </div>div>
                                                                                                                                                                        </div>div>
                                                                                                                                                              </div>div>
                                                                                                                                                        )}
                                                                                                                                                  
                                                                                                                                                    {/* 긴급 알림 배너 */}
                                                                                                                                                    {urgentReviews.length > 0 && (
                                                                                                                                                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                                                                                                                                                                      <span className="material-symbols-outlined text-red-500 text-xl">warning</span>span>
                                                                                                                                                                      <div>
                                                                                                                                                                                  <p className="text-sm font-black text-red-700">긴급 리뷰 {urgentReviews.length}건 발생 — 즉시 확인이 필요합니다</p>p>
                                                                                                                                                                                  <p className="text-xs text-red-500 mt-0.5">환불/반품/불량/파손/냄새/곰팡이 등 긴급 키워드 감지</p>p>
                                                                                                                                                                        </div>div>
                                                                                                                                                              </div>div>
                                                                                                                                                        )}
                                                                                                                                                  
                                                                                                                                                    {/* 알림 센터 */}
                                                                                                                                                    {alerts.length > 0 && (
                                                                                                                                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-wrap gap-2">
                                                                                                                                                                      <span className="text-xs font-black text-amber-700">📢 알림센터:</span>span>
                                                                                                                                                              {alerts.map((a, i) => (
                                                                                                                                                                          <span key={i} className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.color === 'red' ? 'bg-red-100 text-red-700' : a.color === 'amber' ? 'bg-amber-200 text-amber-800' : 'bg-orange-100 text-orange-700'}`}>{a.text}</span>span>
                                                                                                                                                                        ))}
                                                                                                                                                              </div>div>
                                                                                                                                                        )}
                                                                                                                                                  
                                                                                                                                                    {/* 채널 탭 */}
                                                                                                                                                        <div className="flex gap-2">
                                                                                                                                                                <button type="button" onClick={() => setActiveChannel('all')}
                                                                                                                                                                            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeChannel === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                                                                                                                                          전체 채널
                                                                                                                                                                  </button>button>
                                                                                                                                                          {CHANNELS.map(ch => (
                                                                                                                                                              <button key={ch.id} type="button" onClick={() => setActiveChannel(ch.id)}
                                                                                                                                                                            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeChannel === ch.id ? (ch.color === 'sky' ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white') : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                                                                                                                                {ch.name}
                                                                                                                                                                </button>button>
                                                                                                                                                            ))}
                                                                                                                                                          </div>div>
                                                                                                                                                  
                                                                                                                                                    {/* 주요 지표 카드 */}
                                                                                                                                                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                                                                                                                                                                <StatCard icon="rate_review" label="총 리뷰 수" value={dashboardData?.totalReviews ?? '-'} colorClass="text-sky-500" />
                                                                                                                                                                <StatCard icon="store" label="하이프리 리뷰" value={hifreeData.total ?? '-'} sub={hifreeData.avgRating ? `평점 ${hifreeData.avgRating}` : undefined} colorClass="text-sky-500" />
                                                                                                                                                                <StatCard icon="restaurant" label="국민한상 리뷰" value={gukminData.total ?? '-'} sub={gukminData.avgRating ? `평점 ${gukminData.avgRating}` : undefined} colorClass="text-emerald-500" />
                                                                                                                                                                <StatCard icon="warning" label="긴급 리뷰" value={urgentReviews.length} colorClass={urgentReviews.length > 0 ? 'text-red-500' : 'text-slate-400'} />
                                                                                                                                                          </div>div>
                                                                                                                                                  
                                                                                                                                                    {/* 스마트스토어 바로가기 */}
                                                                                                                                                        <div className="flex gap-3 flex-wrap">
                                                                                                                                                          {CHANNELS.map(ch => (
                                                                                                                                                              <a key={ch.id} href={ch.storeUrl} target="_blank" rel="noopener noreferrer"
                                                                                                                                                                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border shadow-sm transition-all hover:shadow-md ${ch.color === 'sky' ? 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100' : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}>
                                                                                                                                                                          <span className="material-symbols-outlined text-base">{ch.color === 'sky' ? 'store' : 'restaurant'}</span>span>
                                                                                                                                                                {ch.name} 리뷰 직접 확인
                                                                                                                                                                          <span className="material-symbols-outlined text-sm">open_in_new</span>span>
                                                                                                                                                                </a>a>
                                                                                                                                                            ))}
                                                                                                                                                          </div>div>
                                                                                                                                                  
                                                                                                                                                    {/* 메인 탭 */}
                                                                                                                                                        <div className="flex gap-1 border-b border-slate-200">
                                                                                                                                                          {[
                                                                                                                                                    { id: 'dashboard', label: '리뷰 현황', icon: 'rate_review' },
                                                                                                                                                    { id: 'voc', label: 'VOC 분석', icon: 'insights' },
                                                                                                                                                    { id: 'insights', label: 'CEO 인사이트', icon: 'lightbulb' },
                                                                                                                                                            ].map(tab => (
                                                                                                                                                                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                                                                                                                                                                                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                                                                                                                                                                    <span className="material-symbols-outlined text-base">{tab.icon}</span>span>
                                                                                                                                                                          {tab.label}
                                                                                                                                                                          </button>button>
                                                                                                                                                                      ))}
                                                                                                                                                          </div>div>
                                                                                                                                                  
                                                                                                                                                    {/* 리뷰 현황 탭 */}
                                                                                                                                                    {activeTab === 'dashboard' && (
                                                                                                                                                            <div className="space-y-3">
                                                                                                                                                              {loading ? (
                                                                                                                                                                          <div className="py-12 text-center text-slate-400">
                                                                                                                                                                                        <span className="material-symbols-outlined animate-spin text-4xl">sync</span>span>
                                                                                                                                                                                        <p className="mt-2 text-sm font-bold">리뷰 데이터를 불러오는 중...</p>p>
                                                                                                                                                                            </div>div>
                                                                                                                                                                        ) : filteredReviews.length === 0 ? (
                                                                                                                                                                          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
                                                                                                                                                                                        <span className="material-symbols-outlined text-4xl text-slate-300">rate_review</span>span>
                                                                                                                                                                                        <p className="mt-3 text-sm font-bold text-slate-500">수집된 리뷰가 없습니다</p>p>
                                                                                                                                                                                        <p className="text-xs text-slate-400 mt-1">상단 "리뷰 수집" 버튼을 클릭하여 최신 리뷰를 가져오세요</p>p>
                                                                                                                                                                                        <button type="button" onClick={() => handleSync(activeChannel)}
                                                                                                                                                                                                          className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">
                                                                                                                                                                                                        지금 수집하기
                                                                                                                                                                                          </button>button>
                                                                                                                                                                            </div>div>
                                                                                                                                                                        ) : (
                                                                                                                                                                          <>
                                                                                                                                                                                        <div className="flex items-center justify-between">
                                                                                                                                                                                                        <p className="text-xs text-slate-400 font-bold">{filteredReviews.length}건의 리뷰</p>p>
                                                                                                                                                                                                        {mockReviews.length > 0 && (
                                                                                                                                                                                              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                                                                                                                                                                                  ⚠ 테스트 데이터 {mockReviews.length}건 포함
                                                                                                                                                                                                                </span>span>
                                                                                                                                                                                                        )}
                                                                                                                                                                                          </div>div>
                                                                                                                                                                            {filteredReviews.map(review => (
                                                                                                                                                                                            <ReviewCard key={review.id} review={review} analysis={analyses[review.id]} />
                                                                                                                                                                                          ))}
                                                                                                                                                                            </>>
                                                                                                                                                                        )}
                                                                                                                                                              </div>div>
                                                                                                                                                        )}
                                                                                                                                                  
                                                                                                                                                    {/* VOC 분석 탭 */}
                                                                                                                                                    {activeTab === 'voc' && (
                                                                                                                                                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                                                                                                                                              {/* 하이프리 VOC */}
                                                                                                                                                                      <div className="rounded-xl border border-slate-200 bg-white p-5">
                                                                                                                                                                                  <div className="flex items-center justify-between mb-4">
                                                                                                                                                                                                <div className="flex items-center gap-2">
                                                                                                                                                                                                                <span className="material-symbols-outlined text-sky-500">store</span>span>
                                                                                                                                                                                                                <h3 className="text-base font-black text-slate-900">하이프리 VOC</h3>h3>
                                                                                                                                                                                                              </div>div>
                                                                                                                                                                                                <a href="https://smartstore.naver.com/hifree" target="_blank" rel="noopener noreferrer"
                                                                                                                                                                                                                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700">
                                                                                                                                                                                                                <span className="material-symbols-outlined text-sm">open_in_new</span>span>스토어 보기
                                                                                                                                                                                                              </a>a>
                                                                                                                                                                                    </div>div>
                                                                                                                                                                                  <div className="space-y-4">
                                                                                                                                                                                                <VocChart vocData={{ '변비': 38, '붓기': 25, '재구매': 17, '맛': 14, '가격': 6 }} brand="당근효소" />
                                                                                                                                                                                                <hr className="border-slate-100" />
                                                                                                                                                                                                <VocChart vocData={{ '맥주안주': 32, '운동간식': 24, '바삭함': 18, '양부족': 9, '재구매': 17 }} brand="단백깡" />
                                                                                                                                                                                    </div>div>
                                                                                                                                                                        </div>div>
                                                                                                                                                            
                                                                                                                                                              {/* 국민한상 VOC */}
                                                                                                                                                                      <div className="rounded-xl border border-slate-200 bg-white p-5">
                                                                                                                                                                                  <div className="flex items-center justify-between mb-4">
                                                                                                                                                                                                <div className="flex items-center gap-2">
                                                                                                                                                                                                                <span className="material-symbols-outlined text-emerald-500">restaurant</span>span>
                                                                                                                                                                                                                <h3 className="text-base font-black text-slate-900">국민한상 VOC</h3>h3>
                                                                                                                                                                                                              </div>div>
                                                                                                                                                                                                <a href="https://smartstore.naver.com/gukmin" target="_blank" rel="noopener noreferrer"
                                                                                                                                                                                                                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                                                                                                                                                                                                                <span className="material-symbols-outlined text-sm">open_in_new</span>span>스토어 보기
                                                                                                                                                                                                              </a>a>
                                                                                                                                                                                    </div>div>
                                                                                                                                                                                  <div className="space-y-4">
                                                                                                                                                                                                <VocChart vocData={{ '양만족': 42, '가격만족': 31, '배송만족': 18, '재구매': 9 }} brand="국민한상 닭다리살" />
                                                                                                                                                                                    </div>div>
                                                                                                                                                                        </div>div>
                                                                                                                                                            
                                                                                                                                                              {/* 브랜드별 종합 */}
                                                                                                                                                                      <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                                                                                                                                                                                  <h3 className="text-base font-black text-slate-900 mb-4">브랜드별 종합 현황</h3>h3>
                                                                                                                                                                                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                                                                                                                                                                                    {[
                                                                                                                                                              { brand: '하이프리', total: hifreeData.total ?? 0, avg: hifreeData.avgRating ?? 0, positive: '78%', repurchase: '34%', url: 'https://smartstore.naver.com/hifree' },
                                                                                                                                                              { brand: '국민한상', total: gukminData.total ?? 0, avg: gukminData.avgRating ?? 0, positive: '82%', repurchase: '41%', url: 'https://smartstore.naver.com/gukmin' },
                                                                                                                                                                            ].map(b => (
                                                                                                                                                                                              <div key={b.brand} className="space-y-2">
                                                                                                                                                                                                                <div className="flex items-center gap-2">
                                                                                                                                                                                                                                    <h4 className="text-sm font-black text-slate-700">{b.brand}</h4>h4>
                                                                                                                                                                                                                                    <a href={b.url} target="_blank" rel="noopener noreferrer"
                                                                                                                                                                                                                                                            className="text-slate-400 hover:text-sky-500 transition-colors">
                                                                                                                                                                                                                                                          <span className="material-symbols-outlined text-sm">open_in_new</span>span>
                                                                                                                                                                                                                                                        </a>a>
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                                <div className="space-y-1 text-xs">
                                                                                                                                                                                                                                    <div className="flex justify-between"><span className="text-slate-500">총 리뷰</span>span><span className="font-bold">{b.total}건</span>span></div>div>
                                                                                                                                                                                                                                    <div className="flex justify-between"><span className="text-slate-500">평균 평점</span>span><span className="font-bold">{b.avg}★</span>span></div>div>
                                                                                                                                                                                                                                    <div className="flex justify-between"><span className="text-slate-500">긍정 비율</span>span><span className="font-bold text-emerald-600">{b.positive}</span>span></div>div>
                                                                                                                                                                                                                                    <div className="flex justify-between"><span className="text-slate-500">재구매 언급</span>span><span className="font-bold text-sky-600">{b.repurchase}</span>span></div>div>
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                              </div>div>
                                                                                                                                                                                            ))}
                                                                                                                                                                                    </div>div>
                                                                                                                                                                        </div>div>
                                                                                                                                                              </div>div>
                                                                                                                                                        )}
                                                                                                                                                  
                                                                                                                                                    {/* CEO 인사이트 탭 */}
                                                                                                                                                    {activeTab === 'insights' && (
                                                                                                                                                            <div className="space-y-4">
                                                                                                                                                                      <div className="flex items-center justify-between">
                                                                                                                                                                                  <p className="text-sm text-slate-500">매일 오전 8시 AI가 자동 생성하는 경영진 인사이트</p>p>
                                                                                                                                                                                  <button type="button" onClick={loadInsights}
                                                                                                                                                                                                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                                                                                                                                                                                                <span className="material-symbols-outlined text-sm">refresh</span>span>새로고침
                                                                                                                                                                                    </button>button>
                                                                                                                                                                        </div>div>
                                                                                                                                                              {insights.length === 0 ? (
                                                                                                                                                                          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
                                                                                                                                                                                        <span className="material-symbols-outlined text-4xl text-slate-300">lightbulb</span>span>
                                                                                                                                                                                        <p className="mt-3 text-sm font-bold text-slate-500">아직 생성된 인사이트가 없습니다</p>p>
                                                                                                                                                                            </div>div>
                                                                                                                                                                        ) : (
                                                                                                                                                                          insights.map((insight, i) => (
                                                                                                                                                                                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 flex gap-4">
                                                                                                                                                                                                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                                                                                                                                                                                                                            <span className="material-symbols-outlined text-amber-500">lightbulb</span>span>
                                                                                                                                                                                                                          </div>div>
                                                                                                                                                                                                          <div className="flex-1">
                                                                                                                                                                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                                                                                                                                                                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${insight.brand?.includes('국민한상') ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                                                                                                                                                                                                                                                                      {insight.brand || '전체'}
                                                                                                                                                                                                                                                                    </span>span>
                                                                                                                                                                                                                                                <span className="text-xs text-slate-400">{insight.date}</span>span>
                                                                                                                                                                                                                                                {insight.brand && (
                                                                                                                                                                                                                  <a href={insight.brand.includes('국민한상') ? 'https://smartstore.naver.com/gukmin' : 'https://smartstore.naver.com/hifree'}
                                                                                                                                                                                                                                            target="_blank" rel="noopener noreferrer"
                                                                                                                                                                                                                                            className="text-slate-400 hover:text-sky-500 transition-colors">
                                                                                                                                                                                                                                          <span className="material-symbols-outlined text-sm">open_in_new</span>span>
                                                                                                                                                                                                                                        </a>a>
                                                                                                                                                                                                                                                )}
                                                                                                                                                                                                                                              </div>div>
                                                                                                                                                                                                                            <p className="text-sm font-bold text-slate-800">"{insight.text}"</p>p>
                                                                                                                                                                                                                          </div>div>
                                                                                                                                                                                                        </div>div>
                                                                                                                                                                                        ))
                                                                                                                                                                        )}
                                                                                                                                                              </div>div>
                                                                                                                                                        )}
                                                                                                                                                    </div>div>
                                                                                                                                                )
                                                                                                                                              }</></div>
