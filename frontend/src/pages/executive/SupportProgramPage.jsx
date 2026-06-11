import { useEffect, useState } from 'react'
import {
    createSupportProgram,
    deleteSupportProgram,
    getSupportProgramKpi,
    getSupportProgramList,
    updateSupportProgram,
} from '../../api/supportProgramApi'

const STATUS_CONFIG = {
    APPLYING: { label: '신청중', emoji: '🟡', bg: 'bg-yellow-50 border-yellow-200' },
    REVIEWING: { label: '심사중', emoji: '🔵', bg: 'bg-blue-50 border-blue-200' },
    SELECTED: { label: '선정', emoji: '✅', bg: 'bg-green-50 border-green-200' },
    REJECTED: { label: '탈락', emoji: '❌', bg: 'bg-red-50 border-red-200' },
    DONE: { label: '완료', emoji: '⬜', bg: 'bg-gray-50 border-gray-200' },
}
const won = (v) => (v != null ? Number(v).toLocaleString('ko-KR') + '원' : '-')
const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
    program_name: '',
    organization: '',
    applied_date: today(),
    amount: '',
    status: 'APPLYING',
    manager_name: '',
    memo: '',
}
const fieldClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

function KpiCard({ label, value, color = '' }) {
    return (
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500 mb-1">{label}</p>p>
                <p className={`text-xl font-black ${color}`}>{value}</p>p>
          </div>div>
        )
}

function StatusCard({ status, items, onEdit, onDelete }) {
    const cfg = STATUS_CONFIG[status] || { label: status, emoji: '•', bg: 'bg-slate-50 border-slate-200' }
        return (
              <div className={`rounded-xl border p-4 ${cfg.bg}`}>
                    <h3 className="text-sm font-black text-slate-700 mb-3">{cfg.emoji} {cfg.label} <span className="text-slate-400">({items.length})</span>span></h3>h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                          <div key={item.id} className="rounded-lg bg-white border border-slate-100 p-3 shadow-sm">
                                      <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-slate-950 truncate">{item.program_name}</p>p>
                                                                    <p className="text-xs text-slate-500 mt-0.5">{item.organization || '-'}</p>p>
                                                                    <p className="text-xs font-black text-sky-600 mt-1">{won(item.amount)}</p>p>
                                                      {item.manager_name && <p className="text-xs text-slate-400 mt-0.5">담당: {item.manager_name}</p>p>}
                                                      {item.memo && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.memo}</p>p>}
                                                    </div>div>
                                                    <div className="flex gap-1 shrink-0">
                                                                    <button onClick={() => onEdit(item)} className="text-sky-600 hover:text-sky-800 font-black text-xs">수정</button>button>
                                                                    <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700 font-black text-xs">삭제</button>button>
                                                    </div>div>
                                      </div>div>
                          </div>div>
                        ))}
                      {items.length === 0 && <p className="text-xs text-slate-400 text-center py-2">없음</p>p>}
                    </div>div>
              </div>div>
            )
}

export default function SupportProgramPage() {
    const [items, setItems] = useState([])
        const [kpi, setKpi] = useState({})
            const [showForm, setShowForm] = useState(false)
                const [form, setForm] = useState(emptyForm)
                    const [editId, setEditId] = useState(null)
                        const [loading, setLoading] = useState(false)
                          
                            const load = async () => {
                                  try {
                                          const [listRes, kpiRes] = await Promise.all([getSupportProgramList(), getSupportProgramKpi()])
                                                  setItems(listRes.data)
                                                          setKpi(kpiRes.data)
                                  } catch (e) { console.error(e) }
                            }
                              
                                useEffect(() => { load() }, [])
                                  
                                    const setValue = (k, v) => setForm((f) => ({ ...f, [k]: v }))
                                      
                                        const handleSubmit = async (e) => {
                                              e.preventDefault()
                                                    setLoading(true)
                                                          try {
                                                                  const payload = { ...form, amount: Number(form.amount) }
                                                                          if (editId) { await updateSupportProgram(editId, payload) }
                                                                  else { await createSupportProgram(payload) }
                                                                  setShowForm(false); setForm(emptyForm); setEditId(null)
                                                                          await load()
                                                          } finally { setLoading(false) }
                                        }
                                          
                                            const handleEdit = (item) => {
                                                  setForm({ program_name: item.program_name, organization: item.organization || '', applied_date: item.applied_date || today(), amount: item.amount || '', status: item.status, manager_name: item.manager_name || '', memo: item.memo || '' })
                                                        setEditId(item.id); setShowForm(true)
                                            }
                                              
                                                const handleDelete = async (id) => {
                                                      if (!window.confirm('삭제하시겠습니까?')) return
                                                            await deleteSupportProgram(id); await load()
                                                }
                                                  
                                                    const grouped = Object.fromEntries(Object.keys(STATUS_CONFIG).map((s) => [s, items.filter((i) => i.status === s)]))
                                                      
                                                        return (
                                                              <div className="p-6 space-y-6">
                                                                    <div className="flex items-center justify-between">
                                                                            <h1 className="text-2xl font-black text-slate-950">지원사업 신청 현황</h1>h1>
                                                                            <button type="button" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }}
                                                                                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 transition-colors">
                                                                                      <span className="material-symbols-outlined text-lg">add</span>span>신규 등록
                                                                            </button>button>
                                                                    </div>div>
                                                              
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                            <KpiCard label="진행중 건수" value={`${kpi.activeCount ?? 0}건`} color="text-blue-600" />
                                                                            <KpiCard label="진행중 총액" value={won(kpi.activeTotalAmount)} color="text-orange-600" />
                                                                            <KpiCard label="선정 누적 금액" value={won(kpi.selectedTotalAmount)} color="text-green-600" />
                                                                    </div>div>
                                                              
                                                                {showForm && (
                                                                        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                                                                                  <h2 className="text-base font-black text-slate-950">{editId ? '수정' : '신규 등록'}</h2>h2>
                                                                                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                                                                              <label className="md:col-span-2"><span className="mb-1 block text-xs font-black text-slate-500">사업명</span>span>
                                                                                                            <input required value={form.program_name} onChange={(e) => setValue('program_name', e.target.value)} className={fieldClass} />
                                                                                                </label>label>
                                                                                              <label><span className="mb-1 block text-xs font-black text-slate-500">주관기관</span>span>
                                                                                                            <input value={form.organization} onChange={(e) => setValue('organization', e.target.value)} className={fieldClass} />
                                                                                                </label>label>
                                                                                              <label><span className="mb-1 block text-xs font-black text-slate-500">신청일</span>span>
                                                                                                            <input type="date" value={form.applied_date} onChange={(e) => setValue('applied_date', e.target.value)} className={fieldClass} />
                                                                                                </label>label>
                                                                                              <label><span className="mb-1 block text-xs font-black text-slate-500">지원금액</span>span>
                                                                                                            <input type="number" value={form.amount} onChange={(e) => setValue('amount', e.target.value)} className={fieldClass} />
                                                                                                </label>label>
                                                                                              <label><span className="mb-1 block text-xs font-black text-slate-500">상태</span>span>
                                                                                                            <select value={form.status} onChange={(e) => setValue('status', e.target.value)} className={fieldClass}>
                                                                                                              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>option>)}
                                                                                                              </select>select>
                                                                                                </label>label>
                                                                                              <label><span className="mb-1 block text-xs font-black text-slate-500">담당자</span>span>
                                                                                                            <input value={form.manager_name} onChange={(e) => setValue('manager_name', e.target.value)} className={fieldClass} />
                                                                                                </label>label>
                                                                                              <label className="md:col-span-2"><span className="mb-1 block text-xs font-black text-slate-500">메모</span>span>
                                                                                                            <input value={form.memo} onChange={(e) => setValue('memo', e.target.value)} className={fieldClass} />
                                                                                                </label>label>
                                                                                  </div>div>
                                                                                  <div className="flex gap-3">
                                                                                              <button type="submit" disabled={loading} className="h-9 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">
                                                                                                {editId ? '수정' : '등록'}
                                                                                                </button>button>
                                                                                              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-50">
                                                                                                            취소
                                                                                                </button>button>
                                                                                  </div>div>
                                                                        </form>form>
                                                                    )}
                                                              
                                                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                                                                      {Object.entries(STATUS_CONFIG).map(([status]) => (
                                                                          <StatusCard key={status} status={status} items={grouped[status] || []} onEdit={handleEdit} onDelete={handleDelete} />
                                                                        ))}
                                                                    </div>div>
                                                              </div>div>
                                                            )
                                                          }</div>
