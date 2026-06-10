import { useEffect, useState } from 'react'
import { getPromotionHistory } from '../../api/promotionMarginApi'

// 채널 탭 정의
const CHANNEL_TABS = [
  { id: null,      label: '전체',      icon: 'list' },
  { id: 'online',  label: '온라인',    icon: 'language' },
  { id: 'offline', label: '오프라인',  icon: 'store' },
  { id: 'export',  label: '해외 수출', icon: 'flight_takeoff' },
  ]

const CHANNEL_STYLE = {
    online:  { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   bar: 'bg-blue-500' },
    offline: { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', bar: 'bg-orange-500' },
    export:  { badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',  bar: 'bg-green-500' },
}

const fmtW = (v) => `${Math.round(Number(v || 0)).toLocaleString('ko-KR')}원`
const fmtN = (v) => Number(v || 0).toLocaleString('ko-KR')
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`
const channelLabel = (ch) =>
    ch === 'online' ? '온라인' : ch === 'offline' ? '오프라인' : ch === 'export' ? '해외 수출' : ch

// 달성률에 따른 색상
function achieveColor(rate) {
    const r = Number(rate || 0)
    if (r >= 100) return 'text-green-600 dark:text-green-400'
    if (r >= 60)  return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-500'
}

function achieveBadge(rate) {
    const r = Number(rate || 0)
    if (r >= 100) return 'bg-green-100 text-green-700'
    if (r >= 60)  return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
}

// 진행률 바
function ProgressBar({ value, max, colorClass = 'bg-blue-500' }) {
    const pct = max > 0 ? Math.min(100, (Number(value) / Number(max)) * 100) : 0
    return (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
          </div>div>
        )
}

// 개별 프로모션 카드
function HistoryCard({ item }) {
    const style = CHANNEL_STYLE[item.channel] || CHANNEL_STYLE.online
        const profit = Number(item.actualOperatingProfit || 0)
            const targetProfit = Number(item.targetOperatingProfit || 0)
              
                return (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                        {/* 헤더 */}
                            <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{item.productName}</p>p>
                                              <p className="text-xs text-gray-400 mt-0.5">
                                                {item.promotionType}
                                                {item.skuCode ? ` · ${item.skuCode}` : ''}
                                                {' · '}
                                                {item.promoStartDate} ~ {item.promoEndDate}
                                              </p>p>
                                    </div>div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                                                {channelLabel(item.channel)}
                                              </span>span>
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${achieveBadge(item.revenueAchievementRate)}`}>
                                                {fmtPct(item.revenueAchievementRate)}
                                              </span>span>
                                    </div>div>
                            </div>div>
                      
                        {/* 3컬럼 지표 */}
                            <div className="grid grid-cols-3 gap-2">
                              {/* 목표 매출 */}
                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                                              <p className="text-[11px] text-gray-400 mb-1">목표 매출</p>p>
                                              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{fmtW(item.targetRevenue)}</p>p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">{fmtN(item.targetQty)}개 목표</p>p>
                                    </div>div>
                            
                              {/* 실시간 매출 */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                              <p className="text-[11px] text-blue-400 mb-1">실시간 매출</p>p>
                                              <p className="text-sm font-bold text-blue-600 dark:text-blue-300">{fmtW(item.actualRevenue)}</p>p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">{fmtN(item.actualQty)}개 판매</p>p>
                                              <ProgressBar value={item.actualRevenue} max={item.targetRevenue} colorClass={style.bar} />
                                    </div>div>
                            
                              {/* 실시간 영업이익 */}
                                    <div className={`rounded-lg p-3 text-center ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                              <p className="text-[11px] text-gray-400 mb-1">실시간 영업이익</p>p>
                                              <p className={`text-sm font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                {fmtW(profit)}
                                              </p>p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">목표 {fmtW(targetProfit)}</p>p>
                                              <ProgressBar value={profit} max={targetProfit} colorClass={profit >= 0 ? 'bg-green-500' : 'bg-red-500'} />
                                    </div>div>
                            </div>div>
                      </div>div>
                    )
}

// 채널 섹션
function ChannelSection({ summary }) {
    const style = CHANNEL_STYLE[summary.channel] || CHANNEL_STYLE.online
        const [open, setOpen] = useState(true)
          
            return (
                  <div className="space-y-3">
                    {/* 채널 집계 헤더 */}
                        <button
                                  onClick={() => setOpen((v) => !v)}
                                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left"
                                >
                                <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2">
                                                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
                                                        {channelLabel(summary.channel)}
                                                      </span>span>
                                                      <span className="text-sm text-gray-500">프로모션 {summary.promotionCount}건</span>span>
                                          </div>div>
                                          <div className="flex items-center gap-2">
                                                      <span className={`text-sm font-bold ${achieveColor(summary.overallAchievementRate)}`}>
                                                                    달성 {fmtPct(summary.overallAchievementRate)}
                                                      </span>span>
                                                      <span className="material-icons text-gray-400 text-[18px]">
                                                        {open ? 'expand_less' : 'expand_more'}
                                                      </span>span>
                                          </div>div>
                                </div>div>
                        
                          {/* 채널 합계 3컬럼 */}
                                <div className="grid grid-cols-3 gap-3 text-center">
                                          <div>
                                                      <p className="text-[11px] text-gray-400">목표 매출 합계</p>p>
                                                      <p className="text-base font-bold text-gray-700 dark:text-gray-200">{fmtW(summary.totalTargetRevenue)}</p>p>
                                          </div>div>
                                          <div>
                                                      <p className="text-[11px] text-gray-400">실시간 매출 합계</p>p>
                                                      <p className="text-base font-bold text-blue-600 dark:text-blue-400">{fmtW(summary.totalActualRevenue)}</p>p>
                                                      <ProgressBar value={summary.totalActualRevenue} max={summary.totalTargetRevenue} colorClass={style.bar} />
                                          </div>div>
                                          <div>
                                                      <p className="text-[11px] text-gray-400">실시간 영업이익</p>p>
                                                      <p className={`text-base font-bold ${Number(summary.totalActualOperatingProfit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                        {fmtW(summary.totalActualOperatingProfit)}
                                                      </p>p>
                                          </div>div>
                                </div>div>
                        </button>button>
                  
                    {/* 개별 카드 목록 */}
                    {open && (summary.items || []).map((item) => (
                            <HistoryCard key={item.id} item={item} />
                          ))}
                  </div>div>
                )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function PromotionHistoryPage({ companyId = 1, onNavigate }) {
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
                      
                        return (
                              <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
                                {/* 페이지 타이틀 */}
                                    <div className="flex items-center justify-between">
                                            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                                      <span className="material-icons text-blue-500">receipt_long</span>span>
                                                      프로모션 내역
                                            </h1>h1>
                                      {onNavigate && (
                                          <button
                                                        onClick={() => onNavigate('promotion-margin')}
                                                        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                                      >
                                                      <span className="material-icons text-[16px]">sell</span>span>
                                                      프로모션 마진 서식 작성
                                          </button>button>
                                            )}
                                    </div>div>
                              
                                {/* 채널 탭 */}
                                    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
                                      {CHANNEL_TABS.map((tab) => (
                                          <button
                                                        key={String(tab.id)}
                                                        onClick={() => setActiveChannel(tab.id)}
                                                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                                                        activeChannel === tab.id
                                                                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'
                                                        }`}
                                                      >
                                                      <span className="material-icons text-[16px]">{tab.icon}</span>span>
                                            {tab.label}
                                          </button>button>
                                        ))}
                                    </div>div>
                              
                                {/* 로딩 */}
                                {loading && (
                                        <div className="text-center py-16">
                                                  <span className="material-icons text-4xl text-gray-300 animate-spin block mb-2">refresh</span>span>
                                                  <p className="text-gray-400">불러오는 중...</p>p>
                                        </div>div>
                                    )}
                              
                                {/* 에러 */}
                                {!loading && error && (
                                        <div className="text-center py-16">
                                                  <span className="material-icons text-4xl text-red-300 block mb-2">error_outline</span>span>
                                                  <p className="text-red-400">{error}</p>p>
                                                  <button
                                                                onClick={() => setActiveChannel(activeChannel)}
                                                                className="mt-3 text-sm text-blue-500 hover:underline"
                                                              >
                                                              다시 시도
                                                  </button>button>
                                        </div>div>
                                    )}
                              
                                {/* 빈 상태 */}
                                {!loading && !error && summaries.length === 0 && (
                                        <div className="text-center py-16 text-gray-400">
                                                  <span className="material-icons text-5xl mb-3 block text-gray-300">receipt_long</span>span>
                                                  <p className="font-medium">등록된 프로모션 내역이 없습니다.</p>p>
                                                  <p className="text-sm mt-1 mb-4">프로모션 마진 서식을 작성하고 제출하면 여기에 표시됩니다.</p>p>
                                          {onNavigate && (
                                                      <button
                                                                      onClick={() => onNavigate('promotion-margin')}
                                                                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                                                                    >
                                                                    프로모션 마진 서식 작성하기
                                                      </button>button>
                                                  )}
                                        </div>div>
                                    )}
                              
                                {/* 채널별 섹션 */}
                                {!loading && !error && summaries.length > 0 && (
                                        <div className="space-y-6">
                                          {summaries.map((summary) => (
                                                      <ChannelSection key={summary.channel} summary={summary} />
                                                    ))}
                                        </div>div>
                                    )}
                              </div>div>
                            )
                          }</div>
