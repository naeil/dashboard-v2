import { useEffect, useState } from 'react'
import {
  createPaymentLedger,
  deletePaymentLedger,
  getPaymentLedgerList,
  getPaymentLedgerSummary,
  togglePaymentConfirmed,
  toggleTaxInvoice,
  updatePaymentLedger,
} from '../../api/partnerPaymentApi'

const STATUS_LABELS = { PENDING: '대기', DONE: '완료', CANCELLED: '취소' }
const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const today = () => new Date().toISOString().slice(0, 10)
const won = (value) => value != null ? `${Number(value || 0).toLocaleString('ko-KR')}원` : '-'
const fieldClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

const emptyForm = {
  partner_name: '',
  direction: 'RECEIVABLE',
  amount: '',
  issue_date: today(),
  due_date: '',
  tax_invoice_issued: false,
  payment_confirmed: false,
  description: '',
  status: 'PENDING',
}

function SummaryCard({ label, value, color = 'text-slate-950' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-4 text-2xl font-black ${color}`}>{value}</p>
    </div>
  )
}

function Toggle({ checked, onChange, activeLabel, inactiveLabel }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${checked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
    >
      <span className="material-symbols-outlined text-sm">{checked ? 'check_circle' : 'radio_button_unchecked'}</span>
      {checked ? activeLabel : inactiveLabel}
    </button>
  )
}

export default function PartnerPaymentLedgerPage() {
  const [activeTab, setActiveTab] = useState('RECEIVABLE')
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    const [listRes, summaryRes] = await Promise.all([
      getPaymentLedgerList(activeTab),
      getPaymentLedgerSummary(),
    ])
    setItems(Array.isArray(listRes.data) ? listRes.data : [])
    setSummary(summaryRes.data || {})
  }

  useEffect(() => {
    loadData().catch(() => {
      setItems([])
      setSummary({})
    })
  }, [activeTab])

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const openNew = () => {
    setForm({ ...emptyForm, direction: activeTab })
    setEditId(null)
    setShowForm(true)
  }

  const handleEdit = (item) => {
    setForm({
      partner_name: item.partner_name || '',
      direction: item.direction || activeTab,
      amount: item.amount || '',
      issue_date: item.issue_date || today(),
      due_date: item.due_date || '',
      tax_invoice_issued: Boolean(item.tax_invoice_issued),
      payment_confirmed: Boolean(item.payment_confirmed),
      description: item.description || '',
      status: item.status || 'PENDING',
    })
    setEditId(item.id)
    setShowForm(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, amount: Number(form.amount || 0) }
      if (editId) await updatePaymentLedger(editId, payload)
      else await createPaymentLedger(payload)
      setShowForm(false)
      setForm({ ...emptyForm, direction: activeTab })
      setEditId(null)
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    await deletePaymentLedger(id)
    await loadData()
  }

  const handleToggleTax = async (id) => {
    await toggleTaxInvoice(id)
    await loadData()
  }

  const handleTogglePayment = async (id) => {
    await togglePaymentConfirmed(id)
    await loadData()
  }

  return (
    <div className="space-y-6 bg-slate-50 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">거래처 수금 / 지급 내역</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">거래처별 미수금, 지급 예정, 세금계산서와 정산 확인을 관리합니다.</p>
        </div>
        <button onClick={openNew} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
          <span className="material-symbols-outlined text-lg">add</span>
          신규 등록
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="미수금 합계" value={won(summary.totalReceivable)} color="text-blue-700" />
        <SummaryCard label="지급 예정 합계" value={won(summary.totalPayable)} color="text-rose-600" />
        <SummaryCard label="입금 확인" value={`${Number(summary.confirmedReceivableCount || 0).toLocaleString('ko-KR')}건`} />
        <SummaryCard label="미확인" value={`${Number(summary.pendingCount || 0).toLocaleString('ko-KR')}건`} />
      </section>

      <section className="flex gap-2">
        {[
          { id: 'RECEIVABLE', label: '수금 관리' },
          { id: 'PAYABLE', label: '지급 관리' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-4 py-2 text-sm font-black ${activeTab === tab.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">{editId ? '내역 수정' : '내역 등록'}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">거래처명</span>
              <input className={fieldClass} value={form.partner_name} onChange={(e) => setValue('partner_name', e.target.value)} required />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">방향</span>
              <select className={fieldClass} value={form.direction} onChange={(e) => setValue('direction', e.target.value)}>
                <option value="RECEIVABLE">수금</option>
                <option value="PAYABLE">지급</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">금액</span>
              <input type="number" className={fieldClass} value={form.amount} onChange={(e) => setValue('amount', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">발행일</span>
              <input type="date" className={fieldClass} value={form.issue_date} onChange={(e) => setValue('issue_date', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">납기일</span>
              <input type="date" className={fieldClass} value={form.due_date} onChange={(e) => setValue('due_date', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">상태</span>
              <select className={fieldClass} value={form.status} onChange={(e) => setValue('status', e.target.value)}>
                <option value="PENDING">대기</option>
                <option value="DONE">완료</option>
                <option value="CANCELLED">취소</option>
              </select>
            </label>
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-black text-slate-500">메모</span>
              <textarea className={`${fieldClass} h-24 py-2`} value={form.description} onChange={(e) => setValue('description', e.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-600">취소</button>
            <button type="submit" disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{loading ? '저장 중' : '저장'}</button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">거래처명</th>
                <th className="px-4 py-3 text-right text-xs font-black text-slate-500">금액</th>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">발행일</th>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">납기일</th>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">세금계산서</th>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">{activeTab === 'RECEIVABLE' ? '입금확인' : '정산완료'}</th>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">상태</th>
                <th className="px-4 py-3 text-left text-xs font-black text-slate-500">메모</th>
                <th className="px-4 py-3 text-right text-xs font-black text-slate-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm font-black text-slate-400">데이터가 없습니다.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-black text-slate-950">{item.partner_name}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-950">{won(item.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{item.issue_date || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.due_date || '-'}</td>
                  <td className="px-4 py-3">
                    <Toggle checked={item.tax_invoice_issued} onChange={() => handleToggleTax(item.id)} activeLabel="발행" inactiveLabel="미발행" />
                  </td>
                  <td className="px-4 py-3">
                    <Toggle checked={item.payment_confirmed} onChange={() => handleTogglePayment(item.id)} activeLabel="확인" inactiveLabel="대기" />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${STATUS_COLORS[item.status] || STATUS_COLORS.PENDING}`}>{STATUS_LABELS[item.status] || item.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.description || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(item)} className="mr-2 text-xs font-black text-sky-600">수정</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs font-black text-rose-600">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
