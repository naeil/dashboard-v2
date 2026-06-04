import { useMemo, useState } from 'react'
import { pct, riskClass, statusLabel, won } from './formatters'

function getSortValue(row, option) {
  if (!option) return ''
  if (typeof option.value === 'function') return option.value(row)
  if (option.key) return row[option.key]
  return row[option.id]
}

function compareValues(a, b, type = 'number') {
  if (type === 'text') {
    return String(a ?? '').localeCompare(String(b ?? ''), 'ko-KR')
  }
  if (type === 'date') {
    return new Date(a || 0).getTime() - new Date(b || 0).getTime()
  }
  return Number(a || 0) - Number(b || 0)
}

export function PageHeader({ title, description }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Naeil Business Platform</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h1>
      {description && <p className="mt-2 text-sm font-medium text-slate-500">{description}</p>}
    </div>
  )
}

export function KpiCard({ label, value, change, badge, tone = 'sky', icon = 'monitoring', onClick, actionLabel, helperText }) {
  const toneMap = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <span className={`material-symbols-outlined rounded-lg border p-2 text-lg ${toneMap[tone] || toneMap.sky}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`text-xs font-bold ${Number(change || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {helperText || (change == null ? '기준 데이터' : `전월 대비 ${Number(change) >= 0 ? '+' : ''}${pct(change)}`)}
        </span>
        {badge && <StatusBadge value={badge} />}
      </div>
      {actionLabel && <p className="mt-3 text-[11px] font-black text-sky-600">{actionLabel}</p>}
    </>
  )

  const className = 'rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/40 focus:outline-none focus:ring-2 focus:ring-sky-200'

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <article className={className}>{content}</article>
}

export function StatusBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${riskClass(value)}`}>
      {statusLabel(value)}
    </span>
  )
}

export function Panel({ title, right, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function BarList({ rows = [], labelKey, valueKey, meta, maxValue }) {
  const sortedRows = useMemo(() => [...rows].sort((a, b) => Number(b[valueKey] || 0) - Number(a[valueKey] || 0)), [rows, valueKey])
  const max = maxValue ?? Math.max(0, ...sortedRows.map((row) => Number(row[valueKey] || 0)))

  if (sortedRows.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      {sortedRows.map((row, index) => {
        const width = max > 0 ? Math.max(5, Math.min(100, (Number(row[valueKey] || 0) / max) * 100)) : 0
        return (
          <div key={`${row[labelKey]}-${index}`} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{row[labelKey]}</p>
                {meta && <p className="text-xs text-slate-500">{meta(row)}</p>}
              </div>
              <span className="shrink-0 text-sm font-black text-sky-700">{won(row[valueKey])}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DataTable({
  columns,
  rows = [],
  rowKey,
  searchable = true,
  searchPlaceholder = '검색어 입력',
  sortOptions = [],
  defaultSort,
}) {
  const [query, setQuery] = useState('')
  const effectiveSortOptions = useMemo(() => {
    if (sortOptions.length > 0) return sortOptions
    return columns
      .filter((column) => column.key && column.key !== 'actions' && column.sortable !== false)
      .slice(0, 8)
      .map((column) => {
        const isDate = /date|month|created|updated/i.test(column.key)
        return {
          id: `${column.key}Auto`,
          label: `${column.label} 기준 정렬`,
          key: column.key,
          type: isDate ? 'date' : undefined,
        }
      })
  }, [columns, sortOptions])
  const [sortId, setSortId] = useState(defaultSort || effectiveSortOptions[0]?.id || '')
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const searchedRows = !searchable || !normalizedQuery
      ? rows
      : rows.filter((row) => (
        columns.some((column) => {
          if (column.searchable === false) return false
          const value = row[column.key]
          return value != null && String(value).toLowerCase().includes(normalizedQuery)
        })
      ))

    const option = effectiveSortOptions.find((item) => item.id === sortId)
    if (!option) return searchedRows

    const direction = option.direction === 'asc' ? 1 : -1
    return [...searchedRows].sort((left, right) => (
      compareValues(getSortValue(left, option), getSortValue(right, option), option.type) * direction
    ))
  }, [columns, query, rows, searchable, sortId, effectiveSortOptions])

  return (
    <div className="space-y-3">
      {(searchable || effectiveSortOptions.length > 0) && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {searchable && (
            <label className="relative block max-w-md flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          )}
          {effectiveSortOptions.length > 0 && (
            <label className="flex items-center gap-2 self-start lg:self-auto">
              <span className="text-xs font-black text-slate-500">정렬</span>
              <select
                value={sortId}
                onChange={(event) => setSortId(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {effectiveSortOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row, index) => (
              <tr key={rowKey ? rowKey(row) : index} className="hover:bg-sky-50/40">
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm font-bold text-slate-400">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function EmptyState({ message = '표시할 데이터가 없습니다.' }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm font-bold text-slate-400">
      {message}
    </div>
  )
}
