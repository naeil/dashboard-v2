import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import {
  getSettlementSummary,
  getSettlementDepositCalendar,
  getSettlementRealtimeSales,
  getSettlementChannelIntegrationStatus,
  getSettlementExpected,
} from '../../api/executiveApi'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://naeil-dashboard.onrender.com'
const api = axios.create({ baseURL: `${API_BASE}/api` })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dashboard_auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const fmt = (n) => `${Math.round(Number(n ?? 0)).toLocaleString('ko-KR')}원`
const today = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)
const nextNDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function calcSettlementDueDate(baseDate, cycleType, cycleValue) {
  if (!baseDate) return ''
  const d = new Date(baseDate)
  if (!isFinite(d)) return ''
  if (cycleType === 'D+N') {
    const n = parseInt(cycleValue) || 0
    d.setDate(d.getDate() + n)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (cycleType === 'WEEKLY') {
    const targetDay = parseInt(cycleValue) || 2
    while (d.getDay() !== targetDay) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (cycleType === 'MONTHLY') {
    d.setMonth(d.getMonth() + 1)
    d.setDate(parseInt(cycleValue) || 15)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (cycleType === 'MONTH_END') {
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const next = new Date(endOfMonth)
    next.setDate(next.getDate() + (parseInt(cycleValue) || 15))
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1)
    return next.toISOString().slice(0, 10)
  }
  return ''
}

const TYPE_LABELS = { B2C: 'B2C 온라인', B2B: 'B2B 오프라인', OVERSEAS: '해외' }
const TYPE_COLORS = { B2C: 'bg-blue-100 text-blue-700', B2B: 'bg-green-100 text-green-700', OVERSEAS: 'bg-purple-100 text-purple-700' }
const STATUS_COLORS = {
  PENDING: 'bg-orange-100 text-orange-700',
  DONE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  HOLD: 'bg-slate-100 text-slate-500',
}
const STATUS_LABELS = { PENDING: '정산 예정', DONE: '입금 완료', OVERDUE: '지연', HOLD: '보류' }

const DEFAULT_CHANNEL_RULES = [
  { id: 1, channel_name: '스마트스토어', settlement_type: 'B2C', base_type: '구매확정일', cycle_type: 'D+N', cycle_value: '1', fee_rate: 3.63, currency: 'KRW', memo: '네이버 스마트스토어 일반 정산' },
  { id: 2, channel_name: '스마트스토어(빠른정산)', settlement_type: 'B2C', base_type: '집화일', cycle_type: 'D+N', cycle_value: '1', fee_rate: 5.5, currency: 'KRW', memo: '빠른 정산 서비스' },
  { id: 3, channel_name: '쿠팡(주정산)', settlement_type: 'B2C', base_type: '구매확정일', cycle_type: 'WEEKLY', cycle_value: '2', fee_rate: 10.8, currency: 'KRW', memo: '쿠팡 주정산 - 매주 화요일' },
  { id: 4, channel_name: '쿠팡(월정산)', settlement_type: 'B2C', base_type: '구매확정일', cycle_type: 'MONTHLY', cycle_value: '15', fee_rate: 10.8, currency: 'KRW', memo: '쿠팡 월정산 - 익월 15일' },
  { id: 5, channel_name: '11번가', settlement_type: 'B2C', base_type: '구매확정일', cycle_type: 'D+N', cycle_value: '1', fee_rate: 12.0, currency: 'KRW', memo: '11번가 일반 정산' },
  { id: 6, channel_name: '카카오', settlement_type: 'B2C', base_type: '결제일', cycle_type: 'D+N', cycle_value: '3', fee_rate: 3.5, currency: 'KRW', memo: '카카오쇼핑 결제일+3일' },
  { id: 7, channel_name: '지마켓/옥션', settlement_type: 'B2C', base_type: '구매확정일', cycle_type: 'D+N', cycle_value: '7', fee_rate: 12.0, currency: 'KRW', memo: 'G마켓/옥션 정산' },
  { id: 8, channel_name: '자사몰', settlement_type: 'B2C', base_type: '결제일', cycle_type: 'D+N', cycle_value: '3', fee_rate: 0, currency: 'KRW', memo: '자사몰 PG사 정산' },
  { id: 9, channel_name: '도매거래처', settlement_type: 'B2B', base_type: '세금계산서 발행일', cycle_type: 'D+N', cycle_value: '30', fee_rate: 0, currency: 'KRW', memo: 'B2B 일반 외상' },
  { id: 10, channel_name: '해외바이어', settlement_type: 'OVERSEAS', base_type: '발주일', cycle_type: 'D+N', cycle_value: '30', fee_rate: 0, currency: 'USD', memo: '해외 수출 정산' },
]

const CYCLE_TYPE_LABELS = { 'D+N': 'D+N일', WEEKLY: '주정산(특정요일)', MONTHLY: '월정산(익월N일)', MONTH_END: '월말마감 후 익월N일', MANUAL: '수동' }
const BASE_TYPE_OPTIONS = ['구매확정일', '결제일', '주문일', '배송완료일', '집화일', '세금계산서 발행일', '발주일', '출고일']
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const fieldCls = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
const selectCls = fieldCls + ' cursor-pointer'

function Badge({ type }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${TYPE_COLORS[type] || 'bg-slate-100 text-slate-500'}`}>{TYPE_LABELS[type] || type}</span>
}
function StatusBadge({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-500'}`}>{STATUS_LABELS[status] || status}</span>
}
function SummaryCard({ label, value, sub, color = 'text-slate-950' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-bold text-slate-400">{sub}</p>}
    </div>
  )
}

function ChannelIntegrationStatus({ integrationStatus }) {
  if (!integrationStatus || integrationStatus.length === 0) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-black text-amber-800 flex items-center gap-2">
        <span className="material-symbols-outlined text-base">warning</span>채널별 API 연동 현황
      </p>
      <div className="flex flex-wrap gap-2">
        {integrationStatus.map((ch, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${ch.has_credentials ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${ch.has_credentials ? 'bg-green-500' : 'bg-slate-300'}`} />
            {ch.channel_name}
            <span className="opacity-70">{ch.has_credentials ? '연동됨' : '연동 필요'}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-amber-700">💡 채널 계정 관리 메뉴에서 API 키를 등록하면 실시간 매출 데이터를 자동 수집합니다.</p>
    </div>
  )
}

function DepositCalendarSection() {
  const [calendarData, setCalendarData] = useState([])
  const [calLoading, setCalLoading] = useState(false)
  const [calChannel, setCalChannel] = useState('')
  const [calMonth, setCalMonth] = useState(() => new Date().toISOString().slice(0, 7))

  useEffect(() => { loadCalendar() }, [calMonth, calChannel])

  async function loadCalendar() {
    setCalLoading(true)
    try {
      const startDate = calMonth + '-01'
      const end = new Date(calMonth + '-01')
      end.setMonth(end.getMonth() + 1); end.setDate(0)
      const endDate = end.toISOString().slice(0, 10)
      const res = await getSettlementDepositCalendar({ startDate, endDate, channel: calChannel || undefined })
      setCalendarData(Array.isArray(res.data) ? res.data : [])
    } catch { setCalendarData([]) }
    finally { setCalLoading(false) }
  }

  const calByDate = useMemo(() => {
    const map = {}
    calendarData.forEach(row => {
      const dt = row.date
      if (!dt) return
      if (!map[dt]) map[dt] = []
      map[dt].push(row)
    })
    return map
  }, [calendarData])

  const calDays = useMemo(() => {
    const [year, month] = calMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const days = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(`${calMonth}-${String(d).padStart(2,'0')}`)
    return days
  }, [calMonth])

  const todayStr = today()
  const DOW = ['일','월','화','수','목','금','토']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-slate-950">채널별 입금 예정 캘린더</h3>
        <div className="flex items-center gap-2">
          <input type="month" className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none" value={calMonth} onChange={e => setCalMonth(e.target.value)} />
          <select className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none" value={calChannel} onChange={e => setCalChannel(e.target.value)}>
            <option value="">전체 채널</option>
            {['스마트스토어','쿠팡(주정산)','쿠팡(월정산)','카카오','자사몰','도매거래처'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DOW.map(d => <div key={d} className={`text-center text-xs font-black py-1 ${d==='일'?'text-red-500':d==='토'?'text-blue-500':'text-slate-400'}`}>{d}</div>)}
        </div>
        {calLoading ? (
          <div className="flex h-48 items-center justify-center text-slate-400 font-bold text-sm">로딩 중…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((dayStr, idx) => {
              if (!dayStr) return <div key={`e${idx}`} className="h-16 rounded-lg" />
              const entries = calByDate[dayStr] || []
              const totExp = entries.reduce((a,b) => a + Number(b.expected_deposit_amount||0), 0)
              const totDone = entries.reduce((a,b) => a + Number(b.completed_deposit_amount||0), 0)
              const hasDelay = entries.some(e => Number(e.delayed_amount||0) > 0)
              const isToday = dayStr === todayStr
              const dow = new Date(dayStr).getDay()
              return (
                <div key={dayStr} className={`h-16 rounded-lg border p-1 text-xs relative ${isToday?'border-sky-400 bg-sky-50':'border-slate-100'} ${hasDelay?'border-red-200':''}`}>
                  <div className={`font-black text-xs ${dow===0?'text-red-500':dow===6?'text-blue-500':isToday?'text-sky-700':'text-slate-600'}`}>{dayStr.slice(-2)}</div>
                  {totExp > 0 && <div className="mt-0.5 font-bold text-sky-600 text-[10px] leading-tight truncate">{(totExp/10000).toFixed(0)}만</div>}
                  {totDone > 0 && <div className="font-bold text-green-600 text-[10px] leading-tight truncate">✓{(totDone/10000).toFixed(0)}만</div>}
                  {hasDelay && <div className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-400" />}
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><span className="h-3 w-3 rounded-sm bg-sky-50 border border-sky-400"/>오늘</span>
          <span className="flex items-center gap-1 text-xs font-bold text-sky-600">■ 예정(만원)</span>
          <span className="flex items-center gap-1 text-xs font-bold text-green-600">✓ 완료(만원)</span>
          <span className="flex items-center gap-1 text-xs font-bold text-red-500"><span className="h-2 w-2 rounded-full bg-red-400"/>지연</span>
        </div>
      </div>
    </div>
  )
}

const emptyForm = {
  partner_name: '', settlement_type: 'B2C', channel_name: '', brand_name: '', country: 'KR', manager: '',
  order_no: '', sale_date: today(), qty: '', supply_price: '', fee_rate: '0',
  shipping_fee: '0', discount_cost: '0', other_deductions: '0',
  settlement_base_type: '구매확정일', settlement_cycle: 'D+N', settlement_cycle_value: '1',
  settlement_base_date: '', settlement_due_date: '', status: 'PENDING', currency: 'KRW',
  bank_account: '', memo: '',
}

function calcExpected(form) {
  const supply = parseFloat(form.supply_price) || 0
  const vat = supply * 0.1
  const total = supply + vat
  const fee = total * ((parseFloat(form.fee_rate) || 0) / 100)
  const ship = parseFloat(form.shipping_fee) || 0
  const disc = parseFloat(form.discount_cost) || 0
  const other = parseFloat(form.other_deductions) || 0
  return Math.round(total - fee - ship - disc - other)
}

function SettlementFormModal({ initialData, channelRules, onClose, onSave }) {
  const [form, setForm] = useState(initialData
    ? { ...emptyForm, ...initialData, supply_price: String(initialData.supply_price||''), fee_rate: String(initialData.fee_rate||'0'), shipping_fee: String(initialData.shipping_fee||'0'), discount_cost: String(initialData.discount_cost||'0'), other_deductions: String(initialData.other_deductions||'0') }
    : { ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const expected = useMemo(() => calcExpected(form), [form])
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  function applyChannelRule(channelName) {
    const rule = channelRules.find(r => r.channel_name === channelName)
    if (rule) {
      setForm(p => ({ ...p, channel_name: channelName, settlement_type: rule.settlement_type||p.settlement_type, settlement_base_type: rule.base_type||p.settlement_base_type, settlement_cycle: rule.cycle_type||p.settlement_cycle, settlement_cycle_value: String(rule.cycle_value||'1'), fee_rate: String(rule.fee_rate||'0'), currency: rule.currency||'KRW' }))
    } else { setForm(p => ({ ...p, channel_name: channelName })) }
  }

  function handleBaseOrCycleChange(k, v) {
    setForm(p => {
      const updated = { ...p, [k]: v }
      const baseDate = updated.settlement_base_date || updated.sale_date
      if (baseDate) {
        const due = calcSettlementDueDate(baseDate, updated.settlement_cycle, updated.settlement_cycle_value)
        if (due) updated.settlement_due_date = due
      }
      return updated
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.partner_name) { setErr('거래처명은 필수입니다.'); return }
    if (!form.settlement_due_date) { setErr('정산 예정일은 필수입니다.'); return }
    setSaving(true); setErr('')
    try {
      const payload = { ...form, supply_price: parseFloat(form.supply_price)||0, fee_rate: parseFloat(form.fee_rate)||0, shipping_fee: parseFloat(form.shipping_fee)||0, discount_cost: parseFloat(form.discount_cost)||0, other_deductions: parseFloat(form.other_deductions)||0, expected_amount: expected }
      if (initialData?.id) { await api.put(`/executive/settlement-schedules/${initialData.id}`, payload) }
      else { await api.post('/executive/settlement-schedules', { ...payload, company_id: 1 }) }
      onSave()
    } catch (ex) { setErr(ex?.response?.data?.message || '저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  const channelOptions = ['', ...channelRules.map(r => r.channel_name)]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-black uppercase tracking-widest text-sky-600">{initialData ? '정산 내역 수정' : '신규 정산 내역 등록'}</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">{initialData ? '정산 내역 수정' : '거래처별 정산 예정 등록'}</h2>
        <p className="mb-6 mt-1 text-sm font-bold text-slate-400">채널 선택 시 정산 주기 설정이 자동 적용됩니다.</p>
        <form onSubmit={handleSubmit}>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-sky-600">📋 기본 정보</p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-600">거래처명 <span className="text-red-500">*</span></label><input className={fieldCls} value={form.partner_name} onChange={set('partner_name')} placeholder="예: 네이버, (주)미양식품" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">거래처 유형</label><select className={selectCls} value={form.settlement_type} onChange={set('settlement_type')}><option value="B2C">B2C 온라인</option><option value="B2B">B2B 오프라인</option><option value="OVERSEAS">해외</option></select></div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">채널명 <span className="text-sky-500 text-xs">(선택 시 자동 적용)</span></label>
              <select className={selectCls} value={form.channel_name} onChange={e => applyChannelRule(e.target.value)}>
                {channelOptions.map(c => <option key={c} value={c}>{c || '직접 입력'}</option>)}
              </select>
              {!channelRules.find(r => r.channel_name === form.channel_name) && <input className={`${fieldCls} mt-1`} value={form.channel_name} onChange={set('channel_name')} placeholder="채널명 직접 입력" />}
            </div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">브랜드명</label><input className={fieldCls} value={form.brand_name} onChange={set('brand_name')} placeholder="내일그룹" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">국가</label><select className={selectCls} value={form.country} onChange={set('country')}><option value="KR">🇰🇷 한국</option><option value="VN">🇻🇳 베트남</option><option value="MN">🇲🇳 몽골</option><option value="TW">🇹🇼 대만</option><option value="OTHER">기타</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">담당자</label><input className={fieldCls} value={form.manager} onChange={set('manager')} placeholder="담당자명" /></div>
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-sky-600">💰 매출 정보</p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-600">매출 발생일</label><input type="date" className={fieldCls} value={form.sale_date} onChange={e => handleBaseOrCycleChange('sale_date', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">주문번호</label><input className={fieldCls} value={form.order_no} onChange={set('order_no')} placeholder="주문번호" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">공급가 <span className="text-red-500">*</span></label><input type="number" className={fieldCls} value={form.supply_price} onChange={set('supply_price')} placeholder="0" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">수수료율 (%)</label><input type="number" step="0.1" className={fieldCls} value={form.fee_rate} onChange={set('fee_rate')} placeholder="0" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">배송비</label><input type="number" className={fieldCls} value={form.shipping_fee} onChange={set('shipping_fee')} placeholder="0" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">할인/쿠폰</label><input type="number" className={fieldCls} value={form.discount_cost} onChange={set('discount_cost')} placeholder="0" /></div>
            <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-bold text-green-700">자동 계산: 최종 정산 예상금액</p>
              <p className="mt-1 text-2xl font-black text-green-700">{fmt(expected)}</p>
              <p className="mt-1 text-xs text-slate-400">공급가+VAT-수수료-배송비-할인-기타</p>
            </div>
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-sky-600">📅 정산 주기</p>
          <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 기준일 타입</label><select className={selectCls} value={form.settlement_base_type} onChange={e => handleBaseOrCycleChange('settlement_base_type', e.target.value)}>{BASE_TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 방식</label><select className={selectCls} value={form.settlement_cycle} onChange={e => handleBaseOrCycleChange('settlement_cycle', e.target.value)}>{Object.entries(CYCLE_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">{form.settlement_cycle === 'D+N' ? 'D+N 일수' : form.settlement_cycle === 'WEEKLY' ? '요일(0=일,2=화)' : '익월 N일'}</label><input type="number" className={fieldCls} value={form.settlement_cycle_value} onChange={e => handleBaseOrCycleChange('settlement_cycle_value', e.target.value)} placeholder="1" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 기준일</label><input type="date" className={fieldCls} value={form.settlement_base_date} onChange={e => handleBaseOrCycleChange('settlement_base_date', e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 예정일 <span className="text-sky-500">(자동 계산)</span></label><input type="date" className={fieldCls} value={form.settlement_due_date} onChange={set('settlement_due_date')} /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">입금 상태</label><select className={selectCls} value={form.status} onChange={set('status')}><option value="PENDING">정산 예정</option><option value="DONE">입금 완료</option><option value="OVERDUE">지연</option><option value="HOLD">보류</option></select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">통화</label><select className={selectCls} value={form.currency} onChange={set('currency')}><option value="KRW">KRW (원)</option><option value="USD">USD</option><option value="VND">VND</option></select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">입금 계좌</label><input className={fieldCls} value={form.bank_account} onChange={set('bank_account')} placeholder="기업은행 123-456-789" /></div>
              <div className="col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">메모</label><input className={fieldCls} value={form.memo} onChange={set('memo')} placeholder="특이사항" /></div>
            </div>
          </div>
          {err && <p className="mb-4 text-sm font-bold text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50">취소</button>
            <button type="submit" disabled={saving} className="h-11 flex-1 rounded-xl bg-sky-500 text-sm font-black text-white hover:bg-sky-600 disabled:bg-slate-200">{saving ? '저장 중…' : initialData ? '수정 저장' : '정산 내역 등록'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChannelRulesTab({ rules, setRules }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  function getCycleDesc(rule) {
    if (rule.cycle_type === 'D+N') return `${rule.base_type} D+${rule.cycle_value}`
    if (rule.cycle_type === 'WEEKLY') return `매주 ${WEEKDAY_LABELS[parseInt(rule.cycle_value)]||'?'}요일`
    if (rule.cycle_type === 'MONTHLY') return `익월 ${rule.cycle_value}일`
    if (rule.cycle_type === 'MONTH_END') return `월말 마감 후 익월 ${rule.cycle_value}일`
    return '수동'
  }

  if (editing !== null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-black text-slate-950">{editing === 'new' ? '신규 채널 정산 규칙 추가' : '채널 정산 규칙 수정'}</h3>
          <button onClick={() => { setEditing(null); setForm({}) }} className="text-xs font-bold text-slate-500 hover:text-slate-700">취소</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="mb-1 block text-xs font-bold text-slate-600">채널명 <span className="text-red-500">*</span></label><input className={fieldCls} value={form.channel_name||''} onChange={set('channel_name')} placeholder="스마트스토어" /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">거래처 유형</label><select className={selectCls} value={form.settlement_type||'B2C'} onChange={set('settlement_type')}><option value="B2C">B2C 온라인</option><option value="B2B">B2B 오프라인</option><option value="OVERSEAS">해외</option></select></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 기준일 타입</label><select className={selectCls} value={form.base_type||'구매확정일'} onChange={set('base_type')}>{BASE_TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 방식</label><select className={selectCls} value={form.cycle_type||'D+N'} onChange={set('cycle_type')}>{Object.entries(CYCLE_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">{form.cycle_type === 'D+N' ? 'D+N 일수' : form.cycle_type === 'WEEKLY' ? '요일(0=일,2=화)' : '익월 N일'}</label><input type="number" className={fieldCls} value={form.cycle_value||''} onChange={set('cycle_value')} placeholder="1" /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">수수료율 (%)</label><input type="number" step="0.01" className={fieldCls} value={form.fee_rate??''} onChange={set('fee_rate')} placeholder="0" /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">통화</label><select className={selectCls} value={form.currency||'KRW'} onChange={set('currency')}><option value="KRW">KRW</option><option value="USD">USD</option><option value="VND">VND</option></select></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">메모</label><input className={fieldCls} value={form.memo||''} onChange={set('memo')} placeholder="간단한 설명" /></div>
        </div>
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
          <p className="text-xs font-bold text-sky-700">📌 정산 예정일 계산 미리보기</p>
          <p className="mt-1 text-sm font-black text-sky-800">{getCycleDesc({ ...form })}</p>
          <p className="text-xs text-slate-400 mt-1">오늘 기준: {calcSettlementDueDate(today(), form.cycle_type, form.cycle_value)}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={() => { setEditing(null); setForm({}) }} className="h-10 flex-1 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50">취소</button>
          <button onClick={() => {
            if (!form.channel_name) return alert('채널명을 입력하세요.')
            if (editing === 'new') { const newId = Math.max(...rules.map(r => r.id), 0) + 1; setRules([...rules, { ...form, id: newId, fee_rate: parseFloat(form.fee_rate)||0 }]) }
            else { setRules(rules.map(r => r.id === editing ? { ...form, id: editing, fee_rate: parseFloat(form.fee_rate)||0 } : r)) }
            setEditing(null); setForm({})
          }} className="h-10 flex-1 rounded-xl bg-sky-500 text-sm font-black text-white hover:bg-sky-600">저장</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-black text-slate-950">채널별 정산 주기 설정</h3><p className="mt-0.5 text-xs font-bold text-slate-400">정산 내역 등록 시 채널 선택하면 아래 설정이 자동 적용됩니다.</p></div>
        <button onClick={() => { setEditing('new'); setForm({ channel_name:'', settlement_type:'B2C', base_type:'구매확정일', cycle_type:'D+N', cycle_value:'1', fee_rate:'0', currency:'KRW', memo:'' }) }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-500"><span className="material-symbols-outlined text-base">add</span>채널 추가</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
              <tr>{['채널명','유형','기준일','정산 방식','계산 예시','수수료율','통화','메모','관리'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-slate-950">{r.channel_name}</td>
                  <td className="px-4 py-3"><Badge type={r.settlement_type} /></td>
                  <td className="px-4 py-3 text-slate-600">{r.base_type}</td>
                  <td className="px-4 py-3 text-slate-600">{CYCLE_TYPE_LABELS[r.cycle_type]||r.cycle_type}</td>
                  <td className="px-4 py-3 font-bold text-sky-700">{getCycleDesc(r)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.fee_rate}%</td>
                  <td className="px-4 py-3 text-slate-600">{r.currency}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.memo}</td>
                  <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => { setEditing(r.id); setForm({...r}) }} className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100">수정</button><button onClick={() => { if (!window.confirm('삭제?')) return; setRules(rules.filter(x => x.id !== r.id)) }} className="rounded bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">삭제</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ChannelSalesTab({ channelRules, onImport }) {
  const [loading, setLoading] = useState(false)
  const [sales, setSales] = useState([])
  const [realtimeSales, setRealtimeSales] = useState([])
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) })
  const [dateTo, setDateTo] = useState(today)
  const [selected, setSelected] = useState(new Set())
  const [activeSubTab, setActiveSubTab] = useState('realtime')
  const b2cChannels = channelRules.filter(r => r.settlement_type === 'B2C')

  async function fetchRealtimeSales() {
    setRealtimeLoading(true); setError('')
    try {
      const res = await getSettlementRealtimeSales({ channel: selectedChannel||undefined, startDate: dateFrom, endDate: dateTo })
      setRealtimeSales(Array.isArray(res.data) ? res.data : [])
    } catch (ex) { setRealtimeSales([]); setError('DB 매출 조회 실패: ' + (ex?.response?.data?.message||ex.message)) }
    finally { setRealtimeLoading(false) }
  }

  async function fetchSales() {
    if (!selectedChannel) { setError('채널을 선택하세요.'); return }
    setLoading(true); setError(''); setSales([])
    try {
      const res = await api.get('/channels/sales', { params: { channel: selectedChannel.replace(/[\(\)]/g,'').replace(/\s/g,'_').toLowerCase(), from: dateFrom, to: dateTo, companyId: 1 } })
      setSales(Array.isArray(res.data) ? res.data : (res.data?.data||[]))
    } catch (ex) {
      const status = ex?.response?.status
      if (status === 404 || status === 501) setError('API 미연동 채널입니다. DB 기반 조회를 이용하세요.')
      else if (status === 401 || status === 403) setError('채널 API 접근 권한이 없습니다.')
      else setError('채널 API 연동 필요 - 채널 계정 관리에서 API 키를 등록하세요.')
    } finally { setLoading(false) }
  }

  const realtimeSummary = useMemo(() => {
    const map = {}
    realtimeSales.forEach(row => {
      const ch = row.channel||'기타'
      if (!map[ch]) map[ch] = { channel:ch, order_count:0, gross_revenue:0, sales_quantity:0, expected_settlement_amount:0 }
      map[ch].order_count += Number(row.order_count||0)
      map[ch].gross_revenue += Number(row.gross_revenue||0)
      map[ch].sales_quantity += Number(row.sales_quantity||0)
      map[ch].expected_settlement_amount += Number(row.expected_settlement_amount||0)
    })
    return Object.values(map)
  }, [realtimeSales])

  return (
    <div className="space-y-5">
      <div><h3 className="font-black text-slate-950">온라인 채널 매출 현황 조회</h3><p className="mt-0.5 text-xs font-bold text-slate-400">채널별 실시간 매출 데이터와 정산 예정 금액을 조회합니다.</p></div>
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        <button onClick={() => setActiveSubTab('realtime')} className={`rounded-md px-4 py-2 text-sm font-black transition-all ${activeSubTab==='realtime'?'bg-white text-sky-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>DB 기반 실시간 매출</button>
        <button onClick={() => setActiveSubTab('api')} className={`rounded-md px-4 py-2 text-sm font-black transition-all ${activeSubTab==='api'?'bg-white text-sky-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>채널 API 직접 조회</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {b2cChannels.slice(0,4).map(r => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className={`h-3 w-3 rounded-full ${r.channel_name===selectedChannel?'bg-green-400':'bg-slate-200'}`} />
            <div><p className="text-sm font-black text-slate-950">{r.channel_name}</p><p className="text-xs font-bold text-slate-400">{r.cycle_type==='D+N'?`D+${r.cycle_value}`:r.cycle_type}</p></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div><label className="mb-1 block text-xs font-bold text-slate-600">채널 선택</label><select className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none" value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}><option value="">전체 채널</option>{b2cChannels.map(r => <option key={r.id} value={r.channel_name}>{r.channel_name}</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-bold text-slate-600">시작일</label><input type="date" className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs font-bold text-slate-600">종료일</label><input type="date" className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
        {activeSubTab === 'realtime' ? (
          <button onClick={fetchRealtimeSales} disabled={realtimeLoading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-500 disabled:bg-slate-300">{realtimeLoading?'조회 중…':<><span className="material-symbols-outlined text-base">database</span>DB 매출 조회</>}</button>
        ) : (
          <button onClick={fetchSales} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-500 disabled:bg-slate-300">{loading?'조회 중…':<><span className="material-symbols-outlined text-base">sync</span>채널 API 조회</>}</button>
        )}
      </div>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-start gap-2 text-sm font-bold text-amber-700"><span className="material-symbols-outlined text-base mt-0.5">warning</span>{error}</p><p className="mt-2 text-xs text-amber-600">💡 채널 API 연동이 없어도 DB 기반 조회로 내부 주문 데이터를 확인할 수 있습니다.</p></div>}
      {activeSubTab === 'realtime' && realtimeSales.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-black text-slate-950">채널별 매출 요약 ({realtimeSales.length}건 / DB 기준)</p>
          {realtimeSummary.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {realtimeSummary.map(ch => {
                const rule = channelRules.find(r => r.channel_name === ch.channel || ch.channel.includes(r.channel_name.split('(')[0]))
                const expectedDate = rule ? calcSettlementDueDate(today(), rule.cycle_type, rule.cycle_value) : '-'
                const statusBadge = rule ? `${rule.cycle_type === 'D+N' ? 'D+'+rule.cycle_value : rule.cycle_type}` : '-'
                return (
                  <div key={ch.channel} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-slate-400">{ch.channel}</p>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">{statusBadge}</span>
                    </div>
                    <p className="text-lg font-black text-slate-950">{fmt(ch.gross_revenue)}</p>
                    <div className="mt-2 space-y-1 text-xs font-bold text-slate-500">
                      <div className="flex justify-between"><span>주문수</span><span>{(ch.order_count||0).toLocaleString()}건</span></div>
                      <div className="flex justify-between"><span>판매수량</span><span>{(ch.sales_quantity||0).toLocaleString()}개</span></div>
                      <div className="flex justify-between text-sky-600"><span>정산 예정</span><span>{fmt(ch.expected_settlement_amount)}</span></div>
                      <div className="flex justify-between text-green-600"><span>예상 입금일</span><span>{expectedDate}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
                  <tr>{['채널','주문일','주문수','판매수량','총 매출','취소금액','할인금액','정산예정금액','상태'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {realtimeSales.slice(0,50).map((s,i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-sky-600">{s.channel||'-'}</td>
                      <td className="px-4 py-3 text-slate-600">{s.order_date||'-'}</td>
                      <td className="px-4 py-3 text-right">{(s.order_count||0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{(s.sales_quantity||0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(s.gross_revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{Number(s.cancel_amount)>0?fmt(s.cancel_amount):'-'}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{Number(s.discount_amount)>0?fmt(s.discount_amount):'-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(s.expected_settlement_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.settlement_status||'PENDING'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {activeSubTab === 'api' && sales.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-950">{sales.length}건 조회됨</p>
            {selected.size > 0 && <button onClick={() => {
              const rule = channelRules.find(r => r.channel_name === selectedChannel)
              const toImport = sales.filter(s => selected.has(s.id||s.order_no))
              const items = toImport.map(s => { const baseDate = s.purchase_confirmed_date||s.payment_date||s.order_date||today(); const dueDate = rule ? calcSettlementDueDate(baseDate, rule.cycle_type, rule.cycle_value) : ''; return { partner_name: selectedChannel, settlement_type: rule?.settlement_type||'B2C', channel_name: selectedChannel, brand_name: s.brand_name||'', country:'KR', manager:'', order_no: s.order_no||s.id||'', sale_date: s.order_date||today(), supply_price: s.supply_price||s.product_price||0, fee_rate: rule?.fee_rate||0, shipping_fee: s.shipping_fee||0, discount_cost: s.discount_amount||0, other_deductions:0, expected_amount: s.settlement_amount||s.expected_amount||0, settlement_base_type: rule?.base_type||'구매확정일', settlement_cycle: rule?.cycle_type||'D+N', settlement_cycle_value: String(rule?.cycle_value||'1'), settlement_base_date: baseDate, settlement_due_date: dueDate, status:'PENDING', currency: rule?.currency||'KRW', memo:'채널 API 자동 수집', company_id:1 } }); onImport(items)
            }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-black text-white hover:bg-green-500"><span className="material-symbols-outlined text-base">add_circle</span>{selected.size}건 정산 내역으로 가져오기</button>}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3"><input type="checkbox" onChange={() => { if (selected.size===sales.length) setSelected(new Set()); else setSelected(new Set(sales.map(s => s.id||s.order_no))) }} checked={selected.size===sales.length&&sales.length>0} /></th>{['주문번호','주문일','구매확정일','판매금액','수수료','정산예정금액','정산예정일'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{sales.map((s,i) => { const rule = channelRules.find(r => r.channel_name===selectedChannel); const baseDate = s.purchase_confirmed_date||s.payment_date||s.order_date||''; const dueDate = rule&&baseDate?calcSettlementDueDate(baseDate,rule.cycle_type,rule.cycle_value):'-'; const key = s.id||s.order_no||i; return <tr key={key} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3"><input type="checkbox" checked={selected.has(key)} onChange={() => { const s2 = new Set(selected); s2.has(key)?s2.delete(key):s2.add(key); setSelected(s2) }} /></td><td className="px-4 py-3 font-bold">{s.order_no||s.id||'-'}</td><td className="px-4 py-3 text-slate-600">{s.order_date||'-'}</td><td className="px-4 py-3 text-slate-600">{s.purchase_confirmed_date||'-'}</td><td className="px-4 py-3 text-right font-bold">{fmt(s.product_price||s.supply_price||0)}</td><td className="px-4 py-3 text-right">{fmt(s.commission_amount||0)}</td><td className="px-4 py-3 text-right font-bold text-green-700">{fmt(s.settlement_amount||s.expected_amount||0)}</td><td className="px-4 py-3 font-bold text-sky-700">{dueDate}</td></tr> })}</tbody></table></div></div>
        </div>
      )}
      {!loading&&!realtimeLoading&&!error&&sales.length===0&&realtimeSales.length===0&&<div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center"><span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span><p className="mt-3 text-sm font-bold text-slate-400">기간을 선택하고 조회 버튼을 눌러주세요.</p></div>}
    </div>
  )
}

export default function SettlementSchedulePage() {
  const [activeTab, setActiveTab] = useState('schedule')
  const [channelRules, setChannelRules] = useState(() => {
    try { const saved = localStorage.getItem('naeil_channel_rules'); return saved ? JSON.parse(saved) : DEFAULT_CHANNEL_RULES } catch { return DEFAULT_CHANNEL_RULES }
  })
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPartner, setFilterPartner] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [apiSummary, setApiSummary] = useState(null)
  const [apiSummaryLoading, setApiSummaryLoading] = useState(false)
  const [integrationStatus, setIntegrationStatus] = useState([])

  useEffect(() => {
    try { localStorage.setItem('naeil_channel_rules', JSON.stringify(channelRules)) } catch {}
  }, [channelRules])

  async function load() {
    setLoading(true)
    try { const res = await getSettlementExpected(); setItems(Array.isArray(res.data) ? res.data : (res.data?.data||[])) }
    catch { setItems([]) }
    finally { setLoading(false) }
  }

  async function loadApiSummary() {
    setApiSummaryLoading(true)
    try { const res = await getSettlementSummary(); setApiSummary(res.data) }
    catch { setApiSummary(null) }
    finally { setApiSummaryLoading(false) }
  }

  async function loadIntegrationStatus() {
    try { const res = await getSettlementChannelIntegrationStatus(); setIntegrationStatus(Array.isArray(res.data) ? res.data : []) }
    catch { setIntegrationStatus([]) }
  }

  useEffect(() => { load(); loadApiSummary(); loadIntegrationStatus() }, [])

  async function handleMarkDone(item) {
    const amt = window.prompt('실제 입금금액을 입력하세요:', String(item.expected_amount||0))
    if (amt === null) return
    await api.put(`/executive/settlement-schedules/${item.id}`, { ...item, status:'DONE', actual_amount: parseFloat(amt)||item.expected_amount, actual_pay_date: today() })
    load(); loadApiSummary()
  }
  async function handleMarkOverdue(item) {
    await api.put(`/executive/settlement-schedules/${item.id}`, { ...item, status:'OVERDUE' })
    load(); loadApiSummary()
  }
  async function handleDelete(id) {
    if (!window.confirm('삭제하시겠습니까?')) return
    await api.delete(`/executive/settlement-schedules/${id}`)
    load(); loadApiSummary()
  }
  async function handleImportFromChannel(importItems) {
    let successCount = 0
    for (const item of importItems) { try { await api.post('/executive/settlement-schedules', item); successCount++ } catch {} }
    alert(`${successCount}건이 정산 내역에 등록되었습니다.`); load(); loadApiSummary(); setActiveTab('schedule')
  }

  function exportCSV() {
    const header = ['거래처명','유형','채널','브랜드','매출발생일','정산예정일','입금예정금액','실제입금금액','차액','상태','담당자','메모']
    const rows = filteredItems.map(s => [s.partner_name,s.settlement_type,s.channel_name||'',s.brand_name||'',s.sale_date,s.settlement_due_date,s.expected_amount||0,s.actual_amount||'',s.actual_amount!=null?s.actual_amount-(s.expected_amount||0):'',STATUS_LABELS[s.status]||s.status,s.manager||'',s.memo||''])
    const csv = [header,...rows].map(r=>r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'})); a.download=`정산예정현황_${today()}.csv`; a.click()
  }

  const todayStr = today()
  const weekEnd = nextNDays(7)
  const monthPrefix = thisMonth()
  const filteredItems = useMemo(() => items.filter(s => {
    if (filterType && s.settlement_type !== filterType) return false
    if (filterStatus && s.status !== filterStatus) return false
    if (filterPartner && !(s.partner_name||'').toLowerCase().includes(filterPartner.toLowerCase()) && !(s.channel_name||'').toLowerCase().includes(filterPartner.toLowerCase())) return false
    if (filterFrom && (s.settlement_due_date||'') < filterFrom) return false
    if (filterTo && (s.settlement_due_date||'') > filterTo) return false
    return true
  }), [items, filterType, filterStatus, filterPartner, filterFrom, filterTo])

  const totalExpected = useMemo(() => items.filter(s=>s.status!=='DONE').reduce((a,b)=>a+(b.expected_amount||0),0), [items])
  const thisMonthAmt = useMemo(() => items.filter(s=>(s.settlement_due_date||'').startsWith(monthPrefix)&&s.status!=='DONE').reduce((a,b)=>a+(b.expected_amount||0),0), [items])
  const todayAmt = useMemo(() => items.filter(s=>s.settlement_due_date===todayStr&&s.status!=='DONE').reduce((a,b)=>a+(b.expected_amount||0),0), [items])
  const overdueAmt = useMemo(() => items.filter(s=>s.status==='OVERDUE').reduce((a,b)=>a+(b.expected_amount||0),0), [items])
  const doneAmt = useMemo(() => items.filter(s=>s.status==='DONE').reduce((a,b)=>a+(b.actual_amount||0),0), [items])
  const weekAmt = useMemo(() => items.filter(s=>s.settlement_due_date>=todayStr&&s.settlement_due_date<=weekEnd&&s.status!=='DONE').reduce((a,b)=>a+(b.expected_amount||0),0), [items])

  const summaryTodayAmt = apiSummary?.todayExpectedDeposit ?? todayAmt
  const summaryWeekAmt = apiSummary?.weeklyExpectedDeposit ?? weekAmt
  const summaryMonthAmt = apiSummary?.monthlyExpectedDeposit ?? thisMonthAmt
  const summaryOverdueAmt = apiSummary?.delayedSettlementRisk ?? overdueAmt
  const summaryTotalAmt = apiSummary?.totalExpectedSettlement ?? totalExpected
  const summaryDoneAmt = apiSummary?.completedDepositAmount ?? doneAmt
  const summaryCount = apiSummary?.settlementCount ?? items.length

  const TABS = [
    { id:'schedule', label:'정산 예정현황', icon:'payments' },
    { id:'channel-rules', label:'채널 정산 주기 설정', icon:'tune' },
    { id:'channel-sales', label:'채널 매출 조회', icon:'sync' },
    { id:'calendar', label:'입금 캘린더', icon:'calendar_month' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-sky-600">채널 · 판매 관리</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">거래처별 정산 예정현황</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">거래처별 매출 발생일과 정산 예정일, 입금 예정금액을 통합 관리하고 현금흐름에 자동 반영합니다.</p>
        </div>
        {activeTab === 'schedule' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setEditItem(null); setShowForm(true) }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-500"><span className="material-symbols-outlined text-base">add</span>신규 등록</button>
            <button onClick={exportCSV} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><span className="material-symbols-outlined text-base">download</span>엑셀 다운로드</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition-all ${activeTab===t.id?'bg-white text-sky-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-base">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {integrationStatus.length > 0 && <ChannelIntegrationStatus integrationStatus={integrationStatus} />}

      {activeTab === 'schedule' && (
        <>
          <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-green-50 p-5">
            <p className="mb-3 text-sm font-black text-sky-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">account_balance_wallet</span>
              현금흐름 연동 요약 {apiSummaryLoading && <span className="text-xs font-normal text-sky-600 ml-1">업데이트 중…</span>}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[['오늘 입금 예정', summaryTodayAmt],['이번 주 입금 예정', summaryWeekAmt],['이번 달 입금 예정', summaryMonthAmt],['지연 정산 (리스크)', summaryOverdueAmt,'text-red-600']].map(([label, val, color]) => (
                <div key={label} className="rounded-lg bg-white/70 p-3">
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className={`mt-1 text-lg font-black ${color||(val>0?'text-sky-700':'text-slate-400')}`}>{fmt(val)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="총 정산 예정" value={fmt(summaryTotalAmt)} sub="입금 완료 제외" color="text-sky-600" />
            <SummaryCard label="이번 달 입금 예정" value={fmt(summaryMonthAmt)} />
            <SummaryCard label="오늘 입금 예정" value={fmt(summaryTodayAmt)} />
            <SummaryCard label="지연 정산금액" value={fmt(summaryOverdueAmt)} color={summaryOverdueAmt>0?'text-red-600':'text-slate-950'} />
            <SummaryCard label="입금 완료금액" value={fmt(summaryDoneAmt)} color="text-green-600" />
            <SummaryCard label="등록 건수" value={`${summaryCount}건`} />
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-xs font-black text-slate-400">필터</span>
            <select className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">전체 유형</option><option value="B2C">B2C 온라인</option><option value="B2B">B2B 오프라인</option><option value="OVERSEAS">해외</option></select>
            <select className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">전체 상태</option><option value="PENDING">정산 예정</option><option value="DONE">입금 완료</option><option value="OVERDUE">지연</option><option value="HOLD">보류</option></select>
            <input className="h-9 w-40 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" placeholder="거래처/채널 검색" value={filterPartner} onChange={e=>setFilterPartner(e.target.value)} />
            <input type="date" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} />
            <span className="text-xs text-slate-300">~</span>
            <input type="date" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none" value={filterTo} onChange={e=>setFilterTo(e.target.value)} />
          </div>
          {loading ? (
            <div className="flex h-64 items-center justify-center text-slate-400 font-bold">불러오는 중…</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
                    <tr>{['거래처명','유형','채널','브랜드','매출 발생일','정산 예정일','입금 예정금액','실제 입금금액','차액','상태','담당자','메모','관리'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={13} className="py-16 text-center text-sm font-bold text-slate-400">등록된 정산 내역이 없습니다.</td></tr>
                    ) : filteredItems.map(s => {
                      const diff = s.actual_amount != null ? s.actual_amount - (s.expected_amount||0) : null
                      return (
                        <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-950">{s.partner_name}</td>
                          <td className="px-4 py-3"><Badge type={s.settlement_type} /></td>
                          <td className="px-4 py-3 font-bold text-sky-600">{s.channel_name||'-'}</td>
                          <td className="px-4 py-3 text-slate-600">{s.brand_name||'-'}</td>
                          <td className="px-4 py-3 text-slate-600">{s.sale_date}</td>
                          <td className="px-4 py-3 font-bold text-slate-950">{s.settlement_due_date}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-950">{fmt(s.expected_amount)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{s.actual_amount!=null?fmt(s.actual_amount):'-'}</td>
                          <td className={`px-4 py-3 text-right font-bold ${diff<0?'text-red-600':diff>0?'text-green-600':'text-slate-400'}`}>{diff!=null?(diff===0?'0원':(diff>0?'+':'')+fmt(diff)):'-'}</td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3 text-slate-600">{s.manager||'-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{s.memo||''}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditItem(s); setShowForm(true) }} className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100">수정</button>
                              {s.status !== 'DONE' && <button onClick={() => handleMarkDone(s)} className="rounded bg-green-50 px-2 py-1 text-xs font-bold text-green-600 hover:bg-green-100">완료</button>}
                              {s.status === 'PENDING' && <button onClick={() => handleMarkOverdue(s)} className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100">지연</button>}
                              <button onClick={() => handleDelete(s.id)} className="rounded bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">삭제</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'channel-rules' && <ChannelRulesTab rules={channelRules} setRules={setChannelRules} />}
      {activeTab === 'channel-sales' && <ChannelSalesTab channelRules={channelRules} onImport={handleImportFromChannel} />}
      {activeTab === 'calendar' && <DepositCalendarSection />}

      {showForm && (
        <SettlementFormModal
          initialData={editItem}
          channelRules={channelRules}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSave={() => { setShowForm(false); setEditItem(null); load(); loadApiSummary() }}
        />
      )}
    </div>
  )
}
