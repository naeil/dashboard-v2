import { useEffect, useMemo, useState } from 'react'
import {
  getLinkedMarketingKeywords,
  getMarketingAiAnalysis,
  getMetaAdsCreatives,
  getMetaAdsPerformance,
  getNaverCpcPerformance,
  searchKeywordTrend,
} from '../../api/executiveApi'
import { DataTable, EmptyState, KpiCard, PageHeader, Panel } from './ExecutiveComponents'
import { count, pct, won } from './formatters'

const tabs = [
  { id: 'keyword', label: '키워드 트렌드', icon: 'travel_explore' },
  { id: 'naver-cpc', label: '네이버 CPC', icon: 'paid' },
  { id: 'meta-ads', label: 'Meta 광고', icon: 'ads_click' },
  { id: 'ai-analysis', label: 'AI 분석', icon: 'psychology' },
]

const channelTabs = [
  { id: 'ALL', label: '전체' },
  { id: 'BLOG', label: '블로그' },
  { id: 'NEWS', label: '뉴스' },
  { id: 'WEB', label: '웹문서' },
]

const naverAdTypeTabs = [
  { id: 'ALL', label: '전체' },
  { id: 'SHOPPING_SEARCH', label: '쇼핑검색' },
  { id: 'POWERLINK', label: '파워링크' },
]

const today = new Date()
const defaultTo = today.toISOString().slice(0, 10)
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)

const errorMessage = (error) => error?.response?.data?.message || error.message || '데이터를 불러오지 못했습니다.'
const asRows = (payload) => payload?.rows || payload?.results || []

function LoadingSpinner({ label = '불러오는 중입니다.' }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-100">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200/30 border-t-sky-200" />
      {label}
    </div>
  )
}

function DateRangeControls({ from, to, onFromChange, onToChange, onLoad, loading }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="text-xs font-black text-slate-500">시작일</span>
        <input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-black text-slate-500">종료일</span>
        <input type="date" value={to} onChange={(event) => onToChange(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
      </label>
      <button type="button" onClick={onLoad} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60">
        <span className="material-symbols-outlined text-base">sync</span>
        조회
      </button>
    </div>
  )
}

function MessageBox({ tone = 'slate', children }) {
  const toneClass = tone === 'error'
    ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
    : 'border-white/10 bg-slate-950/50 text-slate-300'
  return <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${toneClass}`}>{children}</div>
}

function TimingCard({ row }) {
  const risk = ['부족', '공백', '초기'].includes(row.signal)
  const hot = ['활발', '경쟁 강함', '성숙'].includes(row.signal)
  const toneClass = risk
    ? 'border-rose-400/25 bg-rose-400/10'
    : hot
      ? 'border-amber-400/25 bg-amber-400/10'
      : 'border-sky-400/25 bg-sky-400/10'

  return (
    <article className={`rounded-lg border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-400">{row.label}</p>
          <p className="mt-2 text-3xl font-black text-white">{count(row.totalCount || 0, '건')}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-black text-slate-100">
          {row.signal}
        </span>
      </div>
      <p className="mt-3 text-xs font-black text-slate-300">
        블로그 {count(row.blogCount || 0, '건')} · 뉴스 {count(row.newsCount || 0, '건')}
      </p>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-200">{row.action}</p>
      <p className="mt-3 text-[11px] font-bold text-slate-500">{row.basis}</p>
    </article>
  )
}

function KeywordTrendTab() {
  const [keyword, setKeyword] = useState('')
  const [activeChannel, setActiveChannel] = useState('ALL')
  const [linkedKeywords, setLinkedKeywords] = useState([])
  const [linkedLoading, setLinkedLoading] = useState(false)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (nextKeyword = keyword) => {
    const normalized = nextKeyword.trim()
    if (!normalized) {
      setError('검색 키워드를 입력해주세요.')
      return
    }

    setKeyword(normalized)
    setLoading(true)
    setError('')
    try {
      const response = await searchKeywordTrend(normalized)
      setPayload(response.data)
      setActiveChannel('ALL')
    } catch (err) {
      setPayload(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    const loadLinkedKeywords = async () => {
      setLinkedLoading(true)
      setError('')
      try {
        const response = await getLinkedMarketingKeywords({ adType: 'ALL', limit: 30 })
        if (ignore) return
        const rows = response.data?.keywords || []
        setLinkedKeywords(rows)
        if (rows.length > 0) {
          search(rows[0].keyword)
        } else {
          setError('검색광고에 연결된 키워드가 없습니다.')
        }
      } catch (err) {
        if (!ignore) {
          setLinkedKeywords([])
          setError(errorMessage(err))
        }
      } finally {
        if (!ignore) setLinkedLoading(false)
      }
    }

    loadLinkedKeywords()
    return () => {
      ignore = true
    }
  }, [])

  const results = payload?.results || []
  const filteredResults = activeChannel === 'ALL' ? results : results.filter((result) => result.channel === activeChannel)

  return (
    <div className="space-y-6">
      <Panel title="검색광고 연계 키워드 검색">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500">search</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') search()
                }}
                placeholder="연결 키워드를 선택하거나 직접 입력하세요."
                className="h-12 w-full rounded-lg border border-white/10 bg-slate-950 py-2 pl-10 pr-4 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
            <button type="button" onClick={() => search()} disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60">
              <span className="material-symbols-outlined text-base">manage_search</span>
              검색
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {linkedLoading && <LoadingSpinner label="연결 키워드를 불러오는 중입니다." />}
            {linkedKeywords.map((item) => (
              <button
                type="button"
                key={`${item.sourceType}-${item.keyword}-${item.adGroupName}`}
                onClick={() => search(item.keyword)}
                title={`${item.adTypeLabel} · ${item.campaignName} · ${item.adGroupName}`}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-sky-400/40 hover:bg-sky-400/10"
              >
                <span className="text-sky-200">{item.adTypeLabel}</span>
                <span className="mx-1 text-slate-600">·</span>
                {item.keyword}
              </button>
            ))}
          </div>
          {error && <MessageBox tone="error">{error}</MessageBox>}
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="전체 노출" value={count(payload?.summary?.totalCount || 0, '건')} icon="monitoring" helperText="네이버 실제 검색 total" />
        <KpiCard label="블로그" value={count(payload?.summary?.blogCount || 0, '건')} icon="edit_note" tone="emerald" helperText="네이버 블로그 total" />
        <KpiCard label="뉴스" value={count(payload?.summary?.newsCount || 0, '건')} icon="newspaper" tone="amber" helperText="네이버 뉴스 total" />
        <KpiCard label="웹문서" value={count(payload?.summary?.webCount || 0, '건')} icon="language" tone="sky" helperText="네이버 웹문서 total" />
      </section>

      <Panel title="콘텐츠 마케팅 타이밍">
        {payload?.postingWindows?.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {payload.postingWindows.map((row) => <TimingCard key={row.days} row={row} />)}
          </div>
        ) : (
          <EmptyState message="키워드를 검색하면 최근 7일, 30일, 3개월 포스팅 빈도를 분석합니다." />
        )}
      </Panel>

      <Panel title="규칙 기반 요약">
        {payload?.insights?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {payload.insights.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm font-bold leading-6 text-slate-200">
                {item}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="검색하면 노출 현황 요약을 표시합니다." />
        )}
      </Panel>

      <Panel
        title="검색 결과"
        right={(
          <div className="flex flex-wrap gap-2">
            {channelTabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveChannel(tab.id)} className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${activeChannel === tab.id ? 'bg-sky-400 text-slate-950' : 'bg-white/[0.04] text-slate-300 hover:bg-white/10'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      >
        {filteredResults.length === 0 ? (
          <EmptyState message={loading ? '검색 중입니다.' : '검색 결과가 없습니다.'} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredResults.map((result, index) => (
              <a key={`${result.channel}-${result.link}-${index}`} href={result.link} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-slate-950/60 p-4 transition-colors hover:border-sky-400/40 hover:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md bg-sky-400/10 px-2.5 py-1 text-[11px] font-black text-sky-200">{result.channel}</span>
                  <span className="text-xs font-bold text-slate-500">{result.publishedAt || '작성일 없음'}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-base font-black text-white">{result.title || '제목 없음'}</h3>
                <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-slate-400">{result.description || '설명 없음'}</p>
              </a>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function NaverCpcTab() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [adType, setAdType] = useState('ALL')
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getNaverCpcPerformance({ from, to, adType })
      setPayload(response.data)
    } catch (err) {
      setPayload(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [adType])

  const rows = asRows(payload)
  const totals = payload?.summary || {}

  return (
    <div className="space-y-6">
      <Panel title="네이버 검색광고 성과" right={<div className="flex flex-wrap gap-2">{naverAdTypeTabs.map((tab) => <button key={tab.id} type="button" onClick={() => setAdType(tab.id)} className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${adType === tab.id ? 'bg-sky-400 text-slate-950' : 'bg-white/[0.04] text-slate-300 hover:bg-white/10'}`}>{tab.label}</button>)}</div>}>
        <DateRangeControls from={from} to={to} onFromChange={setFrom} onToChange={setTo} onLoad={load} loading={loading} />
        <div className="mt-4 space-y-3">
          {loading && <LoadingSpinner label="네이버 광고 데이터를 불러오는 중입니다." />}
          {error && <MessageBox tone="error">{error}</MessageBox>}
          {payload?.message && <MessageBox>{payload.message}</MessageBox>}
        </div>
      </Panel>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="노출" value={count(totals.impressions || 0)} icon="visibility" />
        <KpiCard label="클릭" value={count(totals.clicks || 0)} icon="ads_click" tone="emerald" />
        <KpiCard label="CTR" value={pct(totals.ctr || 0)} icon="percent" tone="amber" />
        <KpiCard label="광고비" value={won(totals.cost || 0)} icon="payments" tone="rose" />
        <KpiCard label="ROAS" value={pct(totals.roas || 0)} icon="query_stats" tone="emerald" />
      </section>
      <Panel title="광고 영역별 성과">
        <DataTable
          rows={rows}
          searchPlaceholder="광고 종류, 캠페인, 광고그룹, 키워드 검색"
          columns={[
            { key: 'date', label: '일자' },
            { key: 'adTypeLabel', label: '광고 종류' },
            { key: 'campaignName', label: '캠페인' },
            { key: 'adGroupName', label: '광고그룹' },
            { key: 'keyword', label: '키워드' },
            { key: 'impressions', label: '노출', render: (row) => count(row.impressions) },
            { key: 'clicks', label: '클릭', render: (row) => count(row.clicks) },
            { key: 'ctr', label: 'CTR', render: (row) => pct(row.ctr) },
            { key: 'avgCpc', label: '평균 CPC', render: (row) => won(row.avgCpc) },
            { key: 'cost', label: '광고비', render: (row) => won(row.cost) },
            { key: 'conversions', label: '전환', render: (row) => row.conversions == null ? '전환 데이터 없음' : count(row.conversions) },
            { key: 'conversionValue', label: '전환 매출', render: (row) => won(row.conversionValue) },
            { key: 'roas', label: 'ROAS', render: (row) => pct(row.roas) },
          ]}
          defaultSort="impressionsDesc"
          sortOptions={[
            { id: 'impressionsDesc', label: '노출 높은 순', key: 'impressions' },
            { id: 'clicksDesc', label: '클릭 높은 순', key: 'clicks' },
            { id: 'ctrDesc', label: '클릭률 높은 순', key: 'ctr' },
            { id: 'costDesc', label: '광고비 높은 순', key: 'cost' },
            { id: 'roasDesc', label: 'ROAS 높은 순', key: 'roas' },
            { id: 'dateDesc', label: '최근 일자 순', key: 'date', type: 'date' },
          ]}
        />
      </Panel>
    </div>
  )
}

function CreativeImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-44 w-full items-center justify-center bg-slate-900 text-xs font-black text-slate-600">
        이미지 없음
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt || '광고 소재'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-44 w-full object-cover"
    />
  )
}

function CreativeMetric({ label, value }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs font-black text-white">{value}</p>
    </div>
  )
}

function MetaAdsTab() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creatives, setCreatives] = useState([])
  const [creativesLoading, setCreativesLoading] = useState(false)
  const [creativeMessage, setCreativeMessage] = useState('')
  const [creativeSort, setCreativeSort] = useState('impressionsDesc')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getMetaAdsPerformance({ from, to, level: 'campaign' })
      setPayload(response.data)
    } catch (err) {
      setPayload(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }

    setCreativesLoading(true)
    setCreativeMessage('')
    try {
      const response = await getMetaAdsCreatives({ from, to })
      setCreatives(response.data?.rows || [])
      setCreativeMessage(response.data?.message || '')
    } catch (err) {
      setCreatives([])
      setCreativeMessage(errorMessage(err))
    } finally {
      setCreativesLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const rows = asRows(payload)
  const totals = payload?.summary || {}
  const sortedCreatives = useMemo(() => {
    const sorters = {
      impressionsDesc: (item) => Number(item.impressions || 0),
      clicksDesc: (item) => Number(item.clicks || 0),
      ctrDesc: (item) => Number(item.ctr || 0),
      costDesc: (item) => Number(item.cost || 0),
      cpcAsc: (item) => -Number(item.cpc || 0),
      reachDesc: (item) => Number(item.reach || 0),
    }
    const value = sorters[creativeSort] || sorters.impressionsDesc
    return [...creatives].sort((a, b) => value(b) - value(a))
  }, [creativeSort, creatives])

  return (
    <div className="space-y-6">
      <Panel title="Meta 광고 성과">
        <DateRangeControls from={from} to={to} onFromChange={setFrom} onToChange={setTo} onLoad={load} loading={loading} />
        <div className="mt-4 space-y-3">
          {loading && <LoadingSpinner label="Meta 광고 데이터를 불러오는 중입니다. 보통 2~5초 정도 걸립니다." />}
          {error && <MessageBox tone="error">{error}</MessageBox>}
          {payload?.message && <MessageBox>{payload.message}</MessageBox>}
        </div>
      </Panel>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="총 지출" value={won(totals.cost || 0)} icon="payments" tone="rose" />
        <KpiCard label="노출" value={count(totals.impressions || 0)} icon="visibility" />
        <KpiCard label="클릭" value={count(totals.clicks || 0)} icon="ads_click" tone="emerald" />
        <KpiCard label="CTR" value={pct(totals.ctr || 0)} icon="percent" tone="amber" />
        <KpiCard label="CPC" value={won(totals.cpc || 0)} icon="paid" tone="sky" />
      </section>
      <Panel title="캠페인별 상세">
        <DataTable
          rows={rows}
          searchPlaceholder="캠페인명 검색"
          columns={[
            { key: 'campaignName', label: '캠페인' },
            { key: 'cost', label: '총 지출', render: (row) => won(row.cost) },
            { key: 'impressions', label: '노출', render: (row) => count(row.impressions) },
            { key: 'reach', label: '도달', render: (row) => count(row.reach) },
            { key: 'clicks', label: '클릭', render: (row) => count(row.clicks) },
            { key: 'ctr', label: 'CTR', render: (row) => pct(row.ctr) },
            { key: 'cpc', label: 'CPC', render: (row) => won(row.cpc) },
            { key: 'conversions', label: '구매 전환', render: (row) => count(row.conversions || 0) },
            { key: 'cpa', label: 'CPA', render: (row) => row.cpa == null ? '전환 없음' : won(row.cpa) },
          ]}
          defaultSort="costDesc"
          sortOptions={[
            { id: 'costDesc', label: '지출 높은 순', key: 'cost' },
            { id: 'impressionsDesc', label: '노출 높은 순', key: 'impressions' },
            { id: 'reachDesc', label: '도달 높은 순', key: 'reach' },
            { id: 'clicksDesc', label: '클릭 높은 순', key: 'clicks' },
            { id: 'ctrDesc', label: '클릭률 높은 순', key: 'ctr' },
            { id: 'cpcAsc', label: 'CPC 낮은 순', key: 'cpc', direction: 'asc' },
            { id: 'conversionsDesc', label: '전환 높은 순', key: 'conversions' },
          ]}
        />
      </Panel>
      <Panel
        title="광고 소재별 성과"
        right={(
          <label className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500">정렬</span>
            <select value={creativeSort} onChange={(event) => setCreativeSort(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-sky-400">
              <option value="impressionsDesc">조회수/노출 높은 순</option>
              <option value="clicksDesc">클릭 높은 순</option>
              <option value="ctrDesc">클릭률 높은 순</option>
              <option value="reachDesc">도달 높은 순</option>
              <option value="costDesc">지출 높은 순</option>
              <option value="cpcAsc">CPC 낮은 순</option>
            </select>
          </label>
        )}
      >
        {creativesLoading && <LoadingSpinner label="광고 소재를 불러오는 중입니다." />}
        {!creativesLoading && creatives.length === 0 && (
          <EmptyState message={creativeMessage || '표시할 광고 소재가 없습니다.'} />
        )}
        {!creativesLoading && creatives.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedCreatives.map((creative, index) => (
              <article key={`${creative.adName}-${index}`} className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
                <CreativeImage src={creative.thumbnailUrl} alt={creative.title || creative.adName} />
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-[11px] font-black text-sky-300">{creative.campaignName || '캠페인 미상'}</p>
                    <h3 className="mt-1 line-clamp-1 text-sm font-black text-white">{creative.title || creative.adName || '제목 없음'}</h3>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-400">{creative.body || '광고 문구 없음'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <CreativeMetric label="지출" value={won(creative.cost || 0)} />
                    <CreativeMetric label="노출" value={count(creative.impressions || 0)} />
                    <CreativeMetric label="클릭" value={count(creative.clicks || 0)} />
                    <CreativeMetric label="CTR" value={pct(creative.ctr || 0)} />
                    <CreativeMetric label="CPC" value={won(creative.cpc || 0)} />
                    <CreativeMetric label="도달" value={count(creative.reach || 0)} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function AiAnalysisTab() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getMarketingAiAnalysis({ from, to })
      setPayload(response.data)
    } catch (err) {
      setPayload(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <Panel title="CFO/COO 관점 AI 분석">
        <DateRangeControls from={from} to={to} onFromChange={setFrom} onToChange={setTo} onLoad={load} loading={loading} />
        <div className="mt-4 space-y-3">
          {loading && <LoadingSpinner label="분석 데이터를 불러오는 중입니다." />}
          {error && <MessageBox tone="error">{error}</MessageBox>}
        </div>
      </Panel>
      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="요약">
          <p className="text-sm font-bold leading-6 text-slate-200">{payload?.summary || '분석할 마케팅 데이터가 아직 없습니다.'}</p>
        </Panel>
        <Panel title="위험">
          {payload?.risks?.length ? <div className="space-y-3">{payload.risks.map((item, index) => <MessageBox key={`${item}-${index}`}>{item}</MessageBox>)}</div> : <EmptyState message="감지된 위험이 없습니다." />}
        </Panel>
        <Panel title="우선 실행">
          {payload?.recommendedActions?.length ? <div className="space-y-3">{payload.recommendedActions.map((item, index) => <MessageBox key={`${item}-${index}`}>{item}</MessageBox>)}</div> : <EmptyState message="추천 실행 항목이 없습니다." />}
        </Panel>
      </section>
    </div>
  )
}

export default function MarketingStatusPage() {
  const [activeTab, setActiveTab] = useState('keyword')
  const activeTabMeta = useMemo(() => tabs.find((tab) => tab.id === activeTab), [activeTab])

  return (
    <>
      <PageHeader
        title="마케팅 현황"
        description="브랜드 키워드 노출, 콘텐츠 타이밍, 네이버 CPC, Meta 광고, 규칙 기반 AI 분석을 한 화면에서 관리합니다."
      />

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-2">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition-colors ${activeTab === tab.id ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-sky-300">
        <span className="material-symbols-outlined text-base">{activeTabMeta?.icon}</span>
        {activeTabMeta?.label}
      </div>

      {activeTab === 'keyword' && <KeywordTrendTab />}
      {activeTab === 'naver-cpc' && <NaverCpcTab />}
      {activeTab === 'meta-ads' && <MetaAdsTab />}
      {activeTab === 'ai-analysis' && <AiAnalysisTab />}
    </>
  )
}

