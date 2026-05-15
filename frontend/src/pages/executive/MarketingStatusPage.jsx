import { useEffect, useMemo, useState } from 'react'
import {
  getMarketingAiAnalysis,
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

const keywordButtons = ['단백깡', '하이프리', '단백질 과자', '프로틴 스낵']
const channelTabs = [
  { id: 'ALL', label: '전체' },
  { id: 'BLOG', label: '블로그' },
  { id: 'NEWS', label: '뉴스' },
  { id: 'WEB', label: '웹문서' },
]

const today = new Date()
const defaultTo = today.toISOString().slice(0, 10)
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)

const errorMessage = (error) => error?.response?.data?.message || '데이터를 불러오지 못했습니다'
const asRows = (payload) => payload?.rows || payload?.results || []

function DateRangeControls({ from, to, onFromChange, onToChange, onLoad, loading }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="text-xs font-black text-slate-500">시작일</span>
        <input
          type="date"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          className="h-11 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-black text-slate-500">종료일</span>
        <input
          type="date"
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          className="h-11 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
        />
      </label>
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
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

function KeywordTrendTab() {
  const [keyword, setKeyword] = useState('단백깡')
  const [activeChannel, setActiveChannel] = useState('ALL')
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
    search('단백깡')
  }, [])

  const results = payload?.results || []
  const filteredResults = activeChannel === 'ALL'
    ? results
    : results.filter((result) => result.channel === activeChannel)

  return (
    <div className="space-y-6">
      <Panel title="키워드 검색">
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
                placeholder="키워드를 입력하세요"
                className="h-12 w-full rounded-lg border border-white/10 bg-slate-950 py-2 pl-10 pr-4 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
            <button
              type="button"
              onClick={() => search()}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base">manage_search</span>
              검색
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywordButtons.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => search(item)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-sky-400/40 hover:bg-sky-400/10"
              >
                {item}
              </button>
            ))}
          </div>
          {error && <MessageBox tone="error">{error}</MessageBox>}
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="전체 노출" value={count(payload?.summary?.totalCount || 0, '건')} icon="monitoring" />
        <KpiCard label="블로그" value={count(payload?.summary?.blogCount || 0, '건')} icon="edit_note" tone="emerald" />
        <KpiCard label="뉴스" value={count(payload?.summary?.newsCount || 0, '건')} icon="newspaper" tone="amber" />
        <KpiCard label="웹문서" value={count(payload?.summary?.webCount || 0, '건')} icon="language" tone="sky" />
      </section>

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
          <EmptyState message="검색 후 노출 현황 요약이 표시됩니다." />
        )}
      </Panel>

      <Panel
        title="검색 결과"
        right={(
          <div className="flex flex-wrap gap-2">
            {channelTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveChannel(tab.id)}
                className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                  activeChannel === tab.id
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/10'
                }`}
              >
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
              <a
                key={`${result.channel}-${result.link}-${index}`}
                href={result.link}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/10 bg-slate-950/60 p-4 transition-colors hover:border-sky-400/40 hover:bg-slate-950"
              >
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
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getNaverCpcPerformance({ from, to })
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

  const rows = asRows(payload)
  const totals = payload?.summary || {}

  return (
    <div className="space-y-6">
      <Panel title="네이버 검색광고 성과">
        <DateRangeControls from={from} to={to} onFromChange={setFrom} onToChange={setTo} onLoad={load} loading={loading} />
        {error && <div className="mt-4"><MessageBox tone="error">{error}</MessageBox></div>}
        {payload?.message && <div className="mt-4"><MessageBox>{payload.message}</MessageBox></div>}
      </Panel>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="노출수" value={count(totals.impressions || 0)} icon="visibility" />
        <KpiCard label="클릭수" value={count(totals.clicks || 0)} icon="ads_click" tone="emerald" />
        <KpiCard label="CTR" value={pct(totals.ctr || 0)} icon="percent" tone="amber" />
        <KpiCard label="광고비" value={won(totals.cost || 0)} icon="payments" tone="rose" />
      </section>
      <Panel title="키워드별 성과">
        <DataTable
          rows={rows}
          searchPlaceholder="캠페인, 광고그룹, 키워드 검색"
          columns={[
            { key: 'date', label: '일자' },
            { key: 'campaignName', label: '캠페인' },
            { key: 'adGroupName', label: '광고그룹' },
            { key: 'keyword', label: '키워드' },
            { key: 'impressions', label: '노출수', render: (row) => count(row.impressions) },
            { key: 'clicks', label: '클릭수', render: (row) => count(row.clicks) },
            { key: 'ctr', label: 'CTR', render: (row) => pct(row.ctr) },
            { key: 'avgCpc', label: '평균 CPC', render: (row) => won(row.avgCpc) },
            { key: 'cost', label: '광고비', render: (row) => won(row.cost) },
            { key: 'conversions', label: '전환', render: (row) => row.conversions == null ? '전환 데이터 없음' : count(row.conversions) },
          ]}
        />
      </Panel>
    </div>
  )
}

function MetaAdsTab() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getMetaAdsPerformance({ from, to })
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

  const rows = asRows(payload)
  const totals = payload?.summary || {}

  return (
    <div className="space-y-6">
      <Panel title="Meta 광고 성과">
        <DateRangeControls from={from} to={to} onFromChange={setFrom} onToChange={setTo} onLoad={load} loading={loading} />
        {error && <div className="mt-4"><MessageBox tone="error">{error}</MessageBox></div>}
        {payload?.message && <div className="mt-4"><MessageBox>{payload.message}</MessageBox></div>}
      </Panel>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="광고비" value={won(totals.cost || 0)} icon="payments" tone="rose" />
        <KpiCard label="노출수" value={count(totals.impressions || 0)} icon="visibility" />
        <KpiCard label="CTR" value={pct(totals.ctr || 0)} icon="percent" tone="amber" />
        <KpiCard label="ROAS" value={pct(totals.roas || 0)} icon="query_stats" tone="emerald" />
      </section>
      <Panel title="캠페인 / 광고세트 성과">
        <DataTable
          rows={rows}
          searchPlaceholder="캠페인, 광고세트, 광고명 검색"
          columns={[
            { key: 'date', label: '일자' },
            { key: 'campaignName', label: '캠페인' },
            { key: 'adsetName', label: '광고세트' },
            { key: 'adName', label: '광고명' },
            { key: 'cost', label: '광고비', render: (row) => won(row.cost) },
            { key: 'impressions', label: '노출수', render: (row) => count(row.impressions) },
            { key: 'clicks', label: '클릭수', render: (row) => count(row.clicks) },
            { key: 'ctr', label: 'CTR', render: (row) => pct(row.ctr) },
            { key: 'cpc', label: 'CPC', render: (row) => won(row.cpc) },
            { key: 'cpm', label: 'CPM', render: (row) => won(row.cpm) },
            { key: 'cpa', label: 'CPA', render: (row) => row.cpa == null ? '전환 데이터 없음' : won(row.cpa) },
            { key: 'roas', label: 'ROAS', render: (row) => pct(row.roas) },
          ]}
        />
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
        {error && <div className="mt-4"><MessageBox tone="error">{error}</MessageBox></div>}
      </Panel>
      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="요약">
          <p className="text-sm font-bold leading-6 text-slate-200">{payload?.summary || '분석할 마케팅 데이터가 아직 없습니다.'}</p>
        </Panel>
        <Panel title="위험">
          {payload?.risks?.length ? (
            <div className="space-y-3">
              {payload.risks.map((item, index) => <MessageBox key={`${item}-${index}`}>{item}</MessageBox>)}
            </div>
          ) : (
            <EmptyState message="감지된 위험이 없습니다." />
          )}
        </Panel>
        <Panel title="우선 실행">
          {payload?.recommendedActions?.length ? (
            <div className="space-y-3">
              {payload.recommendedActions.map((item, index) => <MessageBox key={`${item}-${index}`}>{item}</MessageBox>)}
            </div>
          ) : (
            <EmptyState message="추천 실행 항목이 없습니다." />
          )}
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
        description="브랜드 키워드 노출, 네이버 CPC, Meta 광고, 규칙 기반 AI 분석을 한 화면에서 관리합니다."
      />

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
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
