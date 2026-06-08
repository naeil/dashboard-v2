import { useEffect, useState, useMemo } from 'react'
import { getBrandHealth } from '../../api/executiveApi'

// ── 포맷 헬퍼 ────────────────────────────────────────────────────────────────

function fmtWon(n) {
  if (n == null || isNaN(n)) return '-'
  return `${Math.round(Number(n)).toLocaleString('ko-KR')}원`
}

function fmtNum(n, unit = '') {
  if (n == null || isNaN(n)) return '-'
  return Number(n).toLocaleString() + unit
}

function diffBadge(pct) {
  if (pct == null) return null
  const up = pct >= 0
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function statusBadge(status) {
  const map = {
    NORMAL:        { label: '정상',    cls: 'bg-emerald-100 text-emerald-700' },
    LOW_STOCK:     { label: '주의',    cls: 'bg-amber-100 text-amber-600' },
    OUT_OF_STOCK:  { label: '긴급발주', cls: 'bg-red-100 text-red-700' },
    NO_MOVEMENT:   { label: '출고없음', cls: 'bg-slate-100 text-slate-500' },
    URGENT:        { label: '긴급발주', cls: 'bg-red-100 text-red-700' },
  }
  const m = map[status] || { label: status, cls: 'bg-slate-100 text-slate-500' }
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${m.cls}`}>{m.label}</span>
}

function skuStatus(row) {
  const days = row.days_to_depletion != null ? Number(row.days_to_depletion) : null
  if (row.stock_status === 'OUT_OF_STOCK') return 'OUT_OF_STOCK'
  if (days != null && days < 14)           return 'URGENT'
  if (row.stock_status === 'LOW_STOCK' || (days != null && days < 30)) return 'LOW_STOCK'
  if (row.stock_status === 'NO_MOVEMENT')  return 'NO_MOVEMENT'
  return 'NORMAL'
}

// ── 수평 바 ───────────────────────────────────────────────────────────────────

function HBar({ value, max, color = 'bg-sky-400', height = 'h-2.5' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`w-full rounded-full bg-slate-100 ${height}`}>
      <div className={`${color} ${height} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── 월별 바차트 ───────────────────────────────────────────────────────────────

function ProfitBarChart({ data }) {
  if (!data || data.length === 0)
    return <p className="py-8 text-center text-xs text-slate-400">데이터 없음</p>

  const vals = data.map((d) => Number(d.profit || 0))
  const max  = Math.max(...vals, 1)
  const min  = Math.min(...vals)
  const avg  = vals.reduce((s, v) => s + v, 0) / vals.length

  const W = 480, H = 120, padX = 8, padY = 12, chartH = H - padY * 2 - 14
  const barW = Math.floor((W - padX * 2) / data.length) - 6

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {data.map((d, i) => {
          const val = Number(d.profit || 0)
          const bh  = Math.max(3, (val / max) * chartH)
          const x   = padX + i * ((W - padX * 2) / data.length) + 3
          const y   = padY + chartH - bh
          const isLast = i === data.length - 1
          const label = String(d.month || '').replace(/^\d{4}-/, '')
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx={4}
                fill={isLast ? '#38bdf8' : '#bfdbfe'} />
              <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
        <span>최저 <b className="text-slate-700">{fmtWon(min)}</b> ({data.find((d) => Number(d.profit) === min)?.month?.replace(/^\d{4}-/, '')}월)</span>
        <span>최고 <b className="text-slate-700">{fmtWon(Math.max(...vals))}</b> ({data.find((d) => Number(d.profit) === Math.max(...vals))?.month?.replace(/^\d{4}-/, '')}월)</span>
        <span>6개월 평균 <b className="text-slate-700">{fmtWon(Math.round(avg))}</b></span>
      </div>
    </div>
  )
}

// ── KPI 카드 ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, badge, extra, onClick, active = false }) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-2xl border bg-white p-4 text-left transition-all ${
        active
          ? 'border-sky-400 shadow-md ring-2 ring-sky-100'
          : 'border-slate-200 hover:border-sky-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
        <span className="material-symbols-outlined text-base text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-black text-slate-950 leading-tight">{value}</span>
        {badge}
      </div>
      {sub  && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
      {extra && <p className="mt-0.5 text-[11px] font-bold text-slate-500">{extra}</p>}
    </Component>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

export default function BrandHealthPage() {
  const today = new Date()
  const ymStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const ymEnd   = today.toISOString().slice(0, 10)

  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [brandId,   setBrandId]   = useState(null)
  const [startDate, setStartDate] = useState(ymStart)
  const [endDate,   setEndDate]   = useState(ymEnd)
  const [activeDetail, setActiveDetail] = useState('channel')

  async function load(bId, sd, ed) {
    setLoading(true); setError(null)
    try {
      const params = {}
      if (bId) params.brandId   = bId
      if (sd)  params.startDate = sd
      if (ed)  params.endDate   = ed
      const res = await getBrandHealth(params)
      setData(res.data ?? res)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(brandId, startDate, endDate) }, [])

  function handleSearch() { load(brandId, startDate, endDate) }

  function selectBrand(nextBrandId) {
    setBrandId(nextBrandId)
    load(nextBrandId, startDate, endDate)
  }

  function setThisMonth() {
    setStartDate(ymStart); setEndDate(ymEnd)
  }
  function setLastMonth() {
    const d    = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    setStartDate(d.toISOString().slice(0, 10))
    setEndDate(last.toISOString().slice(0, 10))
  }

  // ── derived ──

  const brands    = data?.brands          || []
  const inventory = data?.inventory       || []
  const channels  = data?.channelBreakdown || []
  const summary   = data?.summary         || {}

  const brandName = brands.find((b) => String(b.id) === String(brandId))?.brand_name || '전체 브랜드'
  const brandOptions = ['하이프리', '국민한상', '미분류']
    .map((name) => brands.find((brand) => brand.brand_name === name))
    .filter(Boolean)

  // 월별 이익 (6개월)
  const monthlyProfit = useMemo(() => {
    const map = {}
    ;(data?.monthlySales || []).forEach((r) => {
      const m = r.month?.slice(0, 7) || ''
      if (!map[m]) map[m] = { month: m, sales: 0, profit: 0, orders: 0 }
      map[m].sales  += Number(r.sales_amount    || 0)
      map[m].profit += Number(r.estimated_profit || 0)
      map[m].orders += Number(r.order_count      || 0)
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [data])

  // MoM 이익 증감
  const momProfitPct = useMemo(() => {
    if (monthlyProfit.length < 2) return null
    const curr = monthlyProfit[monthlyProfit.length - 1]?.profit || 0
    const prev = monthlyProfit[monthlyProfit.length - 2]?.profit || 1
    return prev > 0 ? ((curr - prev) / prev) * 100 : null
  }, [monthlyProfit])

  // 제품 원가 관리 SKU의 전체 재고/출고를 기준으로 계산한 가중 지표
  const turnoverRate = summary.inventory_turnover_rate != null
    ? Number(summary.inventory_turnover_rate)
    : null

  const prevTurnover = null // 전월 회전율 — 현재 API에서 미지원, 추후 확장

  const avgDays = summary.avg_days_to_depletion != null
    ? Number(summary.avg_days_to_depletion)
    : null

  const daysStatus = avgDays == null ? null : avgDays > 45 ? '안전' : avgDays > 14 ? '주의' : '위험'
  const daysStatusCls = { '안전': 'bg-emerald-100 text-emerald-700', '주의': 'bg-amber-100 text-amber-600', '위험': 'bg-red-100 text-red-700' }[daysStatus] || ''
  const turnoverLabel = turnoverRate == null ? '-' : turnoverRate > 1.5 ? '우수' : turnoverRate > 0.8 ? '보통' : '저조'
  const turnoverLabelCls = { '우수': 'bg-emerald-100 text-emerald-700', '보통': 'bg-amber-100 text-amber-600', '저조': 'bg-red-100 text-red-700' }[turnoverLabel] || ''

  // 채널 최대값 (바 정규화용)
  const maxChannelSales  = Math.max(...channels.map((c) => Number(c.sales_amount   || 0)), 1)
  const maxChannelMargin = 100

  // SKU 정렬: 위험 → 주의 → 출고없음 → 정상
  const sortedInventory = useMemo(() => {
    const order = { OUT_OF_STOCK: 0, URGENT: 1, LOW_STOCK: 2, NO_MOVEMENT: 3, NORMAL: 4 }
    return [...inventory].sort((a, b) => (order[skuStatus(a)] ?? 5) - (order[skuStatus(b)] ?? 5))
  }, [inventory])

  // 기준 텍스트
  const periodLabel = (() => {
    const s = new Date(startDate)
    return `${s.getFullYear()}년 ${s.getMonth() + 1}월 기준`
  })()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 브랜드 탭 */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button type="button" onClick={() => selectBrand(null)}
                className={`rounded-lg px-4 py-1.5 text-sm font-black transition-colors ${brandId === null ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
                전체
              </button>
              {brandOptions.map((b) => (
                <button key={b.id} type="button" onClick={() => selectBrand(b.id)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-black transition-colors ${String(brandId) === String(b.id) ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
                  {b.brand_name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none" />
              <span className="text-slate-300">~</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none" />
            </div>
            <button type="button" onClick={setThisMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">이번달</button>
            <button type="button" onClick={setLastMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">지난달</button>
            <button type="button" onClick={handleSearch}
              className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-600">조회</button>
          </div>
        </div>
      </div>

      {/* ── 바디 ── */}
      <div className="mx-auto max-w-5xl px-4 py-5 space-y-5">
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-sky-400">progress_activity</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-center text-sm text-red-600 font-bold">{error}</div>
        )}

        {!loading && !error && data && (
          <>
            {/* ─── 핵심 지표 4개 ─── */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">핵심 지표</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  icon="trending_up"
                  label="월 영업이익"
                  value={fmtWon(summary.total_profit)}
                  badge={diffBadge(momProfitPct)}
                  sub={`전월 대비 · 이익률 ${Number(summary.avg_margin ?? 0).toFixed(1)}%`}
                  onClick={() => setActiveDetail('channel')}
                  active={activeDetail === 'channel'}
                />
                <KpiCard
                  icon="autorenew"
                  label="재고 회전율"
                  value={turnoverRate != null ? turnoverRate.toFixed(1) + '회' : '-'}
                  badge={
                    turnoverLabel !== '-'
                      ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${turnoverLabelCls}`}>{turnoverLabel}</span>
                      : null
                  }
                  sub="원가 관리 SKU · 최근 30일 출고 기준"
                  extra={prevTurnover != null ? `전월 ${prevTurnover.toFixed(1)}회` : undefined}
                  onClick={() => setActiveDetail('inventory')}
                  active={activeDetail === 'inventory'}
                />
                <KpiCard
                  icon="schedule"
                  label="재고 소진 예상"
                  value={avgDays != null ? Math.round(avgDays) + '일' : '-'}
                  badge={
                    daysStatus
                      ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${daysStatusCls}`}>{daysStatus}</span>
                      : null
                  }
                  sub="원가 관리 SKU · 최근 7일 출고 기준"
                  onClick={() => setActiveDetail('inventory')}
                  active={activeDetail === 'inventory'}
                />
                <KpiCard
                  icon="inventory_2"
                  label="전체 재고"
                  value={fmtNum(summary.total_stock, '개')}
                  badge={null}
                  sub={`제품 원가 관리 SKU ${inventory.length}개 기준`}
                  extra={`긴급발주 ${sortedInventory.filter((r) => ['OUT_OF_STOCK','URGENT'].includes(skuStatus(r))).length}개`}
                  onClick={() => setActiveDetail('inventory')}
                  active={activeDetail === 'inventory'}
                />
              </div>
            </div>

            {/* ─── 상세 데이터 전환 ─── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDetail('channel')}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition-colors ${
                    activeDetail === 'channel'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  채널별 매출 기여도
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetail('inventory')}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition-colors ${
                    activeDetail === 'inventory'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  SKU 재고 현황
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* 채널별 매출 기여 + 영업이익률 */}
              {activeDetail === 'channel' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                {channels.length === 0
                  ? <p className="py-8 text-center text-xs text-slate-400">채널 데이터 없음</p>
                  : (
                    <>
                      <p className="mb-3 text-xs font-black text-slate-700">채널별 매출 기여</p>
                      <div className="space-y-3 mb-5">
                        {channels.map((c, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700">{c.channel_name}</span>
                              <span className="font-black text-slate-900">{fmtWon(c.sales_amount)}</span>
                            </div>
                            <HBar
                              value={Number(c.sales_amount || 0)}
                              max={maxChannelSales}
                              color="bg-sky-400"
                              height="h-2"
                            />
                          </div>
                        ))}
                      </div>

                      <p className="mb-3 text-xs font-black text-slate-700">채널별 영업이익률</p>
                      <div className="space-y-3">
                        {[...channels]
                          .map((c) => ({
                            ...c,
                            margin: Number(c.sales_amount) > 0
                              ? (Number(c.estimated_profit) / Number(c.sales_amount)) * 100
                              : 0,
                          }))
                          .sort((a, b) => b.margin - a.margin)
                          .map((c, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-700">{c.channel_name}</span>
                                <span className={`font-black ${c.margin >= 20 ? 'text-emerald-600' : c.margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {c.margin.toFixed(0)}%
                                </span>
                              </div>
                              <HBar
                                value={c.margin}
                                max={maxChannelMargin}
                                color={c.margin >= 20 ? 'bg-emerald-400' : c.margin >= 10 ? 'bg-amber-400' : 'bg-red-400'}
                                height="h-2"
                              />
                            </div>
                          ))}
                      </div>
                    </>
                  )}
              </div>
              )}

              {/* SKU별 재고 현황 */}
              {activeDetail === 'inventory' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-3 text-xs font-black text-slate-700">SKU별 재고 현황</p>
                {sortedInventory.length === 0
                  ? <p className="py-8 text-center text-xs text-slate-400">재고 데이터 없음</p>
                  : (
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-black text-slate-400">제품</th>
                            <th className="px-3 py-2 text-right font-black text-slate-400">재고</th>
                            <th className="px-3 py-2 text-right font-black text-slate-400">소진 예상</th>
                            <th className="px-3 py-2 text-right font-black text-slate-400">상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedInventory.map((r, i) => {
                            const st = skuStatus(r)
                            const days = r.days_to_depletion != null ? Math.round(Number(r.days_to_depletion)) : null
                            return (
                              <tr key={i} className={st === 'OUT_OF_STOCK' || st === 'URGENT' ? 'bg-red-50' : ''}>
                                <td className="px-3 py-2.5 font-bold text-slate-800 max-w-[120px]">
                                  <span className="block truncate">{r.product_name}</span>
                                  {r.brand_name && brandId === null && (
                                    <span className="text-[10px] text-slate-400">{r.brand_name}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-black text-slate-900">
                                  {fmtNum(r.real_stock, '개')}
                                </td>
                                <td className={`px-3 py-2.5 text-right font-bold ${days != null && days < 14 ? 'text-red-600' : days != null && days < 30 ? 'text-amber-600' : 'text-slate-600'}`}>
                                  {days != null ? days + '일' : '-'}
                                </td>
                                <td className="px-3 py-2.5 text-right">{statusBadge(st)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
              )}
            </div>

            {/* ─── 월별 영업이익 추세 ─── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black text-slate-700">월별 영업이익 추세</p>
                <span className="text-[11px] text-slate-400">최근 6개월</span>
              </div>
              <ProfitBarChart data={monthlyProfit} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
