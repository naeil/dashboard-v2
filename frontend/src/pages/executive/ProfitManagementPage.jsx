import { useEffect, useMemo, useState } from 'react'
import { getProfitManagement, importPlayAutoChannelSales, saveProfitPlan } from '../../api/executiveApi'
import { KpiCard, PageHeader, Panel } from './ExecutiveComponents'

/* ─── 포맷 헬퍼 ─────────────────────────────────────────────────────── */
const num = (v) => Number(v || 0)
const numFmt = (v) => Number(v || 0).toLocaleString('ko-KR')
const wonFmt = (v) => `${Math.round(Number(v || 0)).toLocaleString('ko-KR')} 원`
const pctFmt = (v, d = 1) => `${Number(v || 0).toFixed(d)}%`
const monthStartText = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const monthInputText = (value) => String(value || '').slice(0, 7)
const nextMonthText = (value, offset) => {
  const d = new Date(`${monthInputText(value)}-01T00:00:00`)
  d.setMonth(d.getMonth() + offset)
  return monthStartText(d)
}
const monthDiff = (fromValue, toValue) => {
  const from = new Date(`${monthInputText(fromValue)}-01T00:00:00`)
  const to = new Date(`${monthInputText(toValue)}-01T00:00:00`)
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}
const monthEndText = (value) => {
  const d = new Date(`${monthInputText(value)}-01T00:00:00`)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseNum(raw) {
  const s = String(raw).replace(/[^0-9.]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function repayLabel(mo) {
  if (!mo || mo <= 0) return '상환 불가'
  const y = Math.floor(mo / 12)
  const m = mo % 12
  if (y === 0) return `${mo}개월`
  return m > 0 ? `${y}년 ${m}개월` : `${y}년`
}

function repayDate(mo) {
  if (!mo) return null
  const d = new Date()
  d.setMonth(d.getMonth() + mo)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
}

function contribBadgeCls(rate) {
  if (rate >= 40) return 'bg-emerald-100 text-emerald-700'
  if (rate >= 20) return 'bg-sky-100 text-sky-700'
  if (rate >= 10) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

const INPUT_CLS =
  'w-28 rounded border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold text-slate-700 outline-none focus:border-sky-400'

const SORT_OPTIONS = [
  { id: 'targetDesc', label: '계획 수량 높은 순' },
  { id: 'targetAsc', label: '계획 수량 낮은 순' },
  { id: 'soldDesc', label: '현재 판매 높은 순' },
  { id: 'revenueDesc', label: '계획 매출 높은 순' },
  { id: 'contribDesc', label: '공헌이익 높은 순' },
  { id: 'contribAsc', label: '공헌이익률 낮은 순' },
  { id: 'nameAsc', label: '제품명 가나다순' },
]

/* ─── 채널 정의 ─────────────────────────────────────────────────────── */
const CHANNELS = [
  {
    id: 'online',
    label: '국내 온라인',
    icon: 'language',
    headerCls: 'bg-sky-50 border-sky-200 text-sky-700',
    badgeCls: 'bg-sky-100 text-sky-700',
    barCls: 'bg-sky-500',
    costHints: ['기본급여', '배송비 + 반품비', '광고비 + 플랫폼수수료', '기타'],
  },
  {
    id: 'offline',
    label: '국내 오프라인',
    icon: 'store',
    headerCls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    badgeCls: 'bg-emerald-100 text-emerald-700',
    barCls: 'bg-emerald-500',
    costHints: ['기본급여', '납품 물류비', '입점수수료 + 판촉비', '기타'],
  },
  {
    id: 'export',
    label: '해외 수출',
    icon: 'flight_takeoff',
    headerCls: 'bg-violet-50 border-violet-200 text-violet-700',
    badgeCls: 'bg-violet-100 text-violet-700',
    barCls: 'bg-violet-500',
    costHints: ['기본급여', '해외배송비 + 통관비', '해외광고 + 에이전트비', '기타'],
  },
  {
    id: 'consulting',
    label: '컨설팅',
    icon: 'handshake',
    headerCls: 'bg-amber-50 border-amber-200 text-amber-700',
    badgeCls: 'bg-amber-100 text-amber-700',
    barCls: 'bg-amber-500',
    costHints: ['인건비', '출장비', '외주비', '기타'],
  },
]

/* ─── 숫자 입력 컴포넌트 ──────────────────────────────────────────── */
function NumInput({ value, onChange, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? raw : numFmt(value)}
      onFocus={(e) => { setEditing(true); setRaw(String(Number(value || 0))); e.target.select() }}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => { setEditing(false); onChange(parseNum(raw)) }}
      className={className}
    />
  )
}

/* ─── 채널 패널 ─────────────────────────────────────────────────────── */
function ChannelPanel({ ch, products, planQtyMap, onUpdateProduct, onAddProduct, onRemoveProduct, onSetPlanQty, actualSales }) {
  const [collapsed, setCollapsed] = useState(false)
  const [sortMode, setSortMode] = useState('targetDesc')

  const pCalcs = products.map((p) => {
    const varCost = num(p.cogs) + num(p.logistics_cost) + num(p.marketing_cost) + num(p.other_cost)
    const contrib = num(p.sale_price) - varCost
    const contribRate = p.sale_price > 0 ? (contrib / p.sale_price) * 100 : 0
    const qty = num(planQtyMap[p._key] || 0)
    return { ...p, varCost, contrib, contribRate, qty, revenue: num(p.sale_price) * qty, totalContrib: contrib * qty }
  })

  const sortedRows = [...pCalcs].sort((a, b) => {
    if (sortMode === 'targetAsc') return a.qty - b.qty || a.product_name.localeCompare(b.product_name, 'ko-KR')
    if (sortMode === 'soldDesc') return num(b.sold_qty) - num(a.sold_qty) || b.revenue - a.revenue
    if (sortMode === 'revenueDesc') return b.revenue - a.revenue || b.qty - a.qty
    if (sortMode === 'contribDesc') return b.contrib - a.contrib || b.revenue - a.revenue
    if (sortMode === 'contribAsc') return a.contribRate - b.contribRate || a.product_name.localeCompare(b.product_name, 'ko-KR')
    if (sortMode === 'nameAsc') return a.product_name.localeCompare(b.product_name, 'ko-KR')
    return b.qty - a.qty || b.revenue - a.revenue
  })

  const totalRevenuePlan = pCalcs.reduce((s, p) => s + p.revenue, 0)
  const totalContribPlan = pCalcs.reduce((s, p) => s + p.totalContrib, 0)
  const totalActualRevenue = pCalcs.reduce((s, p) => s + num(p.sold_amount), 0)
  const overallRate = totalRevenuePlan > 0 ? (totalContribPlan / totalRevenuePlan) * 100 : 0
  const actualAmt = num(actualSales)

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div
        className={`flex cursor-pointer items-center justify-between border-b px-6 py-4 ${ch.headerCls}`}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">{ch.icon}</span>
          <div>
            <h2 className="text-base font-black">{ch.label}</h2>
            <p className="text-xs font-bold opacity-70">{ch.costHints[1]} · {ch.costHints[2]}</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {totalRevenuePlan > 0 && (
            <div className="text-right">
              <p className="text-xs font-bold opacity-60">계획 매출</p>
              <p className="text-sm font-black">{wonFmt(totalRevenuePlan)}</p>
            </div>
          )}
          {actualAmt > 0 && (
            <div className="text-right">
              <p className="text-xs font-bold opacity-60">실제 매출</p>
              <p className="text-sm font-black">{wonFmt(actualAmt)}</p>
            </div>
          )}
          {totalRevenuePlan > 0 && (
            <div className="text-right">
              <p className="text-xs font-bold opacity-60">공헌이익률</p>
              <p className={`text-sm font-black ${overallRate >= 0 ? '' : 'text-rose-600'}`}>{pctFmt(overallRate)}</p>
            </div>
          )}
          <span
            className="material-symbols-outlined text-base transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        </div>
      </div>

      {!collapsed && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
            <div className="text-xs font-bold text-slate-400">
              현재 판매 기준 목표 수량과 손익 값을 기준으로 정렬합니다.
            </div>
            <label className="flex items-center gap-2 text-xs font-black text-slate-500">
              정렬
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-sky-400"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2 text-left font-black text-slate-500">제품명</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">판매가</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">원가(COGS)</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">물류비</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">광고/마케팅</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">기타</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">개당 단가</th>
              <th className="px-3 py-2 text-right font-black text-slate-500">공헌이익</th>
                <th className="px-3 py-2 text-center font-black text-slate-500">계획 수량</th>
                <th className="px-3 py-2 text-center font-black text-slate-500">실제 판매</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">계획 매출</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">실시간 매출</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((p) => (
                <tr key={p._key} className={`border-b border-slate-50 hover:bg-slate-50 ${p.contrib < 0 ? 'bg-rose-50' : ''}`}>
                  <td className="px-4 py-2">
                    <div className="min-w-[220px]">
                      <input
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-sky-400"
                        value={p.product_name}
                        onChange={(e) => onUpdateProduct(ch.id, p._key, 'product_name', e.target.value)}
                      />
                      {(p.channel_name || p.qty_per_unit || p.product_code || p.sku) && (
                        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-400">
                          {p.channel_name && <span>{p.channel_name}</span>}
                          {num(p.qty_per_unit) > 1 && <span>판매단위 {numFmt(p.qty_per_unit)}개</span>}
                          {num(p.sold_qty) > 0 && <span>현재 판매 {numFmt(p.sold_qty)}개</span>}
                          {num(p.target_qty) > 0 && <span>목표 {numFmt(p.target_qty)}개</span>}
                          {p.product_code && <span>상품코드 {p.product_code}</span>}
                          {p.sku && <span>SKU {p.sku}</span>}
                        </p>
                      )}
                    </div>
                  </td>
                  {['sale_price', 'cogs', 'logistics_cost', 'marketing_cost', 'other_cost'].map((field) => (
                    <td key={field} className="px-3 py-2">
                      <NumInput
                        value={p[field]}
                        onChange={(v) => onUpdateProduct(ch.id, p._key, field, v)}
                        className={INPUT_CLS}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-xs font-bold text-slate-600">
                    {num(p.qty_per_unit) > 1 ? (Math.round(num(p.sale_price) / num(p.qty_per_unit))).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`rounded px-2 py-0.5 font-black ${contribBadgeCls(p.contribRate)}`}>
                      {wonFmt(p.contrib)} ({pctFmt(p.contribRate)})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NumInput
                      value={p.qty}
                      onChange={(v) => onSetPlanQty(ch.id, p._key, v)}
                      className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold text-slate-700 outline-none focus:border-sky-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex min-w-16 justify-center rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                      {numFmt(p.sold_qty)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{wonFmt(p.revenue)}</td>
                  <td className="px-3 py-2 text-right font-black text-sky-700">{wonFmt(p.sold_amount)}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(ch.id, p._key)}
                      className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={6} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onAddProduct(ch.id)}
                    className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-800"
                  >
                    <span className="material-symbols-outlined text-base">add_circle</span> 제품 추가
                  </button>
                </td>
                <td colSpan={3} className="px-3 py-2 text-right text-xs font-black text-slate-500">합계</td>
                <td className="px-3 py-2 text-right text-sm font-black text-slate-900">{wonFmt(totalRevenuePlan)}</td>
                <td className="px-3 py-2 text-right text-sm font-black text-sky-700">{wonFmt(totalActualRevenue)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}
    </section>
  )
}

/* ─── 실적 vs 계획 차트 ──────────────────────────────────────────── */
function ActualVsPlanChart({ channels, productsByChannel, planQty, actualSales }) {
  const rows = channels.map((ch) => {
    const products = productsByChannel[ch.id] || []
    const plan = products.reduce((s, p) => s + num(p.sale_price) * num(planQty[ch.id]?.[p._key] || 0), 0)
    const actual = num(actualSales[ch.id])
    const maxVal = Math.max(plan, actual, 1)
    const planPct = Math.min((plan / maxVal) * 100, 100)
    const actualPct = Math.min((actual / maxVal) * 100, 100)
    const ratio = plan > 0 ? (actual / plan) * 100 : 0
    return { ch, plan, actual, planPct, actualPct, ratio }
  })

  return (
    <Panel title="채널별 실적 vs 계획">
      <div className="space-y-5 p-4">
        {rows.map(({ ch, plan, actual, planPct, actualPct, ratio }) => (
          <div key={ch.id}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-slate-400">{ch.icon}</span>
                <span className="text-sm font-black text-slate-700">{ch.label}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="text-slate-400">계획 {wonFmt(plan)}</span>
                <span className="text-slate-700">실제 {wonFmt(actual)}</span>
                {plan > 0 && (
                  <span className={`rounded px-2 py-0.5 font-black ${ratio >= 100 ? 'bg-emerald-100 text-emerald-700' : ratio >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                    {pctFmt(ratio, 0)} 달성
                  </span>
                )}
                {plan === 0 && actual === 0 && (
                  <span className="text-slate-300">데이터 없음</span>
                )}
              </div>
            </div>
            <div className="relative h-6 rounded-full bg-slate-100">
              {/* 계획 바 (연하게) */}
              <div
                className={`absolute left-0 top-0 h-6 rounded-full opacity-25 ${ch.barCls}`}
                style={{ width: `${planPct}%` }}
              />
              {/* 실제 바 */}
              <div
                className={`absolute left-0 top-0 h-6 rounded-full ${ch.barCls}`}
                style={{ width: `${actualPct}%` }}
              />
            </div>
          </div>
        ))}
        <p className="pt-1 text-xs text-slate-400">
          연한 막대 = 계획 / 진한 막대 = 실제 | 실제 총매출은 주문 원장과 확정 입력값 기준이며, 예상 파이프라인은 별도 표시됩니다.
        </p>
      </div>
    </Panel>
  )
}

function ForecastGrowthSettings({ channels, forecastGrowth, setForecastGrowth }) {
  const forecastChannels = channels.filter((ch) => ['online', 'offline', 'export'].includes(ch.id))
  const quickRates = [100, 105, 110, 120]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">Forecast Growth Setting</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">익월 매출 성장률 설정</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">
          상단의 현재 계획 총매출을 기준으로 다음 달 계획 매출을 몇 %로 볼지 설정합니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {forecastChannels.map((ch) => (
          <div key={ch.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-slate-500">{ch.icon}</span>
                <span className="text-sm font-black text-slate-900">{ch.label}</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
                <input
                  type="number"
                  min="0"
                  value={forecastGrowth[ch.id] ?? 100}
                  onChange={(event) => setForecastGrowth((prev) => ({ ...prev, [ch.id]: parseNum(event.target.value) }))}
                  className="w-16 bg-transparent text-right text-sm font-black text-slate-900 outline-none"
                />
                <span className="text-xs font-black text-slate-400">%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {quickRates.map((rate) => {
                const active = Number(forecastGrowth[ch.id] || 100) === rate
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setForecastGrowth((prev) => ({ ...prev, [ch.id]: rate }))}
                    className={`h-8 rounded-lg border text-xs font-black transition-colors ${
                      active
                        ? `${ch.headerCls} shadow-sm`
                        : 'border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-700'
                    }`}
                  >
                    {rate}%
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function YearForecastChart({ channels, summary, actualSales, selectedMonth, forecastGrowth }) {
  const coreChannels = channels.filter((ch) => ['online', 'offline', 'export'].includes(ch.id))
  const forecastChannels = [
    {
      id: 'company',
      label: '전사 매출',
      icon: 'corporate_fare',
      headerCls: 'bg-slate-50 border-slate-200 text-slate-800',
      barCls: 'bg-slate-700',
      channelIds: coreChannels.map((ch) => ch.id),
    },
    ...coreChannels.map((ch) => ({ ...ch, channelIds: [ch.id] })),
  ]
  const [activeId, setActiveId] = useState(forecastChannels[0]?.id || 'company')
  const activeChannel = forecastChannels.find((ch) => ch.id === activeId) || forecastChannels[0]
  const channelPlanAt = (channelId, index) => {
    const base = num(summary.channelSummary?.[channelId]?.revenue)
    const rate = num(forecastGrowth?.[channelId] || 100) / 100
    return Math.round(base * Math.pow(rate, index))
  }
  const channelActualAt = (channelId, index) => {
    const base = num(actualSales?.[channelId])
    const rate = num(forecastGrowth?.[channelId] || 100) / 100
    return Math.round(base * Math.pow(rate, index))
  }
  const basePlan = (activeChannel.channelIds || []).reduce((sum, channelId) => sum + channelPlanAt(channelId, 0), 0)
  const baseActual = (activeChannel.channelIds || []).reduce((sum, channelId) => sum + channelActualAt(channelId, 0), 0)

  const rows = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(`${monthInputText(selectedMonth)}-01T00:00:00`)
    date.setMonth(date.getMonth() + index)
    const planRevenue = (activeChannel.channelIds || []).reduce((sum, channelId) => sum + channelPlanAt(channelId, index), 0)
    const actualForecast = (activeChannel.channelIds || []).reduce((sum, channelId) => sum + channelActualAt(channelId, index), 0)
    const bepRate = planRevenue > 0 ? (actualForecast / planRevenue) * 100 : 0
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: `${date.getFullYear().toString().slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}`,
      planRevenue,
      actualForecast,
      bepRate,
    }
  })

  const maxRevenue = Math.max(...rows.flatMap((row) => [row.planRevenue, row.actualForecast]), 1)
  const totalPlan = rows.reduce((sum, row) => sum + row.planRevenue, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actualForecast, 0)
  const avgBepRate = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0
  const currentAchievementRate = totalPlan > 0 ? (baseActual / totalPlan) * 100 : 0
  const firstBepMonth = rows.find((row) => row.planRevenue > 0 && row.actualForecast >= row.planRevenue)
  const [hoveredRow, setHoveredRow] = useState(null)
  const forecastPeriodLabel = rows.length > 0 ? `${rows[0].label} ~ ${rows[rows.length - 1].label}` : '-'

  return (
    <Panel
      title="1년 Forecast 그래프"
      right={
        <div className="flex flex-wrap justify-end gap-2">
          {forecastChannels.map((ch) => {
            const active = ch.id === activeChannel.id
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveId(ch.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition-colors ${
                  active
                    ? `${ch.headerCls} shadow-sm`
                    : 'border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-700'
                }`}
              >
                <span className="material-symbols-outlined text-base">{ch.icon}</span>
                {ch.label}
              </button>
            )
          })}
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">12개월 전체 목표 매출</p>
            <p className="mt-2 text-xl font-black text-slate-950">{wonFmt(totalPlan)}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">{forecastPeriodLabel}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-black text-sky-700">12개월 누적 실매출</p>
            <p className="mt-2 text-xl font-black text-slate-950">{wonFmt(totalActual)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">현재 월 기준 {wonFmt(baseActual)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-500">12개월 BEP 달성률</p>
            <p className={`mt-2 text-xl font-black ${totalActual >= totalPlan ? 'text-sky-600' : 'text-rose-600'}`}>{pctFmt(avgBepRate)}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">실매출 / 목표매출</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-500">현재 기준 달성률</p>
            <p className={`mt-2 text-xl font-black ${currentAchievementRate >= 100 ? 'text-sky-600' : 'text-rose-600'}`}>
              {pctFmt(currentAchievementRate)}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-400">현재 월 실매출 / 12개월 목표</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-black text-slate-500">선택 월</p>
              <p className="mt-1 text-lg font-black text-slate-950">{hoveredRow?.label || '월 선택'}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3">
              <p className="text-[11px] font-black text-sky-700">계획 매출</p>
              <p className="mt-1 text-lg font-black text-slate-950">{hoveredRow ? wonFmt(hoveredRow.planRevenue) : '-'}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-[11px] font-black text-rose-700">실제 매출</p>
              <p className="mt-1 text-lg font-black text-slate-950">{hoveredRow ? wonFmt(hoveredRow.actualForecast) : '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-black text-slate-500">BEP 달성률</p>
              <p className={`mt-1 text-lg font-black ${hoveredRow?.planRevenue > 0 && hoveredRow.actualForecast >= hoveredRow.planRevenue ? 'text-sky-600' : 'text-rose-600'}`}>
                {hoveredRow?.planRevenue > 0 ? pctFmt(hoveredRow.bepRate, 1) : '-'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
          <div className="flex min-w-[1080px] items-end gap-3 rounded-2xl border border-slate-200 bg-white px-5 pb-5 pt-6">
            {rows.map((row) => {
              const planHeight = Math.max(4, (row.planRevenue / maxRevenue) * 180)
              const actualHeight = Math.max(4, (row.actualForecast / maxRevenue) * 180)
              const achieved = row.planRevenue > 0 && row.actualForecast >= row.planRevenue
              return (
                <div
                  key={row.key}
                  className="group relative flex flex-1 flex-col items-center gap-2"
                  onMouseEnter={() => setHoveredRow(row)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {false && hoveredRow?.key === row.key && (
                    <div className="absolute bottom-[232px] left-1/2 z-10 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
                      <p className="text-xs font-black text-slate-900">{row.label} Forecast</p>
                      <div className="mt-2 space-y-1 text-xs font-bold">
                        <div className="flex justify-between gap-3">
                          <span className="text-sky-600">계획 매출</span>
                          <span className="text-slate-900">{wonFmt(row.planRevenue)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-rose-600">실제 매출</span>
                          <span className="text-slate-900">{wonFmt(row.actualForecast)}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-slate-100 pt-1">
                          <span className="text-slate-500">BEP</span>
                          <span className={achieved ? 'text-sky-600' : 'text-rose-600'}>{pctFmt(row.bepRate, 1)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex h-48 w-full items-end justify-center gap-1.5">
                    <div
                      className="w-5 rounded-t bg-sky-500 transition-all group-hover:scale-x-125 group-hover:opacity-90"
                      style={{ height: `${planHeight}px` }}
                      title={`계획 ${wonFmt(row.planRevenue)}`}
                    />
                    <div
                      className="w-5 rounded-t bg-rose-500 transition-all group-hover:scale-x-125 group-hover:opacity-90"
                      style={{ height: `${actualHeight}px` }}
                      title={`실제 ${wonFmt(row.actualForecast)}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-black text-slate-700">{row.label}</p>
                    <p className="mt-1 text-[10px] font-black text-sky-600">{wonFmt(row.planRevenue).replace(' 원', '')}</p>
                    <p className="text-[10px] font-black text-rose-600">{wonFmt(row.actualForecast).replace(' 원', '')}</p>
                    <p className={`mt-1 text-[11px] font-black ${achieved ? 'text-sky-600' : 'text-rose-600'}`}>
                      {row.planRevenue > 0 ? pctFmt(row.bepRate, 0) : '-'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-500" />계획 매출</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-500" />실제 매출</span>
          </div>
          <span>첫 달은 상단 카드와 동일 · 이후 월은 설정한 익월 성장률 적용 · 전사 매출은 국내온라인+국내오프라인+해외수출 합산</span>
        </div>
      </div>
      </div>
    </Panel>
  )
}

function SalesSourceAudit({ rows = [] }) {
  const usageClass = {
    actual: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    reference: 'bg-slate-50 text-slate-600 border-slate-200',
    expected: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const usageLabel = {
    actual: '실제 합산',
    reference: '참고',
    expected: '예상',
  }

  return (
    <Panel title="매출 원천 점검">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              <th className="px-4 py-3">원천</th>
              <th className="px-4 py-3 text-right">금액</th>
              <th className="px-4 py-3">반영</th>
              <th className="px-4 py-3">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-3 font-black text-slate-800">{row.label}</td>
                <td className="px-4 py-3 text-right font-black text-slate-900">{wonFmt(row.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-xs font-black ${usageClass[row.usage] || usageClass.reference}`}>
                    {usageLabel[row.usage] || '참고'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-bold text-slate-500">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function ChannelBepSummary({ title, rows }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {rows.map((item) => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            helperText={item.helperText}
            tone={item.tone}
            icon={item.icon}
            trend={item.trend}
            valueClassName={item.valueClassName}
          />
        ))}
      </div>
    </section>
  )
}

/* ─── 메인 페이지 ────────────────────────────────────────────────────── */
let _nextKey = 1000

export default function ProfitManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [refreshingSales, setRefreshingSales] = useState(false)
  const [salesRefreshMessage, setSalesRefreshMessage] = useState('')
  const [salesUpdatedAt, setSalesUpdatedAt] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(monthStartText())
  const [forecastGrowth, setForecastGrowth] = useState({ online: 100, offline: 100, export: 100 })

  const [productsByChannel, setProductsByChannel] = useState({ online: [], offline: [], export: [], consulting: [] })
  const [planQty, setPlanQty] = useState({ online: {}, offline: {}, export: {}, consulting: {} })

  useEffect(() => {
    setLoading(true)
    getProfitManagement({ planMonth: selectedMonth })
      .then(async (res) => {
        const d = res.data
        setData(d)

        const isUsablePlan = (items = []) => items.some((item) =>
          num(item.sale_price) > 0 ||
          num(item.cogs) > 0 ||
          num(item.logistics_cost) > 0 ||
          num(item.marketing_cost) > 0 ||
          num(item.other_cost) > 0 ||
          num(item.planned_qty) > 0
        )
        const hasUsablePlan = isUsablePlan(d.plan)
        let seedPlan = isUsablePlan(d.previousPlan) ? d.previousPlan : []
        let seedOffset = seedPlan.length > 0 ? 1 : 0

        if (!hasUsablePlan && seedPlan.length === 0) {
          for (let offset = 2; offset <= 12; offset += 1) {
            const seedMonth = nextMonthText(selectedMonth, -offset)
            const seedRes = await getProfitManagement({ planMonth: seedMonth })
            const candidate = seedRes.data?.plan || []
            if (isUsablePlan(candidate)) {
              seedPlan = candidate
              seedOffset = monthDiff(seedMonth, selectedMonth)
              break
            }
          }
        }

        const byChannel = { online: [], offline: [], export: [], consulting: [] }
        const qty = { online: {}, offline: {}, export: {}, consulting: {} }
        const currentPlanByName = new Map((d.plan || []).map((item) => [`${item.channel}::${item.product_name}`, item]))
        const previousPlanByName = new Map((seedPlan || []).map((item) => [`${item.channel}::${item.product_name}`, item]))

        if (hasUsablePlan) {
          // 저장된 계획 불러오기. 온라인은 아래에서 제조 원가 기준으로 다시 채운다.
          d.plan.forEach((item) => {
            const key = `s_${item.id}`
            const ch = item.channel
            if (!byChannel[ch]) byChannel[ch] = []
            byChannel[ch].push({ ...item, _key: key })
            if (!qty[ch]) qty[ch] = {}
            qty[ch][key] = item.planned_qty
          })
        } else if (seedPlan.length > 0) {
          seedPlan.forEach((item) => {
            const key = `f_${item.id}`
            const ch = item.channel
            const growthRate = num(forecastGrowth?.[ch] || 100) / 100
            const growthFactor = Math.pow(growthRate, seedOffset || 1)
            const forecastQty = Math.ceil(num(item.planned_qty) * growthFactor)
            if (!byChannel[ch]) byChannel[ch] = []
            byChannel[ch].push({ ...item, planned_qty: forecastQty, _key: key })
            if (!qty[ch]) qty[ch] = {}
            qty[ch][key] = forecastQty
          })
        }

        if (d.products && d.products.length > 0) {
          // 제조 원가 관리 테이블 기반으로 온라인 채널 초기화
          byChannel.online = []
          qty.online = {}
          d.products.forEach((p, i) => {
            const key = `a_${i}`
            const currentPlan = currentPlanByName.get(`online::${p.product_name}`)
            byChannel.online.push({
              _key: key,
              product_name: p.product_name,
              channel_name: p.channel_name,
              product_code: p.product_code,
              sku: p.sku,
              qty_per_unit: num(p.qty_per_unit) || 1,
              sold_qty: num(p.sold_qty),
              sold_amount: num(p.sold_amount),
              target_qty: num(p.target_qty),
              sale_price: num(currentPlan?.sale_price) || num(p.sale_price),
              cogs: num(currentPlan?.cogs) || num(p.cogs),
              logistics_cost: num(currentPlan?.logistics_cost) || num(p.logistics_cost),
              marketing_cost: num(currentPlan?.marketing_cost) || num(p.marketing_cost) || num(p.ad_cost),
              other_cost: num(currentPlan?.other_cost) || num(p.platform_fee) + num(p.operating_admin_cost),
            })
            const previousPlan = previousPlanByName.get(`online::${p.product_name}`)
            const monthGrowthFallback = seedOffset > 0 ? Math.pow(num(forecastGrowth.online || 100) / 100, seedOffset) : 1
            qty.online[key] = currentPlan
              ? num(currentPlan.planned_qty)
              : previousPlan
              ? Math.ceil(num(previousPlan.planned_qty) * monthGrowthFallback)
              : Math.ceil(num(p.target_qty) * monthGrowthFallback)
          })
        }

        setProductsByChannel(byChannel)
        setPlanQty(qty)
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [selectedMonth, forecastGrowth])

  useEffect(() => {
    const timer = setInterval(() => {
      getProfitManagement({ planMonth: selectedMonth })
        .then((res) => {
          const d = res.data
          setData(d)
          const actualByKey = new Map((d.products || []).map((p) => [
            `${p.channel_name || ''}::${p.product_code || ''}::${p.product_name || ''}`,
            p,
          ]))
          setProductsByChannel((prev) => ({
            ...prev,
            online: (prev.online || []).map((row) => {
              const fresh = actualByKey.get(`${row.channel_name || ''}::${row.product_code || ''}::${row.product_name || ''}`)
              if (!fresh) return row
              return {
                ...row,
                sold_qty: num(fresh.sold_qty),
                sold_amount: num(fresh.sold_amount),
                target_qty: num(fresh.target_qty),
              }
            }),
          }))
        })
        .catch(() => {})
    }, 60000)
    return () => clearInterval(timer)
  }, [selectedMonth])

  function handleAddProduct(channelId) {
    const key = `n_${Date.now()}_${_nextKey++}`
    setProductsByChannel((prev) => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), {
        _key: key,
        product_name: '신규 제품',
        sale_price: 0, cogs: 0, logistics_cost: 0, marketing_cost: 0, other_cost: 0,
      }],
    }))
  }

  function handleRemoveProduct(channelId, key) {
    setProductsByChannel((prev) => ({
      ...prev,
      [channelId]: prev[channelId].filter((p) => p._key !== key),
    }))
  }

  function handleUpdateProduct(channelId, key, field, value) {
    setProductsByChannel((prev) => ({
      ...prev,
      [channelId]: prev[channelId].map((p) => p._key === key ? { ...p, [field]: value } : p),
    }))
  }

  function handleSetPlanQty(channelId, key, qty) {
    setPlanQty((prev) => ({
      ...prev,
      [channelId]: { ...(prev[channelId] || {}), [key]: qty },
    }))
  }

  function applyRealtimeSales(d) {
    setData(d)
    const actualByKey = new Map((d.products || []).map((p) => [
      `${p.channel_name || ''}::${p.product_code || ''}::${p.product_name || ''}`,
      p,
    ]))
    setProductsByChannel((prev) => ({
      ...prev,
      online: (prev.online || []).map((row) => {
        const fresh = actualByKey.get(`${row.channel_name || ''}::${row.product_code || ''}::${row.product_name || ''}`)
        if (!fresh) return row
        return {
          ...row,
          sold_qty: num(fresh.sold_qty),
          sold_amount: num(fresh.sold_amount),
          target_qty: num(fresh.target_qty),
        }
      }),
    }))
  }

  async function handleRefreshRealtimeSales() {
    if (refreshingSales) return
    setRefreshingSales(true)
    setSalesRefreshMessage('PlayAuto 주문 원장과 채널 매출 데이터를 다시 수집하는 중입니다.')
    try {
      await importPlayAutoChannelSales({
        startDate: selectedMonth,
        endDate: monthEndText(selectedMonth),
        refreshOrders: true,
      })
      const response = await getProfitManagement({ planMonth: selectedMonth })
      applyRealtimeSales(response.data)
      const now = new Date()
      setSalesUpdatedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      setSalesRefreshMessage('실시간 총매출이 최신 주문 데이터 기준으로 업데이트되었습니다.')
    } catch (error) {
      setSalesRefreshMessage(error?.response?.data?.message || '실시간 총매출 업데이트에 실패했습니다. PlayAuto 연동 설정을 확인해주세요.')
    } finally {
      setRefreshingSales(false)
    }
  }

  async function handleSave() {
    if (!data) return
    setSaving(true)
    const buildPlanItems = (monthOffset = 0) => {
      const items = []
      CHANNELS.forEach((ch) => {
        const growthRate = ['online', 'offline', 'export'].includes(ch.id)
          ? num(forecastGrowth?.[ch.id] || 100) / 100
          : 1
        const growthFactor = Math.pow(growthRate, monthOffset)
        ;(productsByChannel[ch.id] || []).forEach((p) => {
          const baseQty = num(planQty[ch.id]?.[p._key] || 0)
          const plannedQty = monthOffset === 0
            ? baseQty
            : baseQty > 0
            ? Math.ceil(baseQty * growthFactor)
            : 0
          items.push({
            channel: ch.id,
            product_name: p.product_name,
            sale_price: p.sale_price,
            cogs: p.cogs,
            logistics_cost: p.logistics_cost,
            marketing_cost: p.marketing_cost,
            other_cost: p.other_cost,
            planned_qty: plannedQty,
          })
        })
      })
      return items
    }
    try {
      for (let offset = 0; offset < 12; offset += 1) {
        await saveProfitPlan(nextMonthText(data.planMonth, offset), buildPlanItems(offset))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    let totalRevenue = 0, totalContrib = 0
    const channelSummary = {}
    CHANNELS.forEach((ch) => {
      let revenue = 0
      let contrib = 0
      ;(productsByChannel[ch.id] || []).forEach((p) => {
        const qty = num(planQty[ch.id]?.[p._key] || 0)
        const rev = num(p.sale_price) * qty
        const varCost = (num(p.cogs) + num(p.logistics_cost) + num(p.marketing_cost) + num(p.other_cost)) * qty
        revenue += rev
        contrib += rev - varCost
      })
      channelSummary[ch.id] = { revenue, contrib }
      totalRevenue += revenue
      totalContrib += contrib
    })
    const fixedCost = num(data?.totalFixedCost)
    const operatingProfit = totalContrib - fixedCost
    const operatingProfitRate = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0
    const totalDebt = num(data?.debtSummary?.total_balance)
    const avgInterest = num(data?.debtSummary?.avg_interest_rate)
    const monthlyPayment = num(data?.debtSummary?.total_monthly_payment)
    const monthlyInterestCost = totalDebt * (avgInterest / 100) / 12
    const totalActualSales = num(data?.actualSales?.total)
    const bepRate = totalRevenue > 0 ? (totalActualSales / totalRevenue) * 100 : 0
    const bepGap = totalRevenue - totalActualSales
    const netProfit = operatingProfit - monthlyInterestCost
    const netProfitRate = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const repayMonths = monthlyPayment > 0 && netProfit > 0 ? Math.ceil(totalDebt / netProfit) : 0
    return { totalRevenue, totalActualSales, totalContrib, channelSummary, fixedCost, bepRate, bepGap, operatingProfit, operatingProfitRate, totalDebt, avgInterest, monthlyPayment, monthlyInterestCost, netProfit, netProfitRate, repayMonths }
  }, [productsByChannel, planQty, data])

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>
  if (error) return <div className="p-8 text-center text-sm text-rose-500">{error}</div>

  const actualSales = data?.actualSales || {}
  const bepChannels = [
    { id: 'online', title: '온라인', actualKey: 'online' },
    { id: 'offline', title: '국내 오프라인', actualKey: 'offline' },
    { id: 'export', title: '해외', actualKey: 'export' },
  ]
  const bepPlanTotal = bepChannels.reduce((sum, ch) => sum + num(summary.channelSummary?.[ch.id]?.revenue), 0)
  const planSummaryContrib = bepChannels.reduce((sum, ch) => sum + num(summary.channelSummary?.[ch.id]?.contrib), 0)
  const planSummaryActualSales = bepChannels.reduce((sum, ch) => sum + num(actualSales[ch.actualKey]), 0)
  const planSummaryBepRate = bepPlanTotal > 0 ? (planSummaryActualSales / bepPlanTotal) * 100 : 0
  const planSummaryOperatingProfit = planSummaryContrib - summary.fixedCost
  const planSummaryOperatingProfitRate = bepPlanTotal > 0 ? (planSummaryOperatingProfit / bepPlanTotal) * 100 : 0
  const planSummaryNetProfit = planSummaryOperatingProfit - summary.monthlyInterestCost
  const planSummaryNetProfitRate = bepPlanTotal > 0 ? (planSummaryNetProfit / bepPlanTotal) * 100 : 0

  function buildChannelBepRows(ch) {
    const planRevenue = num(summary.channelSummary?.[ch.id]?.revenue)
    const contrib = num(summary.channelSummary?.[ch.id]?.contrib)
    const share = bepPlanTotal > 0 ? planRevenue / bepPlanTotal : 1 / bepChannels.length
    const fixedShare = summary.fixedCost * share
    const interestShare = summary.monthlyInterestCost * share
    const operatingProfit = contrib - fixedShare
    const netProfit = operatingProfit - interestShare
    const actualRevenue = num(actualSales[ch.actualKey])
    const bepRate = planRevenue > 0 ? (actualRevenue / planRevenue) * 100 : 0
    const bepGap = planRevenue - actualRevenue
    const marginRate = planRevenue > 0 ? (contrib / planRevenue) * 100 : 0
    return [
      { label: `실제 총매출 (${ch.title})`, value: wonFmt(actualRevenue), icon: 'monitoring' },
      { label: `계획 총 매출 (${ch.title})`, value: wonFmt(planRevenue), icon: 'monitoring' },
      {
        label: 'BEP 달성률',
        value: planRevenue > 0 ? pctFmt(bepRate) : '-',
        helperText: bepRate >= 100 ? '100% 이상 달성' : `부족 ${wonFmt(Math.max(bepGap, 0))}`,
        tone: bepRate >= 100 ? 'sky' : 'rose',
        icon: 'flag',
        valueClassName: bepRate >= 100 ? 'text-sky-600' : 'text-rose-600',
      },
      { label: '공헌이익률', value: planRevenue > 0 ? pctFmt(marginRate) : '-', helperText: `공헌이익 ${wonFmt(contrib)}`, icon: 'monitoring' },
      {
        label: '영업이익',
        value: wonFmt(operatingProfit),
        helperText: `배분 고정비 ${wonFmt(fixedShare)}`,
        trend: operatingProfit >= 0 ? 'up' : 'down',
        icon: 'monitoring',
        valueClassName: operatingProfit >= 0 ? 'text-sky-600' : 'text-rose-600',
      },
      {
        label: '순이익 (이자 후)',
        value: wonFmt(netProfit),
        helperText: `배분 이자 ${wonFmt(interestShare)}`,
        trend: netProfit >= 0 ? 'up' : 'down',
        icon: 'monitoring',
        valueClassName: netProfit >= 0 ? 'text-sky-600' : 'text-rose-600',
      },
    ]
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="BEP / 손익 시뮬레이션"
          description="현재 판매 페이스와 제품별 공헌이익 기준으로 손익분기점과 목표 수익을 계산합니다."
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonth((value) => nextMonthText(value, -1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-600"
            aria-label="이전 월"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm">
            <span className="material-symbols-outlined text-base text-sky-600">calendar_month</span>
            <input
              type="month"
              value={monthInputText(selectedMonth)}
              onChange={(event) => setSelectedMonth(`${event.target.value}-01`)}
              className="w-[132px] bg-transparent text-sm font-black text-slate-800 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setSelectedMonth((value) => nextMonthText(value, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-600"
            aria-label="다음 월"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-black shadow-sm transition-colors ${saved ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white hover:bg-sky-600'} disabled:opacity-60`}
          >
            <span className="material-symbols-outlined text-base">{saved ? 'check_circle' : 'save'}</span>
            {saving ? '저장 중...' : saved ? '저장됨' : '계획 저장'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <ForecastGrowthSettings
          channels={CHANNELS}
          forecastGrowth={forecastGrowth}
          setForecastGrowth={setForecastGrowth}
        />

        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Realtime Sales API</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">BEP/손익 시뮬레이션 실시간 총매출 업데이트</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">
                선택한 월의 PlayAuto 주문 원장을 다시 수집해서 실제 총매출, 제품별 실제 판매 수량, BEP 달성률을 갱신합니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white px-3 py-1 text-slate-700">대상 월 {monthInputText(selectedMonth)}</span>
                <span className="rounded-full bg-white px-3 py-1 text-sky-700">실제 총매출 {wonFmt(summary.totalActualSales)}</span>
                <span className={`rounded-full bg-white px-3 py-1 ${summary.bepRate >= 100 ? 'text-sky-700' : 'text-rose-700'}`}>
                  BEP 달성률 {pctFmt(summary.bepRate)}
                </span>
                {salesUpdatedAt && <span className="rounded-full bg-white px-3 py-1 text-emerald-700">최근 업데이트 {salesUpdatedAt}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefreshRealtimeSales}
              disabled={refreshingSales}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <span className={`material-symbols-outlined text-lg ${refreshingSales ? 'animate-spin' : ''}`}>{refreshingSales ? 'sync' : 'cloud_sync'}</span>
              {refreshingSales ? '총매출 업데이트 중' : '실시간 총매출 업데이트'}
            </button>
          </div>
          {salesRefreshMessage && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-700">
              {salesRefreshMessage}
            </div>
          )}
        </section>

        {bepChannels.map((ch) => (
          <ChannelBepSummary key={ch.id} title={ch.title} rows={buildChannelBepRows(ch)} />
        ))}
      </div>

      {/* 재무 기반 정보 카드 (DB 자동 pull) */}
      <Panel title="이번달 계획 요약">
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">총 계획 매출</p>
            <p className="mt-2 text-xl font-black text-slate-950">{wonFmt(bepPlanTotal)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">공헌이익</p>
            <p className={`mt-2 text-xl font-black ${planSummaryContrib >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{wonFmt(planSummaryContrib)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">BEP 달성률</p>
            <p className={`mt-2 text-xl font-black ${planSummaryBepRate >= 100 ? 'text-sky-600' : 'text-rose-600'}`}>{bepPlanTotal > 0 ? pctFmt(planSummaryBepRate) : '-'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">영업이익</p>
            <p className={`mt-2 text-xl font-black ${planSummaryOperatingProfit >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{wonFmt(planSummaryOperatingProfit)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">고정비 자동 차감 · {bepPlanTotal > 0 ? pctFmt(planSummaryOperatingProfitRate) : '-'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">순이익</p>
            <p className={`mt-2 text-xl font-black ${planSummaryNetProfit >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{wonFmt(planSummaryNetProfit)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">부채 이자 자동 차감 · {bepPlanTotal > 0 ? pctFmt(planSummaryNetProfitRate) : '-'}</p>
          </div>
        </div>
      </Panel>

      <div className="hidden">
        <Panel title="📌 이번 달 고정비">
          <div className="space-y-1.5 p-4 text-sm">
            {data?.fixedCosts?.length > 0 ? (
              <>
                {data.fixedCosts.map((fc, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-500">{fc.category}</span>
                    <span className="font-bold text-slate-700">{wonFmt(fc.total)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-black text-slate-700">합계</span>
                  <span className="font-black text-rose-600">{wonFmt(summary.fixedCost)}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">운영 비용 페이지에서 이번 달 데이터를 먼저 입력하세요</p>
            )}
          </div>
        </Panel>

        <Panel title="📌 부채 현황">
          <div className="space-y-1.5 p-4 text-sm">
            {summary.totalDebt > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">총 잔액</span>
                  <span className="font-bold text-rose-600">{wonFmt(summary.totalDebt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">가중 평균 금리</span>
                  <span className="font-bold text-slate-700">{pctFmt(summary.avgInterest)}% / 월</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">월 상환액</span>
                  <span className="font-bold text-slate-700">{wonFmt(summary.monthlyPayment)}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">부채 페이지에서 데이터를 먼저 입력하세요</p>
            )}
          </div>
        </Panel>

        <Panel title="📊 이번 달 계획 요약">
          <div className="space-y-1.5 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">총 계획 매출</span>
              <span className="font-bold text-slate-700">{wonFmt(summary.totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">공헌이익</span>
              <span className={`font-bold ${summary.totalContrib >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{wonFmt(summary.totalContrib)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">BEP 달성률</span>
              <span className={`font-bold ${summary.bepRate >= 100 ? 'text-sky-600' : 'text-rose-600'}`}>
                {summary.totalRevenue > 0 ? pctFmt(summary.bepRate) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">영업이익</span>
              <span className={`font-bold ${summary.operatingProfit >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>
                {wonFmt(summary.operatingProfit)}
                <span className="ml-1 text-xs">({summary.totalRevenue > 0 ? pctFmt(summary.operatingProfitRate) : '-'})</span>
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-black text-slate-700">순이익 (이자 차감)</span>
              <span className={`font-black ${summary.netProfit >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>
                {wonFmt(summary.netProfit)}
                <span className="ml-1 text-xs">({summary.totalRevenue > 0 ? pctFmt(summary.netProfitRate) : '-'})</span>
              </span>
            </div>
          </div>
        </Panel>
      </div>

      {/* 부채 상환 예측 배너 */}
      {summary.totalDebt > 0 && (
        <div className={`rounded-lg border px-5 py-3 text-sm font-bold ${summary.repayMonths > 0 ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          <span className="material-symbols-outlined mr-2 align-middle text-base">schedule</span>
          {summary.repayMonths > 0
            ? `현재 순이익 기준 부채 전액 상환까지 약 ${repayLabel(summary.repayMonths)} — 완납 예상 ${repayDate(summary.repayMonths)}`
            : '순이익이 0 이하 — 현재 계획으로는 부채 상환 불가'}
        </div>
      )}

      {/* 이상치 알림 줄 */}
      {(() => {
        const allCalc = CHANNELS.flatMap(ch =>
          (productsByChannel[ch.id] || []).map(p => {
            const varCost = num(p.cogs) + num(p.logistics_cost) + num(p.marketing_cost) + num(p.other_cost)
            return num(p.sale_price) - varCost
          })
        )
        const lossSkus = allCalc.filter(v => v < 0).length
        if (lossSkus === 0) return null
        return (
          <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-700">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>팔수록 적자 SKU {lossSkus}건 — 공헌이익이 음수인 항목이 있습니다.</span>
          </div>
        )
      })()}

      {/* 채널 패널들 */}
      <div className="space-y-4">
        {CHANNELS.map((ch) => (
          <ChannelPanel
            key={ch.id}
            ch={ch}
            products={productsByChannel[ch.id] || []}
            planQtyMap={planQty[ch.id] || {}}
            onUpdateProduct={handleUpdateProduct}
            onAddProduct={handleAddProduct}
            onRemoveProduct={handleRemoveProduct}
            onSetPlanQty={handleSetPlanQty}
            actualSales={actualSales[ch.id] || 0}
          />
        ))}
      </div>

      {/* 실적 vs 계획 차트 */}
      <ActualVsPlanChart
        channels={CHANNELS}
        productsByChannel={productsByChannel}
        planQty={planQty}
        actualSales={actualSales}
      />

      <YearForecastChart
        channels={CHANNELS}
        summary={summary}
        actualSales={actualSales}
        selectedMonth={selectedMonth}
        forecastGrowth={forecastGrowth}
      />

      <SalesSourceAudit rows={data?.salesSources || []} />
    </div>
  )
}
