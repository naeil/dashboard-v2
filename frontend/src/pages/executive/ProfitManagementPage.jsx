import { useEffect, useMemo, useState } from 'react'
import { getProfitManagement, saveProfitPlan } from '../../api/executiveApi'
import { KpiCard, PageHeader, Panel } from './ExecutiveComponents'

/* ─── 포맷 헬퍼 ─────────────────────────────────────────────────────── */
const num = (v) => Number(v || 0)
const numFmt = (v) => Number(v || 0).toLocaleString('ko-KR')
const wonFmt = (v) => `${numFmt(v)} 원`
const pctFmt = (v, d = 1) => `${Number(v || 0).toFixed(d)}%`

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

  const pCalcs = products.map((p) => {
    const varCost = num(p.cogs) + num(p.logistics_cost) + num(p.marketing_cost) + num(p.other_cost)
    const contrib = num(p.sale_price) - varCost
    const contribRate = p.sale_price > 0 ? (contrib / p.sale_price) * 100 : 0
    const qty = num(planQtyMap[p._key] || 0)
    return { ...p, varCost, contrib, contribRate, qty, revenue: num(p.sale_price) * qty, totalContrib: contrib * qty }
  })

  const totalRevenuePlan = pCalcs.reduce((s, p) => s + p.revenue, 0)
  const totalContribPlan = pCalcs.reduce((s, p) => s + p.totalContrib, 0)
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
                <th className="px-3 py-2 text-right font-black text-slate-500">공헌이익</th>
                <th className="px-3 py-2 text-center font-black text-slate-500">계획 수량</th>
                <th className="px-3 py-2 text-right font-black text-slate-500">계획 매출</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pCalcs.map((p) => (
                <tr key={p._key} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <input
                      className="w-36 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-sky-400"
                      value={p.product_name}
                      onChange={(e) => onUpdateProduct(ch.id, p._key, 'product_name', e.target.value)}
                    />
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
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{wonFmt(p.revenue)}</td>
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
                <td colSpan={2} className="px-3 py-2 text-right text-xs font-black text-slate-500">합계</td>
                <td className="px-3 py-2 text-right text-sm font-black text-slate-900">{wonFmt(totalRevenuePlan)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
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
          연한 막대 = 계획 / 진한 막대 = 실제 | 국내 온라인: PlayAuto 연동, 컨설팅: 컨설팅 매출 페이지, 수출: 수출 파이프라인 기준
        </p>
      </div>
    </Panel>
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

  const [productsByChannel, setProductsByChannel] = useState({ online: [], offline: [], export: [], consulting: [] })
  const [planQty, setPlanQty] = useState({ online: {}, offline: {}, export: {}, consulting: {} })

  useEffect(() => {
    setLoading(true)
    getProfitManagement()
      .then((res) => {
        const d = res.data
        setData(d)

        if (d.plan && d.plan.length > 0) {
          // 저장된 계획 불러오기
          const byChannel = { online: [], offline: [], export: [], consulting: [] }
          const qty = { online: {}, offline: {}, export: {}, consulting: {} }
          d.plan.forEach((item) => {
            const key = `s_${item.id}`
            const ch = item.channel
            if (!byChannel[ch]) byChannel[ch] = []
            byChannel[ch].push({ ...item, _key: key })
            if (!qty[ch]) qty[ch] = {}
            qty[ch][key] = item.planned_qty
          })
          setProductsByChannel(byChannel)
          setPlanQty(qty)
        } else if (d.products && d.products.length > 0) {
          // 제품 손익 테이블 기반으로 온라인 채널 초기화
          const byChannel = { online: [], offline: [], export: [], consulting: [] }
          d.products.forEach((p, i) => {
            const key = `a_${i}`
            byChannel.online.push({
              _key: key,
              product_name: p.product_name,
              sale_price: num(p.sale_price),
              cogs: num(p.cogs),
              logistics_cost: num(p.logistics_cost),
              marketing_cost: num(p.marketing_cost) || num(p.ad_cost),
              other_cost: num(p.platform_fee),
            })
          })
          setProductsByChannel(byChannel)
          setPlanQty({ online: {}, offline: {}, export: {}, consulting: {} })
        }
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

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

  async function handleSave() {
    if (!data) return
    setSaving(true)
    const items = []
    CHANNELS.forEach((ch) => {
      ;(productsByChannel[ch.id] || []).forEach((p) => {
        items.push({
          channel: ch.id,
          product_name: p.product_name,
          sale_price: p.sale_price,
          cogs: p.cogs,
          logistics_cost: p.logistics_cost,
          marketing_cost: p.marketing_cost,
          other_cost: p.other_cost,
          planned_qty: planQty[ch.id]?.[p._key] || 0,
        })
      })
    })
    try {
      await saveProfitPlan(data.planMonth, items)
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
    CHANNELS.forEach((ch) => {
      ;(productsByChannel[ch.id] || []).forEach((p) => {
        const qty = num(planQty[ch.id]?.[p._key] || 0)
        const rev = num(p.sale_price) * qty
        const varCost = (num(p.cogs) + num(p.logistics_cost) + num(p.marketing_cost) + num(p.other_cost)) * qty
        totalRevenue += rev
        totalContrib += rev - varCost
      })
    })
    const fixedCost = num(data?.totalFixedCost)
    const operatingProfit = totalContrib - fixedCost
    const totalDebt = num(data?.debtSummary?.total_balance)
    const avgInterest = num(data?.debtSummary?.avg_interest_rate)
    const monthlyPayment = num(data?.debtSummary?.total_monthly_payment)
    const monthlyInterestCost = totalDebt * (avgInterest / 100)
    const netProfit = operatingProfit - monthlyInterestCost
    const repayMonths = monthlyPayment > 0 && netProfit > 0 ? Math.ceil(totalDebt / netProfit) : 0
    return { totalRevenue, totalContrib, fixedCost, operatingProfit, totalDebt, avgInterest, monthlyPayment, monthlyInterestCost, netProfit, repayMonths }
  }, [productsByChannel, planQty, data])

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>
  if (error) return <div className="p-8 text-center text-sm text-rose-500">{error}</div>

  const actualSales = data?.actualSales || {}

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="수익 구조 분석"
          description="채널별 제품 공헌이익과 고정비 구조로 실제 영업이익을 시뮬레이션합니다."
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-black shadow-sm transition-colors ${saved ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white hover:bg-sky-600'} disabled:opacity-60`}
        >
          <span className="material-symbols-outlined text-base">{saved ? 'check_circle' : 'save'}</span>
          {saving ? '저장 중...' : saved ? '저장됨' : '계획 저장'}
        </button>
      </div>

      {/* 재무 기반 정보 카드 (DB 자동 pull) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <span className="text-slate-500">영업이익</span>
              <span className={`font-bold ${summary.operatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{wonFmt(summary.operatingProfit)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-black text-slate-700">순이익 (이자 차감)</span>
              <span className={`font-black ${summary.netProfit >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{wonFmt(summary.netProfit)}</span>
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

      {/* 전체 요약 KPI */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="계획 총 매출" value={wonFmt(summary.totalRevenue)} />
        <KpiCard
          label="공헌이익률"
          value={summary.totalRevenue > 0 ? pctFmt((summary.totalContrib / summary.totalRevenue) * 100) : '-'}
          sub={`공헌이익 ${wonFmt(summary.totalContrib)}`}
        />
        <KpiCard
          label="영업이익"
          value={wonFmt(summary.operatingProfit)}
          sub={`고정비 ${wonFmt(summary.fixedCost)} 차감`}
          trend={summary.operatingProfit >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          label="순이익 (이자 후)"
          value={wonFmt(summary.netProfit)}
          sub={`월 이자비용 ${wonFmt(summary.monthlyInterestCost)}`}
          trend={summary.netProfit >= 0 ? 'up' : 'down'}
        />
      </div>
    </div>
  )
}
