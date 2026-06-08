import { useEffect, useMemo, useState } from 'react'
import { getExecutiveProductMovements, syncPlayAutoProductMovements } from '../../api/executiveApi'
import { KpiCard, PageHeader, Panel } from './ExecutiveComponents'

const formatCount = (value, suffix = '') => `${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}${suffix}`
const numberValue = (value) => Number(value || 0)

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusMeta = {
  OUT_OF_STOCK: { label: '품절', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  LOW_STOCK: { label: '안전재고 이하', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  NO_RECENT_OUTBOUND: { label: '최근 출고 없음', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  NORMAL: { label: '정상', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
}

function MovementStatus({ value }) {
  const meta = statusMeta[value] || statusMeta.NORMAL
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function productKey(row) {
  return row.sku_cd || row.prod_no || row.id || row.product_name
}

function avgDailyOutbound(row) {
  return numberValue(row.last_7_days_outbound_count) / 7
}

function stockCoverDays(row) {
  const average = avgDailyOutbound(row)
  if (average <= 0) return null
  return numberValue(row.real_stock) / average
}

function rankRows(rows, valueGetter, limit = 5) {
  return [...rows]
    .filter((row) => valueGetter(row) > 0)
    .sort((a, b) => valueGetter(b) - valueGetter(a))
    .slice(0, limit)
}

function RiskSignal({ row }) {
  const coverDays = stockCoverDays(row)
  if (row.stock_status === 'OUT_OF_STOCK') {
    return <span className="font-black text-rose-600">즉시 품절 대응</span>
  }
  if (row.stock_status === 'LOW_STOCK') {
    return <span className="font-black text-amber-600">재입고 필요</span>
  }
  if (coverDays !== null && coverDays <= 14) {
    return <span className="font-black text-amber-600">{Math.round(coverDays)}일 내 소진 가능</span>
  }
  if (numberValue(row.last_7_days_outbound_count) === 0) {
    return <span className="font-black text-slate-500">최근 출고 없음</span>
  }
  return <span className="font-black text-emerald-600">정상 회전</span>
}

function RankingPanel({ title, rows, metricLabel, metricGetter, emptyMessage }) {
  return (
    <Panel title={title}>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
            {emptyMessage}
          </div>
        ) : rows.map((row, index) => (
          <article key={`${title}-${productKey(row)}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-sky-600">TOP {index + 1}</p>
                <p className="mt-1 truncate text-sm font-black text-slate-950">{row.product_name}</p>
                <p className="mt-1 truncate text-xs font-bold text-slate-500">{row.brand_name || '미분류'} · {row.sku_cd || row.prod_no || '-'}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-black text-slate-950">{formatCount(metricGetter(row), '개')}</p>
                <p className="text-[11px] font-black text-slate-500">{metricLabel}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function RiskPanel({ rows }) {
  return (
    <Panel title="재고 대비 출고 위험">
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm font-bold text-emerald-700">
            출고 흐름 기준 긴급 위험 제품이 없습니다.
          </div>
        ) : rows.map((row) => (
          <article key={`risk-${productKey(row)}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2"><MovementStatus value={row.stock_status} /></div>
                <p className="truncate text-sm font-black text-slate-950">{row.product_name}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  재고 {formatCount(row.real_stock, '개')} · 최근 7일 {formatCount(row.last_7_days_outbound_count, '개')}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs">
                <RiskSignal row={row} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function ProductMovementTable({ rows }) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('recentDesc')

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const searched = normalized
      ? rows.filter((row) => (
        [row.product_name, row.brand_name, row.sku_cd, row.prod_no]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      ))
      : rows

    return [...searched].sort((a, b) => {
      if (sortMode === 'todayDesc') return numberValue(b.today_outbound_count) - numberValue(a.today_outbound_count)
      if (sortMode === 'stockAsc') return numberValue(a.real_stock) - numberValue(b.real_stock)
      if (sortMode === 'stockDesc') return numberValue(b.real_stock) - numberValue(a.real_stock)
      if (sortMode === 'accumDesc') return numberValue(b.outbound_accum_snapshot) - numberValue(a.outbound_accum_snapshot)
      if (sortMode === 'riskFirst') {
        const weight = { OUT_OF_STOCK: 0, LOW_STOCK: 1, NO_RECENT_OUTBOUND: 2, NORMAL: 3 }
        return (weight[a.stock_status] ?? 3) - (weight[b.stock_status] ?? 3)
      }
      return numberValue(b.last_7_days_outbound_count) - numberValue(a.last_7_days_outbound_count)
    })
  }, [query, rows, sortMode])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <label className="relative block w-full max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제품명, 브랜드, SKU 검색"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-bold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500">정렬</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="recentDesc">최근 7일 출고 많은 순</option>
            <option value="todayDesc">오늘 출고 많은 순</option>
            <option value="accumDesc">누적 출고 많은 순</option>
            <option value="riskFirst">재고 위험 우선</option>
            <option value="stockAsc">재고 적은 순</option>
            <option value="stockDesc">재고 많은 순</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50">
            <tr>
              {['상태', '제품명', '브랜드', 'SKU', '현재 재고', '안전 재고', '오늘 출고', '최근 7일 출고', '누적 출고', '재고 회전 신호', '수집 시각'].map((label) => (
                <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-500">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-sky-50/40">
                <td className="whitespace-nowrap px-4 py-3"><MovementStatus value={row.stock_status} /></td>
                <td className="min-w-[260px] px-4 py-3 text-sm font-black text-slate-950">{row.product_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">{row.brand_name || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">{row.sku_cd || row.prod_no || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-sky-700">{formatCount(row.real_stock, '개')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">{formatCount(row.safe_stock, '개')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-emerald-700">{formatCount(row.today_outbound_count, '개')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-emerald-700">{formatCount(row.last_7_days_outbound_count, '개')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">{formatCount(row.outbound_accum_snapshot, '개')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm"><RiskSignal row={row} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-500">{formatDateTime(row.collected_at)}</td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                  표시할 제품 출입고 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProductMovementPage({ role = 'EXECUTIVE' }) {
  const [dashboard, setDashboard] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const rows = dashboard.rows || []
  const summary = dashboard.summary || {}
  const canSync = role === 'EXECUTIVE' || role === 'MANAGER'

  const load = async () => {
    const response = await getExecutiveProductMovements()
    setDashboard(response.data || { summary: {}, rows: [] })
  }

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await getExecutiveProductMovements()
        if (active) {
          setDashboard(response.data || { summary: {}, rows: [] })
          setMessage('')
        }
      } catch (error) {
        if (active) setMessage(error?.response?.data?.message || '제품 출입고 데이터를 불러오지 못했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }

    refresh()
    const timer = window.setInterval(refresh, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const handleSync = async () => {
    if (!canSync || syncing) return
    setSyncing(true)
    setMessage('PlayAuto에서 제품 재고와 출고 데이터를 동기화하는 중입니다.')
    try {
      const response = await syncPlayAutoProductMovements()
      setDashboard(response.data || { summary: {}, rows: [] })
      setMessage('PlayAuto 동기화가 완료되었습니다.')
    } catch (error) {
      setMessage(error?.response?.data?.message || 'PlayAuto 동기화에 실패했습니다. 연동 설정을 확인해주세요.')
      await load().catch(() => {})
    } finally {
      setSyncing(false)
    }
  }

  const riskCount = Number(summary.out_of_stock_count || 0) + Number(summary.low_stock_count || 0)
  const todayTopRows = useMemo(() => rankRows(rows, (row) => numberValue(row.today_outbound_count), 5), [rows])
  const recentTopRows = useMemo(() => rankRows(rows, (row) => numberValue(row.last_7_days_outbound_count), 5), [rows])
  const accumulatedTopRows = useMemo(() => rankRows(rows, (row) => numberValue(row.outbound_accum_snapshot), 5), [rows])
  const stockRiskRows = useMemo(() => {
    return [...rows]
      .filter((row) => row.stock_status === 'OUT_OF_STOCK' || row.stock_status === 'LOW_STOCK' || (stockCoverDays(row) !== null && stockCoverDays(row) <= 14))
      .sort((a, b) => {
        const aCover = stockCoverDays(a)
        const bCover = stockCoverDays(b)
        const safeA = aCover === null ? 9999 : aCover
        const safeB = bCover === null ? 9999 : bCover
        return safeA - safeB
      })
      .slice(0, 5)
  }, [rows])

  const fastestProduct = recentTopRows[0]
  const zeroOutboundCount = rows.filter((row) => numberValue(row.last_7_days_outbound_count) === 0).length

  return (
    <>
      <PageHeader
        title="제품 출입고"
        description="PlayAuto API 기준으로 현재 재고, 오늘 출고, 최근 7일 출고 흐름을 제품별로 확인합니다."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="총 제품 SKU" value={formatCount(summary.product_count, '개')} helperText="PlayAuto 연동 제품 기준" icon="inventory_2" />
        <KpiCard label="현재 총 재고" value={formatCount(summary.total_stock, '개')} helperText="실재고 합계" icon="warehouse" />
        <KpiCard label="재고 위험" value={formatCount(riskCount, '개')} helperText="품절 + 안전재고 이하" tone={riskCount ? 'rose' : 'emerald'} icon="warning" />
        <KpiCard label="오늘 출고" value={formatCount(summary.today_outbound_count, '개')} helperText="금일 출고 스냅샷" tone="emerald" icon="local_shipping" />
        <KpiCard label="최근 7일 출고" value={formatCount(summary.last_7_days_outbound_count, '개')} helperText="최근 회전 흐름" tone="emerald" icon="timeline" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">가장 많이 나간 제품</p>
          <p className="mt-3 truncate text-lg font-black text-slate-950">{fastestProduct?.product_name || '데이터 없음'}</p>
          <p className="mt-2 text-sm font-black text-emerald-700">{formatCount(fastestProduct?.last_7_days_outbound_count, '개')} / 최근 7일</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">출고 없는 제품</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{formatCount(zeroOutboundCount, '개')}</p>
          <p className="mt-2 text-sm font-bold text-slate-500">최근 7일 기준</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-black text-amber-700">재고 부족 주의</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{formatCount(stockRiskRows.length, '개')}</p>
          <p className="mt-2 text-sm font-bold text-amber-700">출고 속도 대비 재고 점검 필요</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">마지막 수집</p>
          <p className="mt-3 text-lg font-black text-slate-950">{formatDateTime(summary.last_synced_at)}</p>
          <p className="mt-2 text-sm font-bold text-slate-500">30초마다 화면 자동 갱신</p>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-4">
        <RankingPanel
          title="오늘 많이 나간 제품"
          rows={todayTopRows}
          metricLabel="오늘 출고"
          metricGetter={(row) => numberValue(row.today_outbound_count)}
          emptyMessage="오늘 출고 데이터가 없습니다."
        />
        <RankingPanel
          title="최근 7일 많이 나간 제품"
          rows={recentTopRows}
          metricLabel="7일 출고"
          metricGetter={(row) => numberValue(row.last_7_days_outbound_count)}
          emptyMessage="최근 7일 출고 데이터가 없습니다."
        />
        <RankingPanel
          title="누적 출고 상위"
          rows={accumulatedTopRows}
          metricLabel="누적 출고"
          metricGetter={(row) => numberValue(row.outbound_accum_snapshot)}
          emptyMessage="누적 출고 데이터가 없습니다."
        />
        <RiskPanel rows={stockRiskRows} />
      </section>

      <Panel
        title="PlayAuto 출입고 현황"
        right={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs font-black text-slate-500">마지막 수집 {formatDateTime(summary.last_synced_at)}</span>
            {canSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-black text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>{syncing ? 'sync' : 'cloud_sync'}</span>
                {syncing ? '동기화 중' : 'PlayAuto 실시간 동기화'}
              </button>
            )}
          </div>
        }
      >
        {message && (
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
            {message}
          </div>
        )}
        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm font-bold text-slate-500">
            제품 출입고 데이터를 불러오는 중입니다.
          </div>
        ) : (
          <ProductMovementTable rows={rows} />
        )}
      </Panel>
    </>
  )
}
