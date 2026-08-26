import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getChannelDefaults, searchPromoProducts, listPromoEvents, getPromoEvent,
  createPromoEvent, updatePromoEvent, updatePromoStatus, deletePromoEvent, getPromoRealtime,
} from '../../api/promoV2Api'

/* ─────────────────────────── 상수 ─────────────────────────── */

const BRANDS = ['하이프리', '단백깡', '프리하닭', '국민한상']
const PROMO_TYPES = ['할인', '증정', '할인+증정', '노출형']
const STATUS_LIST = ['기획', '진행중', '종료', '취소']
const STATUS_STYLE = {
  기획: 'bg-slate-100 text-slate-600',
  진행중: 'bg-blue-50 text-blue-600',
  종료: 'bg-emerald-50 text-emerald-600',
  취소: 'bg-rose-50 text-rose-500',
}

const EMPTY_BENEFIT = {
  discountType: 'none', discountValue: 0,
  couponAmount: 0, couponBearer: 'seller',
  giftProductCode: '', giftName: '', giftQty: 0, giftUnitCost: 0,
  freeShipping: false,
}

/* ─────────────────────────── 숫자/포맷 ─────────────────────────── */

const num = (v) => { const x = Number(String(v ?? 0).replace(/,/g, '')); return Number.isFinite(x) ? x : 0 }
const won = (v) => `${Math.round(num(v)).toLocaleString('ko-KR')}원`
const comma = (v) => Math.round(num(v)).toLocaleString('ko-KR')
const pct1 = (v) => `${Number(num(v)).toFixed(1)}%`

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ─────────────────────────── 계산식 (기능정의서 5장) ─────────────────────────── */

function calcOption(opt, ev) {
  const listPrice = num(opt.listPrice)
  const b = opt.benefit || {}
  const discount = b.discountType === 'rate'
    ? listPrice * num(b.discountValue) / 100
    : b.discountType === 'amount' ? num(b.discountValue) : 0
  const sellerCoupon = b.couponBearer === 'seller' ? num(b.couponAmount) : 0
  const netPrice = Math.max(0, listPrice - discount - sellerCoupon)
  const giftCost = num(b.giftUnitCost) * num(b.giftQty)
  const shipCost = b.freeShipping ? num(ev.shippingCost) : 0
  const netCost = num(opt.unitCost) + giftCost + shipCost
  const fee = netPrice * num(ev.feeRate) / 100
  const ad = netPrice * num(ev.adRate) / 100
  const sga = netPrice * num(ev.sgaRate) / 100
  const contribution = netPrice - netCost - fee
  const profit = contribution - ad - sga
  const margin = netPrice > 0 ? (profit / netPrice) * 100 : 0
  const qty = Math.round(num(ev.expectedOrders) * num(opt.mixRate) / 100)
  return { listPrice, discount, sellerCoupon, netPrice, giftCost, shipCost, netCost, fee, ad, sga, contribution, profit, margin, qty }
}

function calcEvent(ev) {
  const flat = (ev.blocks || []).flatMap((blk) => (blk.options || []).map((o) => ({ o, r: calcOption(o, ev) })))
  const mixTotal = flat.reduce((s, { o }) => s + num(o.mixRate), 0)
  const revenue = flat.reduce((s, { r }) => s + r.netPrice * r.qty, 0)
  const optionProfit = flat.reduce((s, { r }) => s + r.profit * r.qty, 0)
  const fixedCost = num(ev.fixedCost)
  const eventProfit = optionProfit - fixedCost
  const weightedMargin = revenue > 0 ? (eventProfit / revenue) * 100 : 0
  const perOrderProfit = flat.reduce((s, { o, r }) => s + r.profit * num(o.mixRate) / 100, 0)
  const bep = fixedCost > 0 && perOrderProfit > 0 ? Math.ceil(fixedCost / perOrderProfit) : null
  const target = num(ev.targetMarginRate)
  let verdict = '재검토'
  if (revenue > 0) {
    if (weightedMargin >= target) verdict = '진행 가능'
    else if (weightedMargin >= target - 5) verdict = '조건부 진행'
  }
  return { mixTotal, revenue, optionProfit, eventProfit, weightedMargin, perOrderProfit, bep, verdict }
}

/* 신호등 (기능정의서 6장) */
function optionLight(margin, target) {
  const t = num(target)
  if (margin >= t) return { color: 'bg-emerald-500', text: 'text-emerald-600', label: '양호' }
  if (margin >= t * 0.7) return { color: 'bg-amber-400', text: 'text-amber-600', label: '주의' }
  return { color: 'bg-rose-500', text: 'text-rose-600', label: '미달' }
}
function verdictStyle(verdict) {
  if (verdict === '진행 가능') return 'bg-emerald-50 text-emerald-600 border-emerald-200'
  if (verdict === '조건부 진행') return 'bg-amber-50 text-amber-600 border-amber-200'
  return 'bg-rose-50 text-rose-600 border-rose-200'
}

/* ─────────────────────────── 서버 ↔ 편집모델 변환 ─────────────────────────── */

function fromServer(row) {
  return {
    id: row.id,
    brandName: row.brand_name || BRANDS[0],
    channelName: row.channel_name || '',
    title: row.title || '',
    startDate: String(row.start_date || '').slice(0, 10),
    endDate: String(row.end_date || '').slice(0, 10),
    promoType: row.promo_type || '할인',
    isAlwaysOn: !!row.is_always_on,
    status: row.status || '기획',
    feeRate: num(row.fee_rate),
    adRate: num(row.ad_rate),
    sgaRate: num(row.sga_rate),
    shippingCost: num(row.shipping_cost),
    fixedCost: num(row.fixed_cost),
    targetMarginRate: num(row.target_margin_rate) || 20,
    expectedOrders: num(row.expected_orders),
    blocks: (row.blocks || []).map((blk) => ({
      productCode: blk.product_code,
      productName: blk.product_name,
      options: (blk.options || []).map((opt) => ({
        optionName: opt.option_name,
        unitCost: num(opt.unit_cost),
        unitCostOverridden: !!opt.unit_cost_overridden,
        masterUnitCost: opt.master_unit_cost == null ? null : num(opt.master_unit_cost),
        listPrice: num(opt.list_price),
        benefit: { ...EMPTY_BENEFIT, ...(opt.benefit || {}) },
        mixRate: num(opt.mix_rate),
      })),
    })),
  }
}

function newEvent(defaults) {
  return {
    id: null,
    brandName: BRANDS[0],
    channelName: defaults?.channel_name || '스마트스토어',
    title: '',
    startDate: todayStr(),
    endDate: todayStr(),
    promoType: '할인',
    isAlwaysOn: false,
    status: '기획',
    feeRate: num(defaults?.fee_rate),
    adRate: num(defaults?.ad_rate),
    sgaRate: num(defaults?.sga_rate),
    shippingCost: num(defaults?.shipping_cost),
    fixedCost: 0,
    targetMarginRate: 20,
    expectedOrders: 100,
    blocks: [],
  }
}

/* ─────────────────────────── 작은 UI 조각 ─────────────────────────── */

function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none'
const cellInputCls = 'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[13px] text-slate-800 hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-none'

function NumInput({ value, onChange, className = inputCls, align = 'text-right' }) {
  const [text, setText] = useState(comma(value))
  useEffect(() => { setText(comma(value)) }, [value])
  return (
    <input
      className={`${className} ${align}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(num(text))}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      inputMode="numeric"
    />
  )
}

/* ─────────────────────────── 혜택 팝오버 ─────────────────────────── */

function benefitSummary(benefit) {
  const b = { ...EMPTY_BENEFIT, ...(benefit || {}) }
  const parts = []
  if (b.discountType === 'rate' && num(b.discountValue) > 0) parts.push(`${num(b.discountValue)}% 할인`)
  if (b.discountType === 'amount' && num(b.discountValue) > 0) parts.push(`${comma(b.discountValue)}원 할인`)
  if (num(b.couponAmount) > 0) parts.push(`쿠폰 ${comma(b.couponAmount)}(${b.couponBearer === 'seller' ? '셀러' : '채널'})`)
  if (num(b.giftQty) > 0) parts.push(`증정 ${b.giftName || b.giftProductCode || ''} ${num(b.giftQty)}개`.trim())
  if (b.freeShipping) parts.push('무료배송')
  return parts.length ? parts.join(' · ') : '혜택 없음'
}

function BenefitPopover({ benefit, onChange, onClose }) {
  const b = { ...EMPTY_BENEFIT, ...(benefit || {}) }
  const set = (patch) => onChange({ ...b, ...patch })
  return (
    <div className="absolute right-0 top-7 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black text-slate-700">혜택 설정</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div className="space-y-2.5">
        <div>
          <p className="mb-1 text-[11px] font-bold text-slate-500">할인</p>
          <div className="flex gap-1.5">
            <select className={`${inputCls} h-8 flex-1 text-xs`} value={b.discountType}
              onChange={(e) => set({ discountType: e.target.value })}>
              <option value="none">없음</option>
              <option value="rate">정률(%)</option>
              <option value="amount">정액(원)</option>
            </select>
            {b.discountType !== 'none' && (
              <NumInput value={b.discountValue} onChange={(v) => set({ discountValue: v })}
                className={`${inputCls} h-8 w-24 text-xs`} />
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold text-slate-500">쿠폰</p>
          <div className="flex gap-1.5">
            <NumInput value={b.couponAmount} onChange={(v) => set({ couponAmount: v })}
              className={`${inputCls} h-8 flex-1 text-xs`} />
            <select className={`${inputCls} h-8 w-24 text-xs`} value={b.couponBearer}
              onChange={(e) => set({ couponBearer: e.target.value })}>
              <option value="seller">셀러 부담</option>
              <option value="channel">채널 부담</option>
            </select>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">채널 부담 쿠폰은 마진 계산에서 제외됩니다.</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold text-slate-500">증정품</p>
          <div className="flex gap-1.5">
            <input className={`${inputCls} h-8 flex-1 text-xs`} placeholder="증정품명"
              value={b.giftName} onChange={(e) => set({ giftName: e.target.value })} />
            <NumInput value={b.giftQty} onChange={(v) => set({ giftQty: v })}
              className={`${inputCls} h-8 w-14 text-xs`} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">개당 원가</span>
            <NumInput value={b.giftUnitCost} onChange={(v) => set({ giftUnitCost: v })}
              className={`${inputCls} h-8 flex-1 text-xs`} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={b.freeShipping}
            onChange={(e) => set({ freeShipping: e.target.checked })} />
          무료배송 (배송단가를 실원가에 가산)
        </label>
      </div>
    </div>
  )
}

/* ─────────────────────────── 상품 검색 모달 ─────────────────────────── */

function ProductPicker({ onPick, onClose }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const search = useCallback((keyword) => {
    setLoading(true)
    searchPromoProducts(keyword)
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(q), q ? 300 : 0)
    return () => clearTimeout(timer.current)
  }, [q, search])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">상품 선택</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <input autoFocus className={`${inputCls} mb-2`} placeholder="상품명 / SKU 검색"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">
          {loading && <p className="p-4 text-center text-xs text-slate-400">검색 중…</p>}
          {!loading && rows.length === 0 && <p className="p-4 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>}
          {!loading && rows.map((row) => (
            <button key={row.id} type="button" onClick={() => onPick(row)}
              className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-blue-50/60">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-slate-800">{row.product_name}</span>
                <span className="block text-[11px] text-slate-400">{row.product_code}</span>
              </span>
              <span className="ml-3 shrink-0 text-[12px] font-bold text-slate-500">
                원가 {num(row.unit_cost) > 0 ? won(row.unit_cost) : '미등록'}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">원가는 제품 원가 관리(마스터)에서 자동 참조됩니다.</p>
      </div>
    </div>
  )
}

/* ─────────────────────────── 옵션 행 ─────────────────────────── */

function OptionRow({ opt, ev, onChange, onRemove }) {
  const [benefitOpen, setBenefitOpen] = useState(false)
  const r = calcOption(opt, ev)
  const light = optionLight(r.margin, ev.targetMarginRate)
  const overridden = opt.unitCostOverridden

  const setUnitCost = (v) => {
    const master = opt.masterUnitCost
    onChange({ ...opt, unitCost: v, unitCostOverridden: master != null && v !== master })
  }

  return (
    <tr className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
      <td className="px-2 py-1.5">
        <input className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] text-slate-800 hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-none"
          value={opt.optionName} placeholder="옵션명"
          onChange={(e) => onChange({ ...opt, optionName: e.target.value })} />
      </td>
      <td className="px-2 py-1.5"><NumInput value={opt.listPrice} onChange={(v) => onChange({ ...opt, listPrice: v })} className={cellInputCls} align="" /></td>
      <td className="px-2 py-1.5">
        <div className="flex items-center justify-end gap-1">
          {overridden && (
            <button type="button" title={`마스터 원가 ${won(opt.masterUnitCost)} — 클릭 시 되돌리기`}
              onClick={() => onChange({ ...opt, unitCost: num(opt.masterUnitCost), unitCostOverridden: false })}
              className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />
          )}
          <NumInput value={opt.unitCost} onChange={setUnitCost} className={cellInputCls} align="" />
        </div>
      </td>
      <td className="relative px-2 py-1.5">
        <button type="button" onClick={() => setBenefitOpen((v) => !v)}
          className={`w-full truncate rounded px-1.5 py-1 text-left text-[12px] ${benefitSummary(opt.benefit) === '혜택 없음' ? 'text-slate-400' : 'bg-blue-50/70 font-bold text-blue-600'} hover:bg-blue-50`}>
          {benefitSummary(opt.benefit)}
        </button>
        {benefitOpen && (
          <BenefitPopover benefit={opt.benefit}
            onChange={(b) => onChange({ ...opt, benefit: b })}
            onClose={() => setBenefitOpen(false)} />
        )}
      </td>
      <td className="px-2 py-1.5 text-right text-[13px] font-bold text-slate-800">{comma(r.netPrice)}</td>
      <td className="px-2 py-1.5 text-right text-[13px] text-slate-500">{comma(r.netCost)}</td>
      <td className="px-2 py-1.5 text-right text-[13px] text-slate-500">{comma(r.fee)}</td>
      <td className="px-2 py-1.5 text-right text-[13px] text-slate-600">{comma(r.contribution)}</td>
      <td className={`px-2 py-1.5 text-right text-[13px] font-bold ${r.profit >= 0 ? 'text-slate-800' : 'text-rose-500'}`}>{comma(r.profit)}</td>
      <td className="px-2 py-1.5">
        <span className={`flex items-center justify-end gap-1.5 text-[13px] font-black ${light.text}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${light.color}`} />
          {pct1(r.margin)}
        </span>
      </td>
      <td className="px-2 py-1.5"><NumInput value={opt.mixRate} onChange={(v) => onChange({ ...opt, mixRate: v })} className={cellInputCls} align="" /></td>
      <td className="px-1 py-1.5 text-center">
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-500">
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </td>
    </tr>
  )
}

/* ─────────────────────────── 상품 블록 ─────────────────────────── */

function BlockCard({ block, ev, onChange, onRemove }) {
  const setOption = (idx, opt) => {
    const options = block.options.map((o, i) => (i === idx ? opt : o))
    onChange({ ...block, options })
  }
  const addOption = () => onChange({
    ...block,
    options: [...block.options, {
      optionName: '', unitCost: block.options[0]?.masterUnitCost ?? 0,
      unitCostOverridden: false, masterUnitCost: block.options[0]?.masterUnitCost ?? null,
      listPrice: 0, benefit: { ...EMPTY_BENEFIT }, mixRate: 0,
    }],
  })
  const removeOption = (idx) => onChange({ ...block, options: block.options.filter((_, i) => i !== idx) })

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500">inventory_2</span>
          <p className="text-[13px] font-black text-slate-800">{block.productName || block.productCode}</p>
          <span className="text-[11px] text-slate-400">{block.productCode}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-500">
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] table-fixed">
          <colgroup>
            <col className="w-40" /><col className="w-20" /><col className="w-24" /><col className="w-44" />
            <col className="w-20" /><col className="w-20" /><col className="w-20" /><col className="w-20" />
            <col className="w-20" /><col className="w-24" /><col className="w-16" /><col className="w-8" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
              <th className="px-2 py-1.5 text-left">옵션</th>
              <th className="px-2 py-1.5 text-right">정상가</th>
              <th className="px-2 py-1.5 text-right">원가</th>
              <th className="px-2 py-1.5 text-left">혜택</th>
              <th className="px-2 py-1.5 text-right">판매가</th>
              <th className="px-2 py-1.5 text-right">실원가</th>
              <th className="px-2 py-1.5 text-right">수수료</th>
              <th className="px-2 py-1.5 text-right">공헌이익</th>
              <th className="px-2 py-1.5 text-right">영업이익</th>
              <th className="px-2 py-1.5 text-right">마진율</th>
              <th className="px-2 py-1.5 text-right">믹스%</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {block.options.map((opt, idx) => (
              <OptionRow key={idx} opt={opt} ev={ev}
                onChange={(o) => setOption(idx, o)} onRemove={() => removeOption(idx)} />
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addOption}
        className="flex w-full items-center gap-1 rounded-b-xl border-t border-slate-100 px-3 py-1.5 text-[12px] font-bold text-blue-500 hover:bg-blue-50/50">
        <span className="material-symbols-outlined text-[16px]">add</span> 옵션 추가
      </button>
    </div>
  )
}

/* ─────────────────────────── 행사 편집기 ─────────────────────────── */

function EventEditor({ initial, channelDefaults, onSaved, onCancel }) {
  const [ev, setEv] = useState(initial)
  const [costOpen, setCostOpen] = useState(!initial.id)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [realtime, setRealtime] = useState(null)
  const costTouched = useRef(!!initial.id)

  const set = (patch) => setEv((prev) => ({ ...prev, ...patch }))
  const summary = useMemo(() => calcEvent(ev), [ev])
  const mixOk = Math.abs(summary.mixTotal - 100) < 0.01
  const hasOptions = (ev.blocks || []).some((b) => (b.options || []).length > 0)

  useEffect(() => {
    if (!initial.id) return
    getPromoRealtime(initial.id).then(setRealtime).catch(() => setRealtime(null))
  }, [initial.id])

  const applyChannelDefault = (channelName) => {
    const d = channelDefaults.find((c) => c.channel_name === channelName)
    if (!d) { set({ channelName }); return }
    set({
      channelName,
      feeRate: num(d.fee_rate), adRate: num(d.ad_rate),
      sgaRate: num(d.sga_rate), shippingCost: num(d.shipping_cost),
    })
    costTouched.current = false
  }

  const onChannelChange = (channelName) => {
    if (!costTouched.current) applyChannelDefault(channelName)
    else set({ channelName })
  }

  const addBlock = (product) => {
    const cost = num(product.unit_cost)
    set({
      blocks: [...ev.blocks, {
        productCode: product.product_code,
        productName: product.product_name,
        options: [{
          optionName: '기본', unitCost: cost, unitCostOverridden: false,
          masterUnitCost: cost, listPrice: 0, benefit: { ...EMPTY_BENEFIT }, mixRate: 0,
        }],
      }],
    })
    setPickerOpen(false)
  }

  const save = async (statusOverride) => {
    setError('')
    if (!ev.title.trim()) { setError('행사명을 입력해 주세요.'); return }
    if (statusOverride === '진행중' && !mixOk) {
      setError(`행사 확정은 옵션 믹스 합계가 100%여야 합니다. (현재 ${pct1(summary.mixTotal)})`)
      return
    }
    setSaving(true)
    try {
      const payload = { ...ev, status: statusOverride || ev.status }
      const res = ev.id ? await updatePromoEvent(ev.id, payload) : await createPromoEvent(payload)
      if (res && res.success === false) throw new Error(res.message || '저장 실패')
      onSaved()
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* C. 행사 헤더 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">행사 기본 정보</p>
          <span className={`rounded px-2 py-0.5 text-[11px] font-black ${STATUS_STYLE[ev.status] || STATUS_STYLE['기획']}`}>{ev.status}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="브랜드">
            <select className={inputCls} value={ev.brandName} onChange={(e) => set({ brandName: e.target.value })}>
              {BRANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="채널">
            <select className={inputCls} value={ev.channelName} onChange={(e) => onChannelChange(e.target.value)}>
              {channelDefaults.map((c) => <option key={c.channel_name}>{c.channel_name}</option>)}
              {!channelDefaults.some((c) => c.channel_name === ev.channelName) && ev.channelName && <option>{ev.channelName}</option>}
            </select>
          </Field>
          <Field label="행사명" className="col-span-2">
            <input className={inputCls} placeholder="예) 9월 슈퍼세일 하이프리 기획전"
              value={ev.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="시작일">
            <input type="date" className={inputCls} value={ev.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="종료일">
            <input type="date" className={inputCls} value={ev.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </Field>
          <Field label="행사 유형">
            <select className={inputCls} value={ev.promoType} onChange={(e) => set({ promoType: e.target.value })}>
              {PROMO_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="예상 총주문수">
            <NumInput value={ev.expectedOrders} onChange={(v) => set({ expectedOrders: v })} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={ev.isAlwaysOn} onChange={(e) => set({ isAlwaysOn: e.target.checked })} />
          상시 운영 (기간 종료 없이 계속 노출)
        </label>
      </div>

      {/* D. 비용 조건 */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button type="button" onClick={() => setCostOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-800">비용 조건</p>
            <span className="text-[11px] text-slate-400">
              수수료 {pct1(ev.feeRate)} · 광고 {pct1(ev.adRate)} · 판관 {pct1(ev.sgaRate)} · 배송 {won(ev.shippingCost)} · 고정비 {won(ev.fixedCost)}
            </span>
          </div>
          <span className="material-symbols-outlined text-[20px] text-slate-400">{costOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {costOpen && (
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6" onInput={() => { costTouched.current = true }}>
              <Field label="수수료율 (%)"><NumInput value={ev.feeRate} onChange={(v) => set({ feeRate: v })} /></Field>
              <Field label="광고비율 (%)"><NumInput value={ev.adRate} onChange={(v) => set({ adRate: v })} /></Field>
              <Field label="판관비율 (%)"><NumInput value={ev.sgaRate} onChange={(v) => set({ sgaRate: v })} /></Field>
              <Field label="배송단가 (원)"><NumInput value={ev.shippingCost} onChange={(v) => set({ shippingCost: v })} /></Field>
              <Field label="행사 고정비 (원)"><NumInput value={ev.fixedCost} onChange={(v) => set({ fixedCost: v })} /></Field>
              <Field label="목표 마진율 (%)"><NumInput value={ev.targetMarginRate} onChange={(v) => set({ targetMarginRate: v })} /></Field>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">채널을 바꾸면 해당 채널 기본값이 자동 적용됩니다. (수정한 뒤에는 유지)</p>
              <button type="button" onClick={() => applyChannelDefault(ev.channelName)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
                채널 기본값 다시 불러오기
              </button>
            </div>
            {num(ev.fixedCost) === 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-600">
                행사 고정비가 0원입니다. 사은품 제작비·촬영비·입점비 등 고정 지출이 있다면 입력해 주세요.
              </p>
            )}
          </div>
        )}
      </div>

      {/* E. 상품 블록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">행사 상품 <span className="text-slate-400">({ev.blocks.length})</span></p>
          <button type="button" onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-600">
            <span className="material-symbols-outlined text-[16px]">add</span> 상품 추가
          </button>
        </div>
        {ev.blocks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
            상품을 추가하면 옵션별 마진이 자동 계산됩니다.
          </div>
        )}
        {ev.blocks.map((block, idx) => (
          <BlockCard key={idx} block={block} ev={ev}
            onChange={(b) => set({ blocks: ev.blocks.map((x, i) => (i === idx ? b : x)) })}
            onRemove={() => set({ blocks: ev.blocks.filter((_, i) => i !== idx) })} />
        ))}
        {hasOptions && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold ${mixOk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            <span className="material-symbols-outlined text-[16px]">{mixOk ? 'check_circle' : 'error'}</span>
            옵션 믹스 합계 {pct1(summary.mixTotal)} {mixOk ? '— 정상' : '— 100%가 되어야 행사를 확정할 수 있습니다'}
          </div>
        )}
      </div>

      {/* F. 행사 합산 판단 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-slate-800">행사 합산 판단</p>
          <span className={`rounded-lg border px-3 py-1 text-[13px] font-black ${verdictStyle(summary.verdict)}`}>
            {summary.verdict}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">예상 매출</p>
            <p className="mt-1 text-lg font-black text-slate-900">{won(summary.revenue)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">행사 영업이익 (고정비 차감)</p>
            <p className={`mt-1 text-lg font-black ${summary.eventProfit >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>{won(summary.eventProfit)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">가중평균 마진율 (목표 {pct1(ev.targetMarginRate)})</p>
            <p className={`mt-1 text-lg font-black ${optionLight(summary.weightedMargin, ev.targetMarginRate).text}`}>{pct1(summary.weightedMargin)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">손익분기 주문수 (BEP)</p>
            <p className="mt-1 text-lg font-black text-slate-900">{summary.bep != null ? `${comma(summary.bep)}건` : '-'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">실시간 매출 (행사 기간)</p>
            {realtime ? (
              <p className="mt-1 text-lg font-black text-blue-600">{won(realtime.salesAmount)} <span className="text-[11px] font-bold text-slate-400">/ {comma(realtime.orderCount)}건</span></p>
            ) : (
              <p className="mt-1 text-[12px] font-bold text-slate-400">{ev.id ? '조회 중…' : '저장 후 조회됩니다'}</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-500">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pb-6">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">
          목록으로
        </button>
        <button type="button" disabled={saving} onClick={() => save()}
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-600 hover:bg-blue-100 disabled:opacity-50">
          {saving ? '저장 중…' : '임시 저장'}
        </button>
        {ev.status === '기획' && (
          <button type="button" disabled={saving} onClick={() => save('진행중')}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white hover:bg-blue-600 disabled:opacity-50">
            행사 확정 (진행중 전환)
          </button>
        )}
      </div>

      {pickerOpen && <ProductPicker onPick={addBlock} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

/* ─────────────────────────── 행사 목록 ─────────────────────────── */

function EventList({ events, loading, onEdit, onDelete, onStatus }) {
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center text-sm text-slate-400">
        이 달에 등록된 행사가 없습니다. 우측 상단 [새 행사 만들기]로 시작하세요.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
            <th className="px-3 py-2.5 text-left">행사명</th>
            <th className="px-3 py-2.5 text-left">브랜드</th>
            <th className="px-3 py-2.5 text-left">채널</th>
            <th className="px-3 py-2.5 text-left">기간</th>
            <th className="px-3 py-2.5 text-right">예상매출</th>
            <th className="px-3 py-2.5 text-right">가중평균 마진</th>
            <th className="px-3 py-2.5 text-center">판단</th>
            <th className="px-3 py-2.5 text-center">상태</th>
            <th className="px-2 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {events.map((row) => {
            const ev = fromServer(row)
            const s = calcEvent(ev)
            return (
              <tr key={row.id} className="cursor-pointer border-b border-slate-50 last:border-b-0 hover:bg-blue-50/40"
                onClick={() => onEdit(row.id)}>
                <td className="px-3 py-2.5">
                  <p className="text-[13px] font-black text-slate-800">{ev.title}</p>
                  {ev.isAlwaysOn && <span className="text-[10px] font-bold text-slate-400">상시</span>}
                </td>
                <td className="px-3 py-2.5 text-[13px] text-slate-600">{ev.brandName}</td>
                <td className="px-3 py-2.5 text-[13px] text-slate-600">{ev.channelName}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-500">{ev.startDate.slice(5)} ~ {ev.endDate.slice(5)}</td>
                <td className="px-3 py-2.5 text-right text-[13px] font-bold text-slate-800">{won(s.revenue)}</td>
                <td className={`px-3 py-2.5 text-right text-[13px] font-black ${optionLight(s.weightedMargin, ev.targetMarginRate).text}`}>
                  {s.revenue > 0 ? pct1(s.weightedMargin) : '-'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {s.revenue > 0 && (
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-black ${verdictStyle(s.verdict)}`}>{s.verdict}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <select value={ev.status} onChange={(e) => onStatus(row.id, e.target.value)}
                    className={`rounded px-1.5 py-1 text-[11px] font-black ${STATUS_STYLE[ev.status]} border-0 focus:outline-none`}>
                    {STATUS_LIST.map((st) => <option key={st}>{st}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => onDelete(row.id)} className="text-slate-300 hover:text-rose-500">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────────────────────── 타임라인 · 상태 보드 ─────────────────────────── */

const BAR_STYLE = {
  기획: 'bg-slate-400/90',
  진행중: 'bg-blue-500',
  종료: 'bg-emerald-500',
  취소: 'bg-rose-400',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const parseDate = (s) => {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
const dayDiff = (a, b) => Math.round((b - a) / 86400000)

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function PromoTimelineSection({ month, events, onEdit, onMonthChange }) {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd = new Date(y, m - 1, daysInMonth)
  const today = parseDate(todayStr())
  const todayIdx = today >= monthStart && today <= monthEnd ? today.getDate() - 1 : null

  const rows = (events || []).map((row) => {
    const ev = fromServer(row)
    const start = parseDate(ev.startDate)
    const end = ev.isAlwaysOn ? monthEnd : parseDate(ev.endDate)
    if (!start && !ev.isAlwaysOn) return null
    const s = ev.isAlwaysOn && (!start || start < monthStart) ? monthStart : start
    const e = end || s
    if (e < monthStart || s > monthEnd) return null
    const clampS = s < monthStart ? monthStart : s
    const clampE = e > monthEnd ? monthEnd : e
    return {
      id: row.id,
      ev,
      startIdx: clampS.getDate() - 1,
      span: dayDiff(clampS, clampE) + 1,
      cutLeft: s < monthStart,
      cutRight: e > monthEnd || ev.isAlwaysOn,
    }
  }).filter(Boolean)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-black text-slate-800">행사 타임라인</h2>
          <div className="flex items-center rounded-lg border border-slate-200">
            <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))}
              className="flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="px-1 text-[12px] font-black text-slate-700">{y}년 {m}월</span>
            <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))}
              className="flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
          <button type="button" onClick={() => onMonthChange(thisMonth())}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-50">
            오늘
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
          {STATUS_LIST.map((st) => (
            <span key={st} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${BAR_STYLE[st]}`} /> {st}
            </span>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] font-bold text-slate-400">이 달에 걸치는 행사가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            {/* 날짜 헤더 */}
            <div className="grid" style={{ gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(0, 1fr))` }}>
              <div />
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dow = new Date(y, m - 1, i + 1).getDay()
                return (
                  <div key={i} className="border-l border-slate-100 pb-1 text-center text-[10px] font-bold">
                    <p className={i === todayIdx
                      ? 'mx-auto flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white'
                      : dow === 0 ? 'text-rose-300' : dow === 6 ? 'text-sky-300' : 'text-slate-400'}>{i + 1}</p>
                    <p className={`text-[9px] ${i === todayIdx ? 'text-rose-500' : dow === 0 ? 'text-rose-300' : dow === 6 ? 'text-sky-300' : 'text-slate-400'}`}>{DOW[dow]}</p>
                  </div>
                )
              })}
            </div>
            {/* 행사 행 */}
            <div className="relative">
              {todayIdx != null && (
                <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-rose-500"
                  style={{ left: `calc(150px + (100% - 150px) / ${daysInMonth} * ${todayIdx + 0.5})` }} />
              )}
              {rows.map(({ id, ev, startIdx, span, cutLeft, cutRight }) => (
                <div key={id} className="grid items-center border-t border-slate-50"
                  style={{ gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(0, 1fr))`, minHeight: 36 }}>
                  <button type="button" onClick={() => onEdit(id)}
                    className="truncate pr-2 text-left text-[12px] font-black text-slate-700 hover:text-blue-600">
                    {ev.title || '(제목 없음)'}
                    <span className="ml-1 text-[10px] font-bold text-slate-400">{ev.channelName}</span>
                  </button>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dow = new Date(y, m - 1, i + 1).getDay()
                    return <div key={i} className={`h-full border-l border-slate-100 ${dow === 0 || dow === 6 ? 'bg-slate-50/60' : ''}`} />
                  })}
                  <button type="button" onClick={() => onEdit(id)}
                    className={`z-[5] h-5 truncate px-1.5 text-left text-[10px] font-black leading-5 text-white hover:opacity-90 ${BAR_STYLE[ev.status] || BAR_STYLE['기획']} ${cutLeft ? '' : 'rounded-l-full'} ${cutRight ? '' : 'rounded-r-full'}`}
                    style={{ gridColumn: `${startIdx + 2} / span ${span}`, gridRow: 1 }}
                    title={`${ev.title} (${ev.startDate} ~ ${ev.isAlwaysOn ? '상시' : ev.endDate})`}>
                    {span >= 3 ? ev.title : ''}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PromoStatusBoard({ events, onEdit }) {
  const today = parseDate(todayStr())
  const groups = useMemo(() => {
    const g = Object.fromEntries(STATUS_LIST.map((st) => [st, []]))
    ;(events || []).forEach((row) => {
      const ev = fromServer(row)
      ;(g[ev.status] || g['기획']).push({ row, ev, calc: calcEvent(ev) })
    })
    return g
  }, [events])

  const dday = (ev) => {
    const start = parseDate(ev.startDate)
    const end = parseDate(ev.endDate)
    if (ev.status === '기획' && start) {
      const d = dayDiff(today, start)
      if (d > 0) return { label: `시작 D-${d}`, cls: 'bg-slate-100 text-slate-500' }
      if (d <= 0) return { label: '시작일 지남', cls: 'bg-amber-50 text-amber-600' }
    }
    if (ev.status === '진행중') {
      if (ev.isAlwaysOn) return { label: '상시 운영', cls: 'bg-blue-50 text-blue-500' }
      if (end) {
        const d = dayDiff(today, end)
        if (d < 0) return { label: '종료일 지남', cls: 'bg-amber-50 text-amber-600' }
        return { label: d === 0 ? '오늘 종료' : `종료 D-${d}`, cls: d <= 2 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500' }
      }
    }
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-[14px] font-black text-slate-800">행사 상태 보드</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_LIST.map((st) => {
          const tint = {
            기획: { col: 'bg-slate-50/80', card: 'border-slate-200 bg-white' },
            진행중: { col: 'bg-blue-50/60', card: 'border-blue-100 bg-blue-50/40' },
            종료: { col: 'bg-emerald-50/60', card: 'border-emerald-100 bg-emerald-50/40' },
            취소: { col: 'bg-rose-50/50', card: 'border-rose-100 bg-rose-50/30' },
          }[st]
          return (
            <div key={st} className={`rounded-lg p-2.5 ${tint.col}`}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`rounded px-2 py-0.5 text-[11px] font-black ${STATUS_STYLE[st]}`}>{st}</span>
                <span className="text-[11px] font-bold text-slate-400">{groups[st].length}건</span>
              </div>
              <div className="space-y-2">
                {groups[st].length === 0 && (
                  <p className="py-3 text-center text-[11px] font-bold text-slate-300">없음</p>
                )}
                {groups[st].map(({ row, ev, calc }) => {
                  const d = dday(ev)
                  const start = parseDate(ev.startDate)
                  const end = parseDate(ev.endDate)
                  const durationDays = ev.isAlwaysOn ? null : start && end ? dayDiff(start, end) + 1 : null
                  return (
                    <button key={row.id} type="button" onClick={() => onEdit(row.id)}
                      className={`block w-full rounded-lg border p-2.5 text-left hover:border-blue-300 hover:shadow-sm ${tint.card}`}>
                      <p className="truncate text-[12.5px] font-black text-slate-800">{ev.title || '(제목 없음)'}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-400">{ev.brandName} · {ev.channelName}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {ev.startDate?.slice(5)} ~ {ev.isAlwaysOn ? '상시' : ev.endDate?.slice(5)}
                        {durationDays != null && <span className="ml-1 text-slate-400">· {durationDays}일간</span>}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {d && <span className={`rounded px-1.5 py-0.5 text-[10px] font-black ${d.cls}`}>{d.label}</span>}
                        {calc.revenue > 0 && (
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${verdictStyle(calc.verdict)}`}>
                            {calc.verdict} · 마진 {pct1(calc.weightedMargin)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────── 메인 페이지 ─────────────────────────── */

export default function PromotionMarginPage() {
  const [month, setMonth] = useState(thisMonth())
  const [brand, setBrand] = useState('')
  const [channel, setChannel] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [channelDefaults, setChannelDefaults] = useState([])
  const [editing, setEditing] = useState(null)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    listPromoEvents({ month, ...(brand ? { brand } : {}), ...(channel ? { channel } : {}) })
      .then((data) => setEvents(data || []))
      .catch((e) => setLoadError(e?.response?.data?.message || '행사 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [month, brand, channel])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])
  useEffect(() => {
    getChannelDefaults().then((data) => setChannelDefaults(data || [])).catch(() => setChannelDefaults([]))
  }, [])

  const openNew = () => {
    const d = channelDefaults.find((c) => c.channel_name === '스마트스토어') || channelDefaults[0]
    setEditing(newEvent(d))
  }
  const openEdit = (id) => {
    getPromoEvent(id).then((row) => setEditing(fromServer(row))).catch(() => {})
  }
  const remove = (id) => {
    if (!window.confirm('이 행사를 삭제할까요? 되돌릴 수 없습니다.')) return
    deletePromoEvent(id).then(load).catch(() => {})
  }
  const changeStatus = (id, status) => {
    updatePromoStatus(id, status).then(load).catch(() => {})
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">프로모션 마진 · 행사 설계</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            채널 조건과 옵션 혜택을 입력하면 마진과 진행 가능 여부가 자동 계산됩니다. (모든 금액 세전 기준)
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={openNew}
            className="flex items-center gap-1 rounded-lg bg-blue-500 px-3.5 py-2 text-sm font-black text-white hover:bg-blue-600">
            <span className="material-symbols-outlined text-[18px]">add</span> 새 행사 만들기
          </button>
        )}
      </div>

      {editing ? (
        <EventEditor
          initial={editing}
          channelDefaults={channelDefaults}
          onSaved={() => { setEditing(null); load() }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
            <select className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">전체 브랜드</option>
              {BRANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">전체 채널</option>
              {channelDefaults.map((c) => <option key={c.channel_name}>{c.channel_name}</option>)}
            </select>
          </div>
          {loadError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-500">{loadError}</div>}
          <EventList events={events} loading={loading}
            onEdit={openEdit} onDelete={remove} onStatus={changeStatus} />
          {!loading && (
            <>
              <PromoTimelineSection month={month} events={events} onEdit={openEdit} onMonthChange={setMonth} />
              <PromoStatusBoard events={events} onEdit={openEdit} />
            </>
          )}
        </>
      )}
    </div>
  )
}
