import { useCallback, useEffect, useMemo, useState } from 'react'
import { getExecutiveProductProfits, updateExecutiveRecord } from '../../api/executiveApi'
import { getLatestThreePlSnapshot, getThreePlSnapshotHistory, saveThreePlSnapshot } from '../../api/inventoryApi'
import {
  DEFAULT_INVENTORY_SETTINGS,
  SHEET_STORAGE,
  STATUS_META,
  daysInMonth,
  defaultAsOfDate,
  diffDays,
  evaluateProduct,
  lastActivityDay,
  matchThreePlItems,
  normalizeName,
  parseThreePlFile,
  summarizeItem,
  toDateKey,
} from '../../utils/threePlInventory'
import { KpiCard, PageHeader, Panel } from './ExecutiveComponents'
import { count, won } from './formatters'

const BRAND_CATEGORIES = ['하이프리', '국민한상']
const SETTINGS_KEY = 'naeil.inventory.settings.v1'

const TONE = {
  rose: { pill: 'border-rose-200 bg-rose-50 text-rose-700', bar: 'bg-rose-500', dot: 'bg-rose-500', note: 'border-rose-200 bg-rose-50 text-rose-800' },
  amber: { pill: 'border-amber-200 bg-amber-50 text-amber-700', bar: 'bg-amber-500', dot: 'bg-amber-500', note: 'border-amber-200 bg-amber-50 text-amber-800' },
  violet: { pill: 'border-violet-200 bg-violet-50 text-violet-700', bar: 'bg-violet-500', dot: 'bg-violet-500', note: 'border-violet-200 bg-violet-50 text-violet-800' },
  emerald: { pill: 'border-emerald-200 bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500', note: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  slate: { pill: 'border-slate-200 bg-slate-50 text-slate-600', bar: 'bg-slate-400', dot: 'bg-slate-400', note: 'border-slate-200 bg-slate-50 text-slate-700' },
  sky: { pill: 'border-sky-200 bg-sky-50 text-sky-700', bar: 'bg-sky-500', dot: 'bg-sky-500', note: 'border-sky-200 bg-sky-50 text-sky-800' },
}

const loadSettings = () => {
  try {
    return { ...DEFAULT_INVENTORY_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }
  } catch {
    return { ...DEFAULT_INVENTORY_SETTINGS }
  }
}

const decimal = (value) => (value == null || !Number.isFinite(value) ? '-' : value >= 10 ? count(value) : (Math.round(value * 10) / 10).toLocaleString('ko-KR'))
const manWon = (value) => (value >= 100000000 ? `${(value / 100000000).toFixed(2)}억 원` : value >= 10000 ? `${count(value / 10000)}만 원` : won(value))
const dateLabel = (value) => (value ? String(value).slice(0, 10).replace(/-/g, '.') : '-')
const dateTimeLabel = (value) => (value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

function parseSnapshot(raw) {
  if (!raw) return null
  try {
    const payload = typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload
    return { ...raw, as_of_date: String(raw.as_of_date).slice(0, 10), payload }
  } catch {
    return null
  }
}

function StatusPill({ status }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black ${TONE[meta.tone].pill}`}>
      {meta.label}
    </span>
  )
}

function CategoryTabs({ selectedCategory, setSelectedCategory, rows }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {BRAND_CATEGORIES.map((category) => {
        const active = selectedCategory === category
        const countByCategory = rows.filter((row) => row.category === category).length
        return (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-black transition-colors ${
              active
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
            }`}
          >
            {category}
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{countByCategory}</span>
          </button>
        )
      })}
    </div>
  )
}

function SourceCard({ snapshot, settings, linkedCount, onUpload, onSettings }) {
  const lag = snapshot ? diffDays(snapshot.as_of_date, toDateKey(new Date())) : null
  return (
    <section className="mb-6 rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">3PL Daily Inventory</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">3PL 일일재고표 기준 재고</h2>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {snapshot
              ? '3PL이 보내는 일일재고표의 입고·출고·재고로 현재고와 재고일수, 발주 시점을 계산합니다.'
              : '아직 올라온 3PL 재고표가 없습니다. 3PL에서 받은 엑셀을 올리면 현재고와 위험 품목이 바로 계산됩니다.'}
          </p>
          {snapshot && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-white px-3 py-1 text-slate-700">기준일 {dateLabel(snapshot.as_of_date)}</span>
              {lag > settings.staleDays && <span className="rounded-full bg-rose-600 px-3 py-1 text-white">{lag}일 전 데이터 · 새 파일 필요</span>}
              <span className="max-w-full truncate rounded-full bg-white px-3 py-1 text-slate-600">{snapshot.file_name || '파일명 없음'}</span>
              <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                {snapshot.uploaded_by ? `${snapshot.uploaded_by} · ` : ''}{dateTimeLabel(snapshot.created_at)} 반영
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-sky-700">연동 품목 {count(linkedCount, '개')}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700"
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            기준 설정 · 이력
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-sky-500"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            3PL 엑셀 업로드
          </button>
        </div>
      </div>
    </section>
  )
}

function ActionList({ actions, onOpen }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-black text-slate-950">지금 처리할 일</h2>
        <span className="text-xs font-black text-slate-500">{count(actions.length, '건')}</span>
      </div>
      {actions.length === 0 ? (
        <p className="px-6 py-6 text-sm font-bold text-slate-400">지금 처리할 일이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {actions.map((action) => (
            <li key={action.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-6 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${TONE[action.tone].dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">{action.title}</p>
                <p className="mt-0.5 text-xs font-bold leading-5 text-slate-500">{action.detail}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {action.rows.map((row) => (
                    <button key={row.id} type="button" onClick={() => onOpen(row.id)} className="text-xs font-black text-sky-700 underline-offset-4 hover:underline">
                      {row.product_name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="col-start-2 text-sm font-black text-slate-900 md:col-start-auto md:text-right">{action.metric}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CoverBar({ row, settings }) {
  const max = 180
  if (row.coverDays == null) return <span className="text-xs font-bold text-slate-400">-</span>
  if (!Number.isFinite(row.coverDays)) return <span className="text-xs font-bold text-slate-400">출고 없음</span>
  const width = Math.min(row.coverDays, max) / max * 100
  const reorderTick = (settings.leadDays + settings.bufferDays) / max * 100
  const overTick = Math.min(settings.overDays, max) / max * 100
  return (
    <div className="w-40">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-black text-slate-900">{count(row.coverDays, '일')}</span>
        {row.coverDays > max && <span className="font-bold text-slate-400">180+</span>}
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-100">
        <div className={`absolute inset-y-0 left-0 rounded-full ${TONE[STATUS_META[row.status].tone].bar}`} style={{ width: `${width}%` }} />
        <span className="absolute -top-1 h-3.5 w-px bg-slate-400" style={{ left: `${reorderTick}%` }} title={`발주점 ${settings.leadDays + settings.bufferDays}일`} />
        <span className="absolute -top-1 h-3.5 w-px bg-slate-400" style={{ left: `${overTick}%` }} title={`과다 기준 ${settings.overDays}일`} />
      </div>
    </div>
  )
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="text-xs font-bold text-slate-300">-</span>
  const width = 104
  const height = 28
  const max = Math.max(...values, 1)
  const x = (index) => 2 + index * (width - 4) / (values.length - 1)
  const y = (value) => height - 3 - (value / max) * (height - 6)
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-sky-500" aria-hidden="true">
      <polygon points={`${x(0)},${height - 3} ${points} ${x(values.length - 1)},${height - 3}`} fill="currentColor" opacity="0.12" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" fill="currentColor" />
    </svg>
  )
}

function ExpiryCell({ row, settings }) {
  if (!row.expiry) return <span className="text-xs font-bold text-slate-400">미등록</span>
  const tone = row.expiryDays <= 0 ? 'text-rose-600' : row.expiryDays <= settings.nearExpiryDays ? 'text-amber-600' : 'text-slate-900'
  return (
    <div>
      <p className={`text-xs font-black ${tone}`}>{row.expiryDays <= 0 ? `경과 ${-row.expiryDays}일` : `D-${row.expiryDays}`}</p>
      <p className="text-[11px] font-bold text-slate-400">{dateLabel(row.expiry)}</p>
    </div>
  )
}

function InventoryTable({ rows, settings, selectedId, onOpen, showUnlinked, setShowUnlinked, unlinkedCount }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortId, setSortId] = useState('urgent')

  const statusCounts = useMemo(() => {
    const counts = {}
    rows.forEach((row) => row.flags.forEach((flag) => { counts[flag] = (counts[flag] || 0) + 1 }))
    return counts
  }, [rows])

  const visibleRows = useMemo(() => {
    const normalized = normalizeName(query)
    const filtered = rows.filter((row) => (
      (!statusFilter || row.flags.includes(statusFilter))
      && (!normalized || normalizeName(`${row.product_name}${row.sku || ''}${row.threePlName || ''}`).includes(normalized))
    ))
    const sorters = {
      urgent: (a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank || (a.coverDays ?? Infinity) - (b.coverDays ?? Infinity),
      coverAsc: (a, b) => (a.coverDays ?? Infinity) - (b.coverDays ?? Infinity),
      valueDesc: (a, b) => (b.inventoryValue || 0) - (a.inventoryValue || 0),
      outDesc: (a, b) => (b.avgDailyOut || 0) - (a.avgDailyOut || 0),
      expiryAsc: (a, b) => (a.expiryDays ?? Infinity) - (b.expiryDays ?? Infinity),
    }
    return [...filtered].sort(sorters[sortId])
  }, [rows, query, statusFilter, sortId])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`rounded-full border px-3 py-1 text-xs font-black transition-colors ${!statusFilter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
        >
          전체 {rows.length}
        </button>
        {Object.keys(STATUS_META).filter((key) => statusCounts[key]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black transition-colors ${statusFilter === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
          >
            <span className={`h-2 w-2 rounded-full ${TONE[STATUS_META[key].tone].dot}`} />
            {STATUS_META[key].label} {statusCounts[key]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-md flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제품명, SKU, 3PL 품목명 검색"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {unlinkedCount > 0 && (
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600">
              <input type="checkbox" checked={showUnlinked} onChange={(event) => setShowUnlinked(event.target.checked)} className="h-4 w-4 accent-sky-600" />
              3PL 미연동 {unlinkedCount}개 함께 보기
            </label>
          )}
          <select
            value={sortId}
            onChange={(event) => setSortId(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="urgent">긴급한 순</option>
            <option value="coverAsc">재고일수 짧은 순</option>
            <option value="valueDesc">재고 평가액 높은 순</option>
            <option value="outDesc">출고 많은 순</option>
            <option value="expiryAsc">유통기한 빠른 순</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50">
            <tr>
              {['제품명', '현재고', '일평균 출고', '재고일수', '발주점', '유통기한', '상태', '이번 달 추이'].map((label) => (
                <th key={label} className={`whitespace-nowrap px-4 py-3 text-xs font-black text-slate-500 ${['현재고', '일평균 출고', '발주점'].includes(label) ? 'text-right' : ''}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpen(row.id)}
                className={`cursor-pointer ${selectedId === row.id ? 'bg-sky-50' : 'hover:bg-sky-50/40'}`}
              >
                <td className="px-4 py-3">
                  <p className="whitespace-nowrap text-sm font-black text-slate-950">{row.product_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    {row.storage && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 text-slate-500">{row.storage}</span>}
                    {row.threePlName ? <span>3PL: {row.threePlName}</span> : <span>{row.sku || 'SKU 없음'}</span>}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-slate-950">{count(row.stock)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-700">{decimal(row.avgDailyOut)}</td>
                <td className="px-4 py-3"><CoverBar row={row} settings={settings} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-700">{row.reorderPoint ? count(row.reorderPoint) : '-'}</td>
                <td className="whitespace-nowrap px-4 py-3"><ExpiryCell row={row} settings={settings} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">{row.flags.slice(0, 2).map((flag) => <StatusPill key={flag} status={flag} />)}</div>
                </td>
                <td className="px-4 py-3"><Sparkline values={row.series} /></td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm font-bold text-slate-400">조건에 맞는 제품이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FlowChart({ row }) {
  const width = 480
  const height = 210
  const left = 40
  const right = 8
  const top = 12
  const stockHeight = 110
  const gap = 24
  const outHeight = 48
  const series = row.series || []
  const n = series.length
  if (n < 2) return null
  const max = Math.max(...series, 1)
  const outMax = Math.max(...row.dailyOut, 1)
  const step = (width - left - right) / n
  const x = (index) => left + step * index + step / 2
  const y = (value) => top + stockHeight - (value / max) * stockHeight
  const outBase = top + stockHeight + gap + outHeight
  const points = series.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const ticks = [...new Set([1, 8, 15, 22, n])].filter((day) => day <= n)
  const barWidth = Math.max(2, step * 0.6)
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-[10px] font-bold" role="img" aria-label={`${row.product_name} 일별 재고와 출고`}>
        <line x1={left} x2={width - right} y1={top} y2={top} className="stroke-slate-200" strokeDasharray="2 3" />
        <line x1={left} x2={width - right} y1={top + stockHeight} y2={top + stockHeight} className="stroke-slate-200" />
        <text x={left - 6} y={top + 4} textAnchor="end" className="fill-slate-400">{count(max)}</text>
        <text x={left - 6} y={top + stockHeight + 3} textAnchor="end" className="fill-slate-400">0</text>
        {row.reorderPoint > 0 && row.reorderPoint < max && (
          <g>
            <line x1={left} x2={width - right} y1={y(row.reorderPoint)} y2={y(row.reorderPoint)} className="stroke-rose-400" strokeDasharray="4 3" />
            <text x={width - right} y={y(row.reorderPoint) - 4} textAnchor="end" className="fill-rose-500">발주점 {count(row.reorderPoint)}</text>
          </g>
        )}
        <polygon points={`${x(0)},${top + stockHeight} ${points} ${x(n - 1)},${top + stockHeight}`} className="fill-sky-500" opacity="0.12" />
        <polyline points={points} fill="none" className="stroke-sky-500" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(n - 1)} cy={y(series[n - 1])} r="3.5" className="fill-sky-500" />
        {row.dailyIn.map((value, index) => value > 0 && (
          <g key={`in-${index}`}>
            <path d={`M${x(index) - 5},${top + stockHeight - 2} l5,-8 l5,8z`} className="fill-emerald-500" />
            <text x={x(index)} y={top + stockHeight - 14} textAnchor="middle" className="fill-emerald-600">입고 {count(value)}</text>
          </g>
        ))}
        <line x1={left} x2={width - right} y1={outBase} y2={outBase} className="stroke-slate-200" />
        <text x={left - 6} y={outBase - outHeight + 4} textAnchor="end" className="fill-slate-400">{count(outMax)}</text>
        <text x={left - 6} y={outBase + 3} textAnchor="end" className="fill-slate-400">0</text>
        {row.dailyOut.map((value, index) => value > 0 && (
          <rect key={`out-${index}`} x={x(index) - barWidth / 2} y={outBase - (value / outMax) * outHeight} width={barWidth} height={(value / outMax) * outHeight} rx="1.5" className="fill-slate-400" />
        ))}
        {ticks.map((day) => (
          <text key={day} x={x(day - 1)} y={height - 2} textAnchor="middle" className="fill-slate-400">{day}일</text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] font-bold text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-sky-500" />재고</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-400" />일별 출고</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />입고</span>
      </div>
    </div>
  )
}

function Note({ tone, title, children }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-xs font-bold leading-5 ${TONE[tone].note}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  )
}

function Overlay({ onClose, children, align = 'right' }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={`fixed inset-0 z-50 flex ${align === 'right' ? 'justify-end' : 'items-center justify-center p-4'}`}>
      <button type="button" aria-label="닫기" className="absolute inset-0 cursor-default bg-slate-950/40" onClick={onClose} />
      {children}
    </div>
  )
}

function ProductDrawer({ row, settings, snapshotDate, onClose, onSaveStock }) {
  const [stockValue, setStockValue] = useState(String(row.stock ?? 0))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await onSaveStock(row, stockValue)
      setMessage('재고가 저장되었습니다. 다음 3PL 업로드 때 다시 3PL 값으로 맞춰집니다.')
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '재고 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const stats = [
    ['현재고', count(row.stock, '개')],
    ['일평균 출고', row.avgDailyOut == null ? '-' : `${decimal(row.avgDailyOut)}개`],
    ['재고일수', row.coverDays == null ? '-' : Number.isFinite(row.coverDays) ? count(row.coverDays, '일') : '출고 없음'],
    ['발주점', row.reorderPoint ? count(row.reorderPoint, '개') : '-'],
    ['안전재고', row.safetyStock ? count(row.safetyStock, '개') : '-'],
    ['재고 평가액', row.inventoryValue != null ? manWon(row.inventoryValue) : '단가 미등록'],
    ['이번 달 입고', row.monthIn == null ? '-' : count(row.monthIn, '개')],
    ['이번 달 출고', row.monthOut == null ? '-' : count(row.monthOut, '개')],
    ['유통기한', row.expiry ? (row.expiryDays <= 0 ? '경과' : `D-${row.expiryDays}`) : '미등록'],
  ]

  return (
    <Overlay onClose={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="inventory-drawer-title" className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2 id="inventory-drawer-title" className="text-xl font-black text-slate-950">{row.product_name}</h2>
            <p className="mt-1 flex flex-wrap gap-x-2 text-xs font-bold text-slate-400">
              <span>{row.category}</span>
              {row.storage && <span>{row.storage}</span>}
              {row.threePlName && <span>3PL: {row.threePlName}</span>}
              {row.sku && <span>{row.sku}</span>}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">{row.flags.map((flag) => <StatusPill key={flag} status={flag} />)}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="닫기">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
            {stats.map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2.5">
                <p className="text-[11px] font-bold text-slate-500">{label}</p>
                <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          {row.flags.includes('EXPIRY_CHECK') && (
            <Note tone="rose" title="유통기한 확인 필요">
              등록된 유통기한은 {dateLabel(row.expiry)}(경과 {-row.expiryDays}일)인데 이번 달에도 {count(row.monthOut, '개')}가 출고됐습니다. 3PL에서 현재 로트의 유통기한을 확인하고 제품 정보의 유통기한을 고쳐 주세요.
            </Note>
          )}
          {(row.flags.includes('REORDER') || row.flags.includes('REORDER_SOON')) && (
            <Note tone={row.flags.includes('REORDER') ? 'rose' : 'amber'} title={`권장 발주량 ${count(row.suggestedOrder, '개')}`}>
              리드타임 {settings.leadDays}일 + 안전재고 {settings.bufferDays}일 + 판매 {settings.targetDays}일분 기준입니다. 현재 {count(row.coverDays, '일')}분 남았습니다.
            </Note>
          )}
          {row.flags.includes('WASTE_RISK') && (
            <Note tone="amber" title={`기한 내 소진 위험 ${count(row.wasteQty, '개')}${row.wasteValue ? ` · ${manWon(row.wasteValue)}` : ''}`}>
              유통기한까지 {row.expiryDays}일 동안 지금 속도라면 약 {count(row.sellableBeforeExpiry, '개')}만 팔립니다. 기한 안에 다 팔려면 하루 {count(row.stock / row.expiryDays, '개')}씩 나가야 합니다(현재 {decimal(row.avgDailyOut)}개).
            </Note>
          )}
          {row.flags.includes('NO_3PL') && (
            <Note tone="slate" title="3PL 재고표에 없는 제품">
              세트 구성 상품이거나 3PL 품목과 연결되지 않은 제품입니다. 단품 재고로 관리되는 제품이라면 다음 업로드 때 미리보기에서 3PL 품목과 연결해 주세요.
            </Note>
          )}
          {row.errors?.length > 0 && (
            <Note tone="rose" title="3PL 표 계산 오류">
              {row.errors.join(', ')}일 재고가 전일재고 + 입고 − 출고와 맞지 않습니다. 3PL에 확인이 필요합니다.
            </Note>
          )}

          {row.series && (
            <div>
              <h3 className="mb-2 text-sm font-black text-slate-950">{Number(snapshotDate.slice(5, 7))}월 일별 흐름</h3>
              <FlowChart row={row} />
            </div>
          )}

          <form onSubmit={save} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">실사 재고 조정</h3>
            <p className="mt-0.5 text-xs font-bold text-slate-500">실사 결과가 3PL 수치와 다를 때만 수정하세요.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                min="0"
                value={stockValue}
                onChange={(event) => setStockValue(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                required
              />
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {saving ? '저장 중...' : '재고 저장'}
              </button>
            </div>
            {message && <p className="mt-2 text-xs font-black text-sky-700">{message}</p>}
          </form>
        </div>
      </aside>
    </Overlay>
  )
}

function UploadModal({ products, previousSnapshot, settings, onClose, onApplied }) {
  const [parsed, setParsed] = useState(null)
  const [fileName, setFileName] = useState('')
  const [asOfDate, setAsOfDate] = useState('')
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [applying, setApplying] = useState(false)

  const readFile = async (file) => {
    if (!file) return
    setError('')
    try {
      const result = await parseThreePlFile(await file.arrayBuffer())
      const ym = result.ym || toDateKey(new Date()).slice(0, 7)
      setParsed({ ...result, ym })
      setFileName(file.name)
      setAsOfDate(defaultAsOfDate(ym))
      setMapping(matchThreePlItems(result.items, products, previousSnapshot?.payload?.mapping || {}))
    } catch (readError) {
      setParsed(null)
      setError(readError.message || '파일을 읽지 못했습니다.')
    }
  }

  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const previewRows = useMemo(() => {
    if (!parsed || !asOfDate) return []
    return parsed.items.map((item) => {
      const key = normalizeName(item.raw)
      const summary = summarizeItem(item, asOfDate)
      const product = productById.get(mapping[key])
      return { key, item, summary, product, before: product ? Number(product.stock_quantity || 0) : null }
    })
  }, [parsed, asOfDate, mapping, productById])

  const duplicateTargets = useMemo(() => {
    const seen = {}
    Object.values(mapping).forEach((id) => { if (id) seen[id] = (seen[id] || 0) + 1 })
    return new Set(Object.keys(seen).filter((id) => seen[id] > 1))
  }, [mapping])

  const unmatched = previewRows.filter((row) => !row.product)
  const errorRows = previewRows.filter((row) => row.summary.errors.length)

  const apply = async () => {
    if (!parsed || applying) return
    setApplying(true)
    setError('')
    try {
      const cleanMapping = Object.fromEntries(Object.entries(mapping).filter(([, id]) => id))
      await saveThreePlSnapshot({ asOfDate, fileName, payload: { ym: parsed.ym, items: parsed.items, mapping: cleanMapping } })
      const updates = previewRows.filter((row) => row.product && row.before !== row.summary.stock)
      const results = await Promise.allSettled(updates.map((row) => (
        updateExecutiveRecord('product-profits', row.product.id, { stock_quantity: row.summary.stock })
      )))
      const failed = results.filter((result) => result.status === 'rejected').length
      onApplied(failed
        ? `3PL 재고표를 저장했지만 ${failed}개 제품의 재고 반영에 실패했습니다. 다시 업로드해 주세요.`
        : `${previewRows.length}개 품목을 반영했습니다. 재고가 바뀐 제품 ${updates.length}개`)
    } catch (applyError) {
      setError(applyError?.response?.data?.message || applyError.message || '반영에 실패했습니다.')
      setApplying(false)
    }
  }

  const sortedProducts = useMemo(() => [...products].sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), 'ko')), [products])

  return (
    <Overlay onClose={onClose} align="center">
      <div role="dialog" aria-modal="true" aria-labelledby="upload-title" className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id="upload-title" className="text-xl font-black text-slate-950">3PL 일일재고표 업로드</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">재고표·고기·상온 시트의 입고 / 출고 / 재고를 읽어 제품별 현재고에 반영합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="닫기">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]) }}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:border-sky-300'}`}
          >
            <span className="material-symbols-outlined text-3xl text-sky-600">upload_file</span>
            <span className="text-sm font-black text-slate-900">{fileName ? `${fileName} · 다른 파일로 바꾸기` : '엑셀 파일을 끌어다 놓거나 눌러서 선택'}</span>
            <span className="text-xs font-bold text-slate-500">3PL이 매일 보내는 '내일그룹_일일재고표' .xlsx 원본</span>
            <input type="file" accept=".xlsx" className="hidden" onChange={(event) => { readFile(event.target.files?.[0]); event.target.value = '' }} />
          </label>

          {error && <Note tone="rose" title="파일을 처리하지 못했습니다">{error}</Note>}

          {parsed && (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
                <label className="flex items-center gap-2 font-black text-slate-900">
                  기준일
                  <input
                    type="date"
                    value={asOfDate}
                    min={`${parsed.ym}-01`}
                    max={`${parsed.ym}-${String(daysInMonth(parsed.ym)).padStart(2, '0')}`}
                    onChange={(event) => event.target.value && setAsOfDate(event.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <span>{parsed.ym.replace('-', '년 ')}월 표 · 마지막 입출고 기록 {lastActivityDay(parsed.items)}일 · 기준일 이후 칸은 읽지 않습니다</span>
                <span>시트 {parsed.sheets.join(', ')}{parsed.skipped.length ? ` (제외: ${parsed.skipped.join(', ')})` : ''}</span>
              </div>

              {errorRows.length > 0
                ? <Note tone="rose" title={`계산이 맞지 않는 품목 ${errorRows.length}개`}>{errorRows.map((row) => row.item.raw).join(', ')} · 전일재고 + 입고 − 출고 ≠ 재고. 3PL에 확인이 필요합니다.</Note>
                : <Note tone="sky" title={`${previewRows.length}개 품목 계산 검증 통과`}>전일재고 + 입고 − 출고 = 재고</Note>}
              {unmatched.length > 0 && (
                <Note tone="amber" title={`연결할 제품을 고르지 않은 3PL 품목 ${unmatched.length}개`}>
                  아래 표에서 대시보드 제품을 골라 주세요. 고르지 않으면 이력만 저장되고 현재고는 바뀌지 않습니다. 한 번 고르면 다음 업로드부터 자동으로 연결됩니다.
                </Note>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {['3PL 품목', '대시보드 제품', '현재 값', '새 재고', '차이', '검증'].map((label) => (
                        <th key={label} className={`whitespace-nowrap px-3 py-2.5 text-xs font-black text-slate-500 ${['현재 값', '새 재고', '차이'].includes(label) ? 'text-right' : ''}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row) => {
                      const delta = row.before == null ? null : row.summary.stock - row.before
                      return (
                        <tr key={row.key}>
                          <td className="whitespace-nowrap px-3 py-2 text-sm font-black text-slate-900">
                            {row.item.raw}
                            <span className="ml-1.5 text-[11px] font-bold text-slate-400">{SHEET_STORAGE[row.item.sheet] || row.item.sheet}</span>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={mapping[row.key] || ''}
                              onChange={(event) => setMapping((prev) => ({ ...prev, [row.key]: event.target.value }))}
                              className={`h-9 w-56 rounded-lg border bg-white px-2 text-xs font-bold outline-none focus:border-sky-400 ${!row.product || duplicateTargets.has(mapping[row.key]) ? 'border-amber-300 text-amber-800' : 'border-slate-200 text-slate-800'}`}
                            >
                              <option value="">연결 안 함</option>
                              {sortedProducts.map((product) => (
                                <option key={product.id} value={String(product.id)}>{product.category} · {product.product_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium text-slate-600">{row.before == null ? '-' : count(row.before)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-black text-slate-950">{count(row.summary.stock)}</td>
                          <td className={`whitespace-nowrap px-3 py-2 text-right text-sm font-black ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {delta == null ? '-' : `${delta > 0 ? '+' : ''}${count(delta)}`}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs font-black">
                            {row.summary.errors.length ? <span className="text-rose-600">{row.summary.errors.length}일 불일치</span> : <span className="text-slate-400">정상</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {duplicateTargets.size > 0 && <p className="text-xs font-black text-amber-700">같은 대시보드 제품에 3PL 품목이 2개 이상 연결돼 있습니다. 마지막 값으로 덮어쓰이니 확인해 주세요.</p>}
              <p className="text-[11px] font-bold text-slate-400">발주 기준: 리드타임 {settings.leadDays}일 · 안전재고 {settings.bufferDays}일 · 과다 {settings.overDays}일</p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">취소</button>
          <button
            type="button"
            onClick={apply}
            disabled={!parsed || applying}
            className="h-10 rounded-lg bg-sky-600 px-5 text-sm font-black text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {applying ? '반영 중...' : '반영하기'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

function SettingsDrawer({ settings, setSettings, onClose }) {
  const [history, setHistory] = useState(null)
  useEffect(() => {
    getThreePlSnapshotHistory().then((rows) => setHistory(rows || [])).catch(() => setHistory([]))
  }, [])

  const fields = [
    ['leadDays', '생산·입고 리드타임', '발주 후 3PL 입고까지 걸리는 일수'],
    ['bufferDays', '안전재고 일수', '안전재고 = 일평균 출고 × 이 일수'],
    ['targetDays', '발주 시 확보할 판매일수', '권장 발주량 계산에 사용'],
    ['overDays', '과다 재고 기준', '재고일수가 이보다 길면 과다'],
    ['nearExpiryDays', '유통기한 임박 기준', '남은 일수가 이보다 짧으면 임박'],
    ['staleDays', '데이터 지연 경고', '기준일이 이보다 오래되면 경고'],
  ]
  const update = (key, value) => {
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) return
    const next = { ...settings, [key]: number }
    setSettings(next)
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* 저장 실패 시 이번 화면에서만 적용 */ }
  }

  return (
    <Overlay onClose={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="settings-title" className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <h2 id="settings-title" className="text-xl font-black text-slate-950">기준 설정 · 업로드 이력</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="닫기">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-3 text-sm font-black text-slate-950">재고 판단 기준</h3>
            <div className="space-y-3">
              {fields.map(([key, label, helper]) => (
                <label key={key} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
                  <span>
                    <span className="block text-sm font-black text-slate-800">{label}</span>
                    <span className="block text-[11px] font-bold text-slate-400">{helper}</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={settings[key]}
                    onChange={(event) => update(key, event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-bold text-slate-400">발주점 = 일평균 출고 × (리드타임 + 안전재고 일수). 이 설정은 지금 쓰는 브라우저에 저장됩니다.</p>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-black text-slate-950">업로드 이력</h3>
            {history == null && <p className="text-xs font-bold text-slate-400">불러오는 중...</p>}
            {history?.length === 0 && <p className="text-xs font-bold text-slate-400">업로드 이력이 없습니다.</p>}
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {history?.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <p className="truncate text-sm font-black text-slate-900">{item.file_name || '파일명 없음'}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                    기준일 {dateLabel(item.as_of_date)} · {count(item.item_count, '품목')} · {item.uploaded_by || '-'} · {dateTimeLabel(item.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </Overlay>
  )
}

function buildActions(rows, settings) {
  const actions = []
  const has = (row, flag) => row.flags.includes(flag)
  const reorder = rows.filter((row) => has(row, 'REORDER') || has(row, 'OUT')).sort((a, b) => (a.coverDays ?? 0) - (b.coverDays ?? 0))
  if (reorder.length) {
    actions.push({
      key: 'reorder', tone: 'rose', rows: reorder,
      title: `발주 필요 ${reorder.length}개`,
      detail: reorder.map((row) => `${row.product_name} ${Number.isFinite(row.coverDays) ? `${count(row.coverDays)}일분` : '품절'} → 권장 ${count(row.suggestedOrder, '개')}`).join(' · '),
      metric: `리드타임 ${settings.leadDays}+${settings.bufferDays}일`,
    })
  }
  const expiry = rows.filter((row) => has(row, 'EXPIRY_CHECK'))
  if (expiry.length) {
    actions.push({
      key: 'expiry', tone: 'rose', rows: expiry,
      title: `유통기한이 지난 것으로 등록된 제품 ${expiry.length}개가 계속 출고 중`,
      detail: '제품 정보의 유통기한이 틀렸거나, 기한이 지난 로트가 나가고 있습니다. 3PL에 현재 로트의 유통기한을 확인해 주세요.',
      metric: count(expiry.reduce((sum, row) => sum + row.stock, 0), '개'),
    })
  }
  const soon = rows.filter((row) => has(row, 'REORDER_SOON'))
  if (soon.length) {
    actions.push({
      key: 'soon', tone: 'amber', rows: soon,
      title: `발주 임박 ${soon.length}개`,
      detail: soon.map((row) => `${row.product_name} ${count(row.coverDays)}일분`).join(' · '),
      metric: '2주 안에 발주',
    })
  }
  const waste = rows.filter((row) => has(row, 'WASTE_RISK')).sort((a, b) => b.wasteQty - a.wasteQty)
  if (waste.length) {
    const qty = waste.reduce((sum, row) => sum + row.wasteQty, 0)
    const value = waste.reduce((sum, row) => sum + row.wasteValue, 0)
    actions.push({
      key: 'waste', tone: 'amber', rows: waste,
      title: `지금 판매 속도로는 유통기한 안에 ${count(qty, '개')}를 못 팝니다`,
      detail: `${waste.map((row) => `${row.product_name} D-${row.expiryDays} · ${count(row.wasteQty, '개')}`).join(' · ')}. 판촉, B2B, 수출 물량 배정이 필요합니다.`,
      metric: value ? manWon(value) : count(qty, '개'),
    })
  }
  const over = rows.filter((row) => has(row, 'OVER') && !has(row, 'WASTE_RISK'))
  if (over.length) {
    actions.push({
      key: 'over', tone: 'violet', rows: over,
      title: `과다 재고 ${over.length}개 (${settings.overDays}일분 초과)`,
      detail: over.map((row) => `${row.product_name} ${count(row.coverDays)}일분`).join(' · '),
      metric: '',
    })
  }
  const noCost = rows.filter((row) => row.threePlName && !row.unitCost)
  if (noCost.length) {
    actions.push({
      key: 'cost', tone: 'slate', rows: noCost.slice(0, 8),
      title: `단가 미등록 ${noCost.length}개`,
      detail: '생산 원가가 없어 재고 평가액에서 빠집니다. 제품 원가 정보를 등록해 주세요.',
      metric: '',
    })
  }
  return actions
}

export default function InventoryRiskPage() {
  const [products, setProducts] = useState([])
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('하이프리')
  const [selectedId, setSelectedId] = useState(null)
  const [showUnlinked, setShowUnlinked] = useState(false)
  const [modal, setModal] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const [productResponse, snapshotResponse] = await Promise.all([
      getExecutiveProductProfits(),
      getLatestThreePlSnapshot().catch(() => null),
    ])
    setProducts(productResponse.data || [])
    setSnapshot(parseSnapshot(snapshotResponse?.snapshot))
    setLoading(false)
  }, [])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const asOfDate = snapshot?.as_of_date || toDateKey(new Date())

  const allRows = useMemo(() => {
    const items = snapshot?.payload?.items || []
    const mapping = snapshot?.payload?.mapping || {}
    const itemByProduct = new Map()
    items.forEach((item) => {
      const productId = mapping[normalizeName(item.raw)]
      if (productId) itemByProduct.set(String(productId), item)
    })
    return products.map((product) => {
      const item = itemByProduct.get(String(product.id))
      const summary = item ? summarizeItem(item, asOfDate) : null
      return {
        ...product,
        threePlName: item?.raw || null,
        storage: item ? SHEET_STORAGE[item.sheet] || item.sheet : null,
        series: summary?.series || null,
        dailyIn: summary?.dailyIn || [],
        dailyOut: summary?.dailyOut || [],
        monthIn: summary?.monthIn ?? null,
        monthOut: summary?.monthOut ?? null,
        errors: summary?.errors || [],
        ...evaluateProduct(product, summary, asOfDate, settings),
      }
    })
  }, [products, snapshot, asOfDate, settings])

  const categoryRows = useMemo(() => allRows.filter((row) => row.category === selectedCategory), [allRows, selectedCategory])
  const linkedRows = categoryRows.filter((row) => row.threePlName)
  const tableRows = showUnlinked || linkedRows.length === 0 ? categoryRows : linkedRows
  const actions = useMemo(() => buildActions(linkedRows, settings), [linkedRows, settings])
  const selectedRow = allRows.find((row) => row.id === selectedId)

  const valuedRows = linkedRows.filter((row) => row.inventoryValue != null)
  const inventoryValue = valuedRows.reduce((sum, row) => sum + row.inventoryValue, 0)
  const monthOut = linkedRows.reduce((sum, row) => sum + (row.monthOut || 0), 0)
  const elapsedDays = Number(asOfDate.slice(8, 10))
  const reorderCount = linkedRows.filter((row) => ['OUT', 'REORDER', 'REORDER_SOON'].some((flag) => row.flags.includes(flag))).length
  const wasteRows = linkedRows.filter((row) => row.flags.includes('WASTE_RISK'))
  const wasteQty = wasteRows.reduce((sum, row) => sum + row.wasteQty, 0)
  const wasteValue = wasteRows.reduce((sum, row) => sum + row.wasteValue, 0)

  const saveStock = async (row, value) => {
    await updateExecutiveRecord('product-profits', row.id, { stock_quantity: value })
    await load()
  }

  return (
    <>
      <PageHeader title="재고 관리" description="3PL 일일재고표를 기준으로 재고일수, 발주 시점, 유통기한 리스크를 확인합니다." />

      <CategoryTabs selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} rows={allRows} />

      <SourceCard
        snapshot={snapshot}
        settings={settings}
        linkedCount={linkedRows.length}
        onUpload={() => setModal('upload')}
        onSettings={() => setModal('settings')}
      />

      {snapshot && <ActionList actions={actions} onOpen={setSelectedId} />}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`${selectedCategory} 재고 평가 금액`}
          value={manWon(inventoryValue)}
          icon="inventory_2"
          helperText={`단가 등록 ${valuedRows.length}/${linkedRows.length}개 기준`}
          valueClassName="text-slate-950"
        />
        <KpiCard
          label={`${Number(asOfDate.slice(5, 7))}월 출고 누계`}
          value={count(monthOut, '개')}
          icon="local_shipping"
          tone="emerald"
          helperText={snapshot ? `하루 평균 ${count(monthOut / Math.max(elapsedDays, 1), '개')} · ${elapsedDays}일 기준` : '3PL 업로드 필요'}
        />
        <KpiCard
          label="발주 필요·임박 제품"
          value={count(reorderCount, '개')}
          icon="production_quantity_limits"
          tone="rose"
          badge={reorderCount ? 'WATCH' : 'NORMAL'}
          helperText={`재고일수 ${settings.leadDays + settings.bufferDays + 14}일 미만`}
        />
        <KpiCard
          label="유통기한 내 소진 위험"
          value={wasteValue ? manWon(wasteValue) : count(wasteQty, '개')}
          icon="hourglass_bottom"
          tone="amber"
          badge={wasteQty ? 'WATCH' : 'NORMAL'}
          helperText={`${count(wasteQty, '개')} · ${wasteRows.length}개 제품`}
        />
      </section>

      <Panel
        title={`${selectedCategory} 제품별 재고`}
        right={<span className="text-xs font-black text-slate-500">{tableRows.length}개 제품</span>}
      >
        {loading ? (
          <p className="py-12 text-center text-sm font-bold text-slate-400">재고를 불러오는 중입니다.</p>
        ) : (
          <InventoryTable
            rows={tableRows}
            settings={settings}
            selectedId={selectedId}
            onOpen={setSelectedId}
            showUnlinked={showUnlinked}
            setShowUnlinked={setShowUnlinked}
            unlinkedCount={categoryRows.length - linkedRows.length}
          />
        )}
      </Panel>

      {selectedRow && (
        <ProductDrawer
          key={selectedRow.id}
          row={selectedRow}
          settings={settings}
          snapshotDate={asOfDate}
          onClose={() => setSelectedId(null)}
          onSaveStock={saveStock}
        />
      )}
      {modal === 'upload' && (
        <UploadModal
          products={products}
          previousSnapshot={snapshot}
          settings={settings}
          onClose={() => setModal(null)}
          onApplied={async (message) => {
            setModal(null)
            setToast(message)
            await load()
          }}
        />
      )}
      {modal === 'settings' && <SettingsDrawer settings={settings} setSettings={setSettings} onClose={() => setModal(null)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </>
  )
}
