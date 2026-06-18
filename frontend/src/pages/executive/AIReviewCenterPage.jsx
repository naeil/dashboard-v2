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
  { id: 'hifree', name: '하이프리 스마트스토어', brand: '하이프리', color: 'sky' },
  { id: 'gukmin', name: '국민한상 스마트스토어', brand: '국민한상', color: 'emerald' },
]

const SENTIMENT_LABELS = { POSITIVE: '긍정', NEUTRAL: '중립', NEGATIVE: '부정' }
const SENTIMENT_COLORS = { POSITIVE: 'text-emerald-600 bg-emerald-50', NEUTRAL: 'text-slate-600 bg-slate-100', NEGATIVE: 'text-red-600 bg-red-50' }
const STATUS_LABELS = { READY: '자동승인', REVIEW_REQUIRED: '검토필요', MANAGER_REQUIRED: '담당자필요', PENDING: '대기중' }
const STATUS_COLORS = { READY: 'bg-emerald-100 text-emerald-700', REVIEW_REQUIRED: 'bg-yellow-100 text-yellow-700', MANAGER_REQUIRED: 'bg-red-100 text-red-700', PENDING: 'bg-slate-100 text-slate-600' }

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

function ReviewCard({ review, analysis, onReplyEdit }) {
  const [showReply, setShowReply] = useState(false)
  const isUrgent = analysis?.isUrgent
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${isUrgent ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${review.channel?.includes('하이프리') ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {review.channel?.includes('하이프리') ? '하이프리' : '국민한상'}
            </span>
            {isUrgent && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-700">
                <span className="material-symbols-outlined text-sm">warning</span>긴급
              </span>
            )}
            <span className="text-xs text-slate-400">{review.productName}</span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < review.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
            ))}
            <span className="text-xs text-slate-400 ml-1">{review.customerName}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700 line-clamp-2">{review.reviewContent}</p>
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
        const newAlerts = []
        if (urgentCount > 0) newAlerts.push({ type: 'urgent', text: `긴급 리뷰 ${urgentCount}건 발생`, color: 'red' })
        if (negativeCount > 0) newAlerts.push({ type: 'negative', text: `부정 리뷰 ${negativeCount}건`, color: 'orange' })
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
  const hifreeData = dashboardData?.hifree || {}
  const gukminData = dashboardData?.gukmin || {}

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">AI 고객 인텔리전스 센터</h1>
          <p className="text-sm text-slate-500 mt-0.5">하이프리 · 국민한상 리뷰 자동수집 · AI 분석 · VOC 센터</p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && <span className="text-xs text-slate-400">최근 동기화: {lastSync}</span>}
          <button type="button" onClick={() => handleSync(activeChannel)}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-sky-600 disabled:opacity-60 transition-colors">
            <span className={`material-symbols-outlined text-base ${syncing ? 'animate-spin' : ''}`}>sync</span>
            {syncing ? '수집 중...' : '리뷰 수집'}
          </button>
        </div>
      </div>

      {/* 긴급 알림 배너 */}
      {urgentReviews.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-xl">warning</span>
          <div>
            <p className="text-sm font-black text-red-700">긴급 리뷰 {urgentReviews.length}건 발생 — 즉시 확인이 필요합니다</p>
            <p className="text-xs text-red-500 mt-0.5">환불/반품/불량/파손/냄새/곰팡이 등 긴급 키워드 감지</p>
          </div>
        </div>
      )}

      {/* 알림 센터 */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-wrap gap-2">
          <span className="text-xs font-black text-amber-700">📢 알림센터:</span>
          {alerts.map((a, i) => (
            <span key={i} className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.color === 'red' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{a.text}</span>
          ))}
        </div>
      )}

      {/* 채널 탭 */}
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

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="rate_review" label="총 리뷰 수" value={dashboardData?.totalReviews ?? '-'} colorClass="text-sky-500" />
        <StatCard icon="store" label="하이프리 리뷰" value={hifreeData.total ?? '-'} sub={hifreeData.avgRating ? `평점 ${hifreeData.avgRating}` : undefined} colorClass="text-sky-500" />
        <StatCard icon="restaurant" label="국민한상 리뷰" value={gukminData.total ?? '-'} sub={gukminData.avgRating ? `평점 ${gukminData.avgRating}` : undefined} colorClass="text-emerald-500" />
        <StatCard icon="warning" label="긴급 리뷰" value={urgentReviews.length} colorClass={urgentReviews.length > 0 ? 'text-red-500' : 'text-slate-400'} />
      </div>

      {/* 메인 탭 */}
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

      {/* 리뷰 현황 탭 */}
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
              <p className="mt-3 text-sm font-bold text-slate-500">수집된 리뷰가 없습니다</p>
              <p className="text-xs text-slate-400 mt-1">상단 "리뷰 수집" 버튼을 클릭하여 최신 리뷰를 가져오세요</p>
              <button type="button" onClick={() => handleSync(activeChannel)}
                className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">
                지금 수집하기
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 font-bold">{filteredReviews.length}건의 리뷰</p>
              {filteredReviews.map(review => (
                <ReviewCard key={review.id} review={review} analysis={analyses[review.id]} />
              ))}
            </>
          )}
        </div>
      )}

      {/* VOC 분석 탭 */}
      {activeTab === 'voc' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 하이프리 VOC */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-sky-500">store</span>
              <h3 className="text-base font-black text-slate-900">하이프리 VOC</h3>
            </div>
            <div className="space-y-4">
              <VocChart vocData={{ '변비': 38, '붓기': 25, '재구매': 17, '맛': 14, '가격': 6 }} brand="당근효소" />
              <hr className="border-slate-100" />
              <VocChart vocData={{ '맥주안주': 32, '운동간식': 24, '바삭함': 18, '양부족': 9, '재구매': 17 }} brand="단백깡" />
            </div>
          </div>

          {/* 국민한상 VOC */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-emerald-500">restaurant</span>
              <h3 className="text-base font-black text-slate-900">국민한상 VOC</h3>
            </div>
            <div className="space-y-4">
              <VocChart vocData={{ '양만족': 42, '가격만족': 31, '배송만족': 18, '재구매': 9 }} brand="국민한상 닭다리살" />
            </div>
          </div>

          {/* 브랜드별 종합 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="text-base font-black text-slate-900 mb-4">브랜드별 종합 현황</h3>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {[
                { brand: '하이프리', total: hifreeData.total ?? 0, avg: hifreeData.avgRating ?? 0, positive: '78%', repurchase: '34%' },
                { brand: '국민한상', total: gukminData.total ?? 0, avg: gukminData.avgRating ?? 0, positive: '82%', repurchase: '41%' },
              ].map(b => (
                <div key={b.brand} className="space-y-2">
                  <h4 className="text-sm font-black text-slate-700">{b.brand}</h4>
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

      {/* CEO 인사이트 탭 */}
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
