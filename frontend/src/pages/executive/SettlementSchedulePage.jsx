import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'

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

const TYPE_LABELS = { B2C: 'B2C 온라인', B2B: 'B2B 오프라인', OVERSEAS: '해외' }
const TYPE_COLORS = { B2C: 'bg-blue-100 text-blue-700', B2B: 'bg-green-100 text-green-700', OVERSEAS: 'bg-purple-100 text-purple-700' }
const STATUS_COLORS = {
  'PENDING': 'bg-orange-100 text-orange-700',
  'DONE': 'bg-green-100 text-green-700',
  'OVERDUE': 'bg-red-100 text-red-700',
  'HOLD': 'bg-slate-100 text-slate-500',
}
const STATUS_LABELS = { PENDING: '정산 예정', DONE: '입금 완료', OVERDUE: '지연', HOLD: '보류' }

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

const emptyForm = {
  partner_name: '', settlement_type: 'B2C', channel_name: '', brand_name: '', country: 'KR', manager: '',
  order_no: '', sale_date: today(), qty: '', supply_price: '', fee_rate: '0',
  shipping_fee: '0', discount_cost: '0', other_deductions: '0',
  settlement_base_type: '구매확정일', settlement_cycle: 'D+1',
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

function SettlementFormModal({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData ? { ...emptyForm, ...initialData, supply_price: String(initialData.supply_price || ''), fee_rate: String(initialData.fee_rate || '0'), shipping_fee: String(initialData.shipping_fee || '0'), discount_cost: String(initialData.discount_cost || '0'), other_deductions: String(initialData.other_deductions || '0') } : { ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const expected = useMemo(() => calcExpected(form), [form])
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.partner_name || !form.settlement_due_date) { setErr('거래처명과 정산 예정일은 필수입니다.'); return }
    setSaving(true); setErr('')
    try {
      const payload = { ...form, supply_price: parseFloat(form.supply_price) || 0, fee_rate: parseFloat(form.fee_rate) || 0, shipping_fee: parseFloat(form.shipping_fee) || 0, discount_cost: parseFloat(form.discount_cost) || 0, other_deductions: parseFloat(form.other_deductions) || 0, expected_amount: expected }
      if (initialData?.id) { await api.put(`/executive/settlement-schedules/${initialData.id}`, payload) }
      else { await api.post('/executive/settlement-schedules', { ...payload, company_id: 1 }) }
      onSave()
    } catch (ex) { setErr(ex?.response?.data?.message || '저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-black uppercase tracking-widest text-sky-600">{initialData ? '정산 내역 수정' : '신규 정산 내역 등록'}</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">{initialData ? '정산 내역 수정' : '거래처별 정산 예정 등록'}</h2>
        <p className="mb-6 mt-1 text-sm font-bold text-slate-400">정산 유형, 채널, 매출 및 정산 정보를 입력하세요.</p>
        <form onSubmit={handleSubmit}>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-sky-600">📋 기본 정보</p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-600">거래처명 <span className="text-red-500">*</span></label><input className={fieldCls} value={form.partner_name} onChange={set('partner_name')} placeholder="예: 네이버, (주)미양식품" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">거래처 유형</label><select className={selectCls} value={form.settlement_type} onChange={set('settlement_type')}><option value="B2C">B2C 온라인</option><option value="B2B">B2B 오프라인</option><option value="OVERSEAS">해외</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">채널명</label><input className={fieldCls} value={form.channel_name} onChange={set('channel_name')} placeholder="네이버 스마트스토어, 쿠팡…" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">브랜드명</label><input className={fieldCls} value={form.brand_name} onChange={set('brand_name')} placeholder="내일그룹" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">국가</label><select className={selectCls} value={form.country} onChange={set('country')}><option value="KR">🇰🇷 한국 (KRW)</option><option value="VN">🇻🇳 베트남 (VND)</option><option value="MN">🇲🇳 몽골 (MNT)</option><option value="TW">🇹🇼 대만 (TWD)</option><option value="RU">🇷🇺 러시아 (RUB)</option><option value="KZ">🇰🇿 카자흐스탄 (KZT)</option><option value="OTHER">기타</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">담당자</label><input className={fieldCls} value={form.manager} onChange={set('manager')} placeholder="담당자명" /></div>
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-sky-600">💰 매출 정보</p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-600">매출 발생일 <span className="text-red-500">*</span></label><input type="date" className={fieldCls} value={form.sale_date} onChange={set('sale_date')} /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">주문/발주번호</label><input className={fieldCls} value={form.order_no} onChange={set('order_no')} placeholder="주문번호" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">공급가 <span className="text-red-500">*</span></label><input type="number" className={fieldCls} value={form.supply_price} onChange={set('supply_price')} placeholder="0" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">수수료율 (%)</label><input type="number" step="0.1" className={fieldCls} value={form.fee_rate} onChange={set('fee_rate')} placeholder="0" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">배송비</label><input type="number" className={fieldCls} value={form.shipping_fee} onChange={set('shipping_fee')} placeholder="0" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">할인/쿠폰 비용</label><input type="number" className={fieldCls} value={form.discount_cost} onChange={set('discount_cost')} placeholder="0" /></div>
            <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 p-4"><p className="text-xs font-bold text-green-700">자동 계산: 최종 정산 예상금액</p><p className="mt-1 text-2xl font-black text-green-700">{fmt(expected)}</p><p className="mt-1 text-xs text-slate-400">공급가+VAT-수수료-배송비-할인-기타</p></div>
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-sky-600">📅 정산 정보</p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 기준일 타입</label><select className={selectCls} value={form.settlement_base_type} onChange={set('settlement_base_type')}><option>구매확정일</option><option>결제일</option><option>주문일</option><option>배송완료일</option><option>세금계산서 발행일</option><option>발주일</option><option>출고일</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 주기</label><select className={selectCls} value={form.settlement_cycle} onChange={set('settlement_cycle')}><option value="D+1">D+1</option><option value="D+7">D+7</option><option value="D+14">D+14</option><option value="D+30">D+30</option><option value="월말 마감 익월 15일">월말 마감 익월 15일</option><option value="발주 후 30일">발주 후 30일</option><option value="선입금">선입금</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 기준일</label><input type="date" className={fieldCls} value={form.settlement_base_date} onChange={set('settlement_base_date')} /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">정산 예정일 <span className="text-red-500">*</span></label><input type="date" className={fieldCls} value={form.settlement_due_date} onChange={set('settlement_due_date')} /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">입금 상태</label><select className={selectCls} value={form.status} onChange={set('status')}><option value="PENDING">정산 예정</option><option value="DONE">입금 완료</option><option value="OVERDUE">지연</option><option value="HOLD">보류</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">통화</label><select className={selectCls} value={form.currency} onChange={set('currency')}><option value="KRW">KRW (원)</option><option value="USD">USD (달러)</option><option value="VND">VND (동)</option><option value="MNT">MNT (투그릭)</option><option value="TWD">TWD (대만달러)</option></select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">입금 계좌</label><input className={fieldCls} value={form.bank_account} onChange={set('bank_account')} placeholder="기업은행 123-456-789" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">메모</label><input className={fieldCls} value={form.memo} onChange={set('memo')} placeholder="특이사항" /></div>
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

export default function SettlementSchedulePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPartner, setFilterPartner] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  async function load() {
    try {
      const res = await api.get('/executive/settlement-schedules', { params: { companyId: 1 } })
      setItems(Array.isArray(res.data) ? res.data : (res.data?.data || []))
    } catch { setItems([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleMarkDone(item) {
    const amt = window.prompt('실제 입금금액을 입력하세요:', String(item.expected_amount || 0))
    if (amt === null) return
    await api.put(`/executive/settlement-schedules/${item.id}`, { ...item, status: 'DONE', actual_amount: parseFloat(amt) || item.expected_amount, actual_pay_date: today() })
    load()
  }

  async function handleMarkOverdue(item) {
    await api.put(`/executive/settlement-schedules/${item.id}`, { ...item, status: 'OVERDUE' })
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('삭제하시겠습니까?')) return
    await api.delete(`/executive/settlement-schedules/${id}`)
    load()
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

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-400 font-bold">불러오는 중…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-sky-600">채널 · 판매 관리</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">거래처별 정산 예정현황</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">거래처별 매출 발생일과 정산 예정일, 입금 예정금액을 통합 관리하고 현금흐름에 자동 반영합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setEditItem(null); setShowForm(true) }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-500"><span className="material-symbols-outlined text-base">add</span>신규 정산 내역 등록</button>
          <button onClick={exportCSV} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><span className="material-symbols-outlined text-base">download</span>엑셀 다운로드</button>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-green-50 p-5">
        <p className="mb-3 text-sm font-black text-sky-800 flex items-center gap-2"><span className="material-symbols-outlined text-base">account_balance_wallet</span>현금흐름 연동 요약 — 정산 예정 데이터가 현금 흐름 대시보드에 자동 반영됩니다</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['오늘 입금 예정', todayAmt], ['이번 주 입금 예정', weekAmt], ['이번 달 입금 예정', thisMonthAmt], ['지연 정산 (리스크)', overdueAmt, 'text-red-600']].map(([label, val, color]) => (
            <div key={label} className="rounded-lg bg-white/70 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 text-lg font-black ${color || (val > 0 ? 'text-sky-700' : 'text-slate-400')}`}>{fmt(val)}</p></div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="총 정산 예정" value={fmt(totalExpected)} sub="입금 완료 제외" color="text-sky-600" />
        <SummaryCard label="이번 달 입금 예정" value={fmt(thisMonthAmt)} />
        <SummaryCard label="오늘 입금 예정" value={fmt(todayAmt)} />
        <SummaryCard label="지연 정산금액" value={fmt(overdueAmt)} color={overdueAmt > 0 ? 'text-red-600' : 'text-slate-950'} />
        <SummaryCard label="입금 완료금액" value={fmt(doneAmt)} color="text-green-600" />
        <SummaryCard label="등록 건수" value={`${items.length}건`} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-black text-slate-400">필터</span>
        <select className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">전체 유형</option><option value="B2C">B2C 온라인</option><option value="B2B">B2B 오프라인</option><option value="OVERSEAS">해외</option></select>
        <select className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">전체 상태</option><option value="PENDING">정산 예정</option><option value="DONE">입금 완료</option><option value="OVERDUE">지연</option><option value="HOLD">보류</option></select>
        <input className="h-9 w-40 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" placeholder="거래처/채널 검색" value={filterPartner} onChange={e=>setFilterPartner(e.target.value)} />
        <input type="date" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} />
        <span className="text-xs text-slate-300">~</span>
        <input type="date" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none" value={filterTo} onChange={e=>setFilterTo(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
              <tr>
                {['거래처명','유형','채널','브랜드','매출 발생일','정산 예정일','입금 예정금액','실제 입금금액','차액','상태','담당자','메모','관리'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={13} className="py-16 text-center text-sm font-bold text-slate-400">등록된 정산 내역이 없습니다.</td></tr>
              ) : filteredItems.map(s => {
                const diff = s.actual_amount != null ? s.actual_amount - (s.expected_amount || 0) : null
                return (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-950">{s.partner_name}</td>
                    <td className="px-4 py-3"><Badge type={s.settlement_type} /></td>
                    <td className="px-4 py-3 font-bold text-sky-600">{s.channel_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.brand_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.sale_date}</td>
                    <td className="px-4 py-3 font-bold text-slate-950">{s.settlement_due_date}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-950">{fmt(s.expected_amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{s.actual_amount != null ? fmt(s.actual_amount) : '-'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-slate-400'}`}>{diff != null ? (diff === 0 ? '0원' : (diff > 0 ? '+' : '') + fmt(diff)) : '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{s.manager || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.memo || ''}</td>
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

      {showForm && (
        <SettlementFormModal
          initialData={editItem}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSave={() => { setShowForm(false); setEditItem(null); load() }}
        />
      )}
    </div>
  )
}
