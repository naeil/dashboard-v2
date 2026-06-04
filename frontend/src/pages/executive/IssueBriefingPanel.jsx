import { useEffect, useMemo, useState } from 'react'
import { getExecutiveIssueBriefing } from '../../api/executiveApi'
import { Panel } from './ExecutiveComponents'

const categories = ['전체', '경제', '뷰티', '식품', '연예인']

const scopeClass = {
  국내: 'border-sky-300 bg-sky-50 text-sky-700',
  해외: 'border-violet-300 bg-violet-50 text-violet-700',
}

const relevanceClass = {
  높음: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  보통: 'border-amber-300 bg-amber-50 text-amber-700',
  참고: 'border-slate-300 bg-slate-50 text-slate-600',
}

const categoryMeta = {
  경제: { icon: 'trending_up', label: '경제 흐름', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  뷰티: { icon: 'spa', label: '뷰티 트렌드', tone: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' },
  식품: { icon: 'nutrition', label: '식품/건강', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  연예인: { icon: 'brand_awareness', label: '브랜드/셀럽', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
}

function formatGeneratedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function categoryInfo(row) {
  return categoryMeta[row?.category] || categoryMeta.경제
}

function NewsBadges({ row, large = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${scopeClass[row.scope] || scopeClass.국내}`}>
        {row.scope}
      </span>
      <span className={`${large ? 'bg-white/90 text-slate-800' : 'border border-slate-200 bg-slate-50 text-slate-600'} rounded-full px-2.5 py-1 text-[11px] font-black`}>
        {row.category}
      </span>
      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${relevanceClass[row.relevance] || relevanceClass.참고}`}>
        연계 {row.relevance}
      </span>
    </div>
  )
}

function MainIssueCard({ row, label }) {
  if (!row) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-black text-slate-400">
        {label} 핵심 이슈가 없습니다.
      </div>
    )
  }

  return (
    <a
      href={row.link || '#'}
      target={row.link ? '_blank' : undefined}
      rel="noreferrer"
      className="group block min-h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/40"
    >
      <div className={`flex min-h-[128px] items-center justify-between gap-4 border-b p-6 ${categoryInfo(row).tone}`}>
        <div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-800 shadow-sm">{label} 메인 이슈</span>
          <p className="mt-4 text-sm font-black">{categoryInfo(row).label}</p>
        </div>
        <span className="material-symbols-outlined text-5xl opacity-80">{categoryInfo(row).icon}</span>
      </div>
      <div className="p-6">
        <NewsBadges row={row} />
        <h2 className="mt-4 line-clamp-3 text-2xl font-black leading-tight text-slate-950">{row.title}</h2>
        <p className="mt-4 line-clamp-3 text-base font-bold leading-7 text-sky-700">{row.oneLine}</p>
        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{row.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-black text-slate-500">
          <span className="truncate">{row.source || row.impactArea}</span>
          <span className="inline-flex items-center gap-1 text-slate-700">
            원문 보기
            <span className="material-symbols-outlined text-base">open_in_new</span>
          </span>
        </div>
      </div>
    </a>
  )
}

function BriefingCard({ row }) {
  return (
    <a
      href={row.link || '#'}
      target={row.link ? '_blank' : undefined}
      rel="noreferrer"
      className="grid min-h-[168px] grid-cols-[112px_1fr] overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-sky-300 hover:bg-sky-50/40"
    >
      <div className={`flex min-h-[168px] flex-col items-center justify-center gap-3 border-r ${categoryInfo(row).tone}`}>
        <span className="material-symbols-outlined text-4xl">{categoryInfo(row).icon}</span>
        <span className="px-2 text-center text-xs font-black leading-4">{categoryInfo(row).label}</span>
      </div>
      <div className="min-w-0 p-4">
        <NewsBadges row={row} />
        <p className="mt-3 line-clamp-2 text-base font-black leading-6 text-slate-950">{row.title}</p>
        <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-sky-700">{row.oneLine}</p>
        <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-500">{row.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span className="truncate">{row.impactArea}</span>
          <span className="material-symbols-outlined text-base">open_in_new</span>
        </div>
      </div>
    </a>
  )
}

export default function IssueBriefingPanel({ compact = false, onNavigate }) {
  const [payload, setPayload] = useState({ highlights: [], domestic: [], global: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [scope, setScope] = useState('전체')
  const [category, setCategory] = useState('전체')

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await getExecutiveIssueBriefing()
      setPayload(response.data || { highlights: [], domestic: [], global: [] })
    } catch (error) {
      setMessage(error?.response?.data?.message || '실시간 이슈를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const allRows = useMemo(() => [...(payload.domestic || []), ...(payload.global || [])], [payload])
  const domesticMain = useMemo(() => (payload.domestic || [])[0], [payload])
  const globalMain = useMemo(() => (payload.global || [])[0], [payload])

  const rows = useMemo(() => {
    const base = compact ? payload.highlights || [] : allRows
    return base.filter((row) => {
      const scopeOk = scope === '전체' || row.scope === scope
      const categoryOk = category === '전체' || row.category === category
      const mainOk = row.link !== domesticMain?.link && row.link !== globalMain?.link
      return scopeOk && categoryOk && (compact || mainOk)
    })
  }, [allRows, category, compact, domesticMain, globalMain, payload, scope])

  const categoryCounts = useMemo(() => {
    const counts = new Map(categories.map((item) => [item, item === '전체' ? allRows.length : 0]))
    allRows.forEach((row) => counts.set(row.category, (counts.get(row.category) || 0) + 1))
    return counts
  }, [allRows])

  return (
    <Panel
      title="실시간 이슈 브리핑"
      right={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs font-black text-slate-500">{formatGeneratedAt(payload.generatedAt)}</span>
          {compact ? (
            <button type="button" onClick={() => onNavigate?.('issue-briefing')} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              전체 보기
            </button>
          ) : (
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-sky-400"
            >
              <option>전체</option>
              <option>국내</option>
              <option>해외</option>
            </select>
          )}
        </div>
      )}
    >
      {message && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-black text-slate-500">
          국내외 이슈를 분석하는 중입니다.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            <MainIssueCard row={domesticMain} label="국내" />
            <MainIssueCard row={globalMain} label="해외" />
          </div>

          {!compact && (
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => {
                const active = category === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`h-10 rounded-lg border px-4 text-sm font-black transition-colors ${active ? 'border-sky-300 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {item}
                    <span className={`ml-2 text-xs ${active ? 'text-sky-100' : 'text-slate-400'}`}>{categoryCounts.get(item) || 0}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className={`grid gap-4 ${compact ? 'xl:grid-cols-2' : 'xl:grid-cols-2'}`}>
            {rows.slice(0, compact ? 4 : 24).map((row, index) => (
              <BriefingCard key={`${row.scope}-${row.category}-${row.link || row.title}-${index}`} row={row} />
            ))}
            {rows.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-black text-slate-500">
                표시할 이슈가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
