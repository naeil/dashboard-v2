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
const won = (v) => (v != null ? Number(v).toLocaleString('ko-KR') + '원' : '-')
const today = () => new Date().toISOString().slice(0, 10)

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

const fieldClass =
    'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

function SummaryCard({ label, value, color = 'text-slate-950' }) {
    return (
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500 mb-1">{label}</p>p>
                <p className={`text-lg font-black ${color}`}>{value}</p>p>
          </div>div>
        )
}

function Toggle({ checked, onChange, activeLabel, inactiveLabel }) {
    return (
          <button
                  type="button"
                  onClick={onChange}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black transition-colors ${
                            checked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                <span className="material-symbols-outlined text-sm">{checked ? 'check_circle' : 'radio_button_unchecked'}</span>span>
            {checked ? activeLabel : inactiveLabel}
          </button>button>
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
                                      try {
                                              const [listRes, summaryRes] = await Promise.all([
                                                        getPaymentLedgerList(activeTab),
                                                        getPaymentLedgerSummary(),
                                                      ])
                                                      setItems(listRes.data)
                                                              setSummary(summaryRes.data)
                                      } catch (e) {
                                              console.error(e)
                                      }
                                }
                                  
                                    useEffect(() => { loadData() }, [activeTab])
                                      
                                        const setValue = (k, v) => setForm((f) => ({ ...f, [k]: v }))
                                          
                                            const handleSubmit = async (e) => {
                                                  e.preventDefault()
                                                        setLoading(true)
                                                              try {
                                                                      const payload = { ...form, amount: Number(form.amount) }
                                                                              if (editId) {
                                                                                        await updatePaymentLedger(editId, payload)
                                                                              } else {
                                                                                        await createPaymentLedger(payload)
                                                                              }
                                                                      setShowForm(false)
                                                                              setForm({ ...emptyForm, direction: activeTab })
                                                                                      setEditId(null)
                                                                                              await loadData()
                                                                } finally {
                                                                      setLoading(false)
                                                              }
                                            }
                                              
                                                const handleEdit = (item) => {
                                                      setForm({
                                                              partner_name: item.partner_name,
                                                              direction: item.direction,
                                                              amount: item.amount,
                                                              issue_date: item.issue_date || today(),
                                                              due_date: item.due_date || '',
                                                              tax_invoice_issued: item.tax_invoice_issued,
                                                              payment_confirmed: item.payment_confirmed,
                                                              description: item.description || '',
                                                              status: item.status,
                                                      })
                                                            setEditId(item.id)
                                                                  setShowForm(true)
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
                                                              
                                                                const openNew = () => {
                                                                      setForm({ ...emptyForm, direction: activeTab })
                                                                            setEditId(null)
                                                                                  setShowForm(true)
                                                                }
                                                                  
                                                                    return (
                                                                          <div className="p-6 space-y-6">
                                                                                <div className="flex items-center justify-between">
                                                                                        <h1 className="text-2xl font-black text-slate-950">입출금 관리</h1>h1>
                                                                                        <button
                                                                                                    type="button"
                                                                                                    onClick={openNew}
                                                                                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 transition-colors"
                                                                                                  >
                                                                                                  <span className="material-symbols-outlined text-lg">add</span>span>
                                                                                                  신규 등록
                                                                                        </button>button>
                                                                                </div>div>
                                                                          
                                                                            {/* Summary Cards */}
                                                                                <div className="grid grid-cols-3 gap-4">
                                                                                        <SummaryCard label="미수금 합계" value={won(summary.unpaidReceivable)} color="text-red-600" />
                                                                                        <SummaryCard label="미지급 합계" value={won(summary.unpaidPayable)} color="text-orange-600" />
                                                                                        <SummaryCard label="이번달 수금 예정" value={won(summary.thisMonthReceivable)} color="text-blue-600" />
                                                                                </div>div>
                                                                          
                                                                            {/* Tabs */}
                                                                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                                                                  {[
                                                                            { id: 'RECEIVABLE', label: '수금 (거래처→내일)' },
                                                                            { id: 'PAYABLE', label: '지급 (내일→거래처)' },
                                                                                    ].map((tab) => (
                                                                                                <button
                                                                                                              key={tab.id}
                                                                                                              type="button"
                                                                                                              onClick={() => setActiveTab(tab.id)}
                                                                                                              className={`h-9 rounded-md px-4 text-sm font-black transition-colors ${
                                                                                                                              activeTab === tab.id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                                                                                                                }`}
                                                                                                            >
                                                                                                  {tab.label}
                                                                                                  </button>button>
                                                                                              ))}
                                                                                </div>div>
                                                                          
                                                                            {/* Form */}
                                                                            {showForm && (
                                                                                    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                                                                                              <h2 className="text-base font-black text-slate-950">{editId ? '수정' : '신규 등록'}</h2>h2>
                                                                                              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                                                                                          <label>
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">거래처명</span>span>
                                                                                                                        <input required value={form.partner_name} onChange={(e) => setValue('partner_name', e.target.value)} className={fieldClass} />
                                                                                                            </label>label>
                                                                                                          <label>
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">방향</span>span>
                                                                                                                        <select value={form.direction} onChange={(e) => setValue('direction', e.target.value)} className={fieldClass}>
                                                                                                                                        <option value="RECEIVABLE">수금</option>option>
                                                                                                                                        <option value="PAYABLE">지급</option>option>
                                                                                                                          </select>select>
                                                                                                            </label>label>
                                                                                                          <label>
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">금액</span>span>
                                                                                                                        <input type="number" required value={form.amount} onChange={(e) => setValue('amount', e.target.value)} className={fieldClass} />
                                                                                                            </label>label>
                                                                                                          <label>
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">발행일</span>span>
                                                                                                                        <input type="date" value={form.issue_date} onChange={(e) => setValue('issue_date', e.target.value)} className={fieldClass} />
                                                                                                            </label>label>
                                                                                                          <label>
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">납기일</span>span>
                                                                                                                        <input type="date" value={form.due_date} onChange={(e) => setValue('due_date', e.target.value)} className={fieldClass} />
                                                                                                            </label>label>
                                                                                                          <label>
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">상태</span>span>
                                                                                                                        <select value={form.status} onChange={(e) => setValue('status', e.target.value)} className={fieldClass}>
                                                                                                                                        <option value="PENDING">대기</option>option>
                                                                                                                                        <option value="DONE">완료</option>option>
                                                                                                                                        <option value="CANCELLED">취소</option>option>
                                                                                                                          </select>select>
                                                                                                            </label>label>
                                                                                                          <label className="md:col-span-3">
                                                                                                                        <span className="mb-1 block text-xs font-black text-slate-500">메모</span>span>
                                                                                                                        <input value={form.description} onChange={(e) => setValue('description', e.target.value)} className={fieldClass} />
                                                                                                            </label>label>
                                                                                                </div>div>
                                                                                              <div className="flex gap-3">
                                                                                                          <button type="submit" disabled={loading} className="h-9 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 transition-colors disabled:opacity-50">
                                                                                                            {editId ? '수정' : '등록'}
                                                                                                            </button>button>
                                                                                                          <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">
                                                                                                                        취소
                                                                                                            </button>button>
                                                                                                </div>div>
                                                                                    </form>form>
                                                                                )}
                                                                          
                                                                            {/* Table */}
                                                                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                                                        <table className="w-full text-sm">
                                                                                                  <thead className="bg-slate-50 border-b border-slate-200">
                                                                                                              <tr>
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">거래처명</th>th>
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">금액</th>th>
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">발행일</th>th>
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">납기일</th>th>
                                                                                                                {activeTab === 'RECEIVABLE' && (
                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">세금계산서</th>th>
                                                                                                                            )}
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">{activeTab === 'RECEIVABLE' ? '입금확인' : '정산완료'}</th>th>
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">상태</th>th>
                                                                                                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500">메모</th>th>
                                                                                                                            <th className="px-4 py-3 text-right text-xs font-black text-slate-500">액션</th>th>
                                                                                                                </tr>tr>
                                                                                                    </thead>thead>
                                                                                                  <tbody className="divide-y divide-slate-100">
                                                                                                    {items.length === 0 ? (
                                                                                          <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400 font-black">데이터가 없습니다.</td>td></tr>tr>
                                                                                        ) : (
                                                                                          items.map((item) => (
                                                                                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                                                                                              <td className="px-4 py-3 font-black text-slate-950">{item.partner_name}</td>td>
                                                                                                                              <td className="px-4 py-3 font-black text-slate-950">{won(item.amount)}</td>td>
                                                                                                                              <td className="px-4 py-3 text-slate-600">{item.issue_date || '-'}</td>td>
                                                                                                                              <td className="px-4 py-3 text-slate-600">{item.due_date || '-'}</td>td>
                                                                                                              {activeTab === 'RECEIVABLE' && (
                                                                                                                                  <td className="px-4 py-3">
                                                                                                                                                        <Toggle
                                                                                                                                                                                  checked={item.tax_invoice_issued}
                                                                                                                                                                                  onChange={() => handleToggleTax(item.id)}
                                                                                                                                                                                  activeLabel="발행완료"
                                                                                                                                                                                  inactiveLabel="미발행"
                                                                                                                                                                                />
                                                                                                                                    </td>td>
                                                                                                                              )}
                                                                                                                              <td className="px-4 py-3">
                                                                                                                                                  <Toggle
                                                                                                                                                                          checked={item.payment_confirmed}
                                                                                                                                                                          onChange={() => handleTogglePayment(item.id)}
                                                                                                                                                                          activeLabel="확인완료"
                                                                                                                                                                          inactiveLabel="미확인"
                                                                                                                                                                        />
                                                                                                                                </td>td>
                                                                                                                              <td className="px-4 py-3">
                                                                                                                                                  <span className={`rounded-full px-2 py-0.5 text-xs font-black ${STATUS_COLORS[item.status]}`}>
                                                                                                                                                    {STATUS_LABELS[item.status]}
                                                                                                                                                    </span>span>
                                                                                                                                </td>td>
                                                                                                                              <td className="px-4 py-3 text-slate-500 text-xs">{item.description || '-'}</td>td>
                                                                                                                              <td className="px-4 py-3 text-right">
                                                                                                                                                  <button onClick={() => handleEdit(item)} className="mr-2 text-sky-600 hover:text-sky-800 font-black text-xs">수정</button>button>
                                                                                                                                                  <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 font-black text-xs">삭제</button>button>
                                                                                                                                </td>td>
                                                                                                              </tr>tr>
                                                                                                          ))
                                                                                        )}
                                                                                                    </tbody>tbody>
                                                                                        </table>table>
                                                                                </div>div>
                                                                          </div>div>
                                                                        )
                                                                      }</div>
