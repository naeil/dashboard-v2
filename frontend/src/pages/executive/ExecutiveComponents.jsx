import { useMemo, useState } from 'react'
import { pct, riskClass, statusLabel, won } from './formatters'

export function PageHeader({ title, description }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">Naeil Executive</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{title}</h1>
      {description && <p className="mt-2 text-sm font-medium text-slate-400">{description}</p>}
    </div>
  )
}

export function KpiCard({ label, value, change, badge, tone = 'sky', icon = 'monitoring', onClick, actionLabel }) {
  const toneMap = {
    sky: 'bg-sky-500/15 text-sky-200 border-sky-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20',
    amber: 'bg-amber-500/15 text-amber-100 border-amber-500/20',
    rose: 'bg-rose-500/15 text-rose-200 border-rose-500/20',
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold text-slate-400">{label}</p>
        <span className={`material-symbols-outlined rounded-lg border p-2 text-lg ${toneMap[tone] || toneMap.sky}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`text-xs font-bold ${Number(change || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          {change == null ? '기준 데이터' : `전월 대비 ${Number(change) >= 0 ? '+' : ''}${pct(change)}`}
        </span>
        {badge && <StatusBadge value={badge} />}
      </div>
      {actionLabel && <p className="mt-3 text-[11px] font-black text-sky-200">{actionLabel}</p>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group rounded-lg border border-white/10 bg-slate-900/70 p-5 text-left shadow-xl shadow-slate-950/20 transition-colors hover:border-sky-400/40 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
      >
        {content}
      </button>
    )
  }

  return (
    <article className="rounded-lg border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
      {content}
    </article>
  )
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
    <section className="rounded-lg border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/20">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function BarList({ rows = [], labelKey, valueKey, meta, maxValue }) {
  const max = maxValue ?? Math.max(0, ...rows.map((row) => Number(row[valueKey] || 0)))

  if (rows.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const width = max > 0 ? Math.max(5, Math.min(100, (Number(row[valueKey] || 0) / max) * 100)) : 0
        return (
          <div key={`${row[labelKey]}-${index}`} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{row[labelKey]}</p>
                {meta && <p className="text-xs text-slate-500">{meta(row)}</p>}
              </div>
              <span className="shrink-0 text-sm font-black text-sky-100">{won(row[valueKey])}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DataTable({ columns, rows = [], rowKey, searchable = true, searchPlaceholder = '검색어 입력' }) {
  const [query, setQuery] = useState('')
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!searchable || !normalizedQuery) {
      return rows
    }

    return rows.filter((row) => (
      columns.some((column) => {
        if (column.searchable === false) return false
        const value = row[column.key]
        return value != null && String(value).toLowerCase().includes(normalizedQuery)
      })
    ))
  }, [columns, query, rows, searchable])

  return (
    <div className="space-y-3">
      {searchable && (
        <label className="relative block max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500">search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 py-2 pl-10 pr-3 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>
      )}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left">
          <thead className="bg-slate-950/70">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-400">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredRows.map((row, index) => (
              <tr key={rowKey ? rowKey(row) : index} className="hover:bg-white/[0.03]">
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-200">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
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
    <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 py-12 text-center text-sm font-bold text-slate-500">
      {message}
    </div>
  )
}
