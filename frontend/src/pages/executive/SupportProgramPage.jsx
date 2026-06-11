import { useEffect, useMemo, useState } from 'react'
import {
  createSupportProgram,
  deleteSupportProgram,
  getSupportProgramKpi,
  getSupportProgramList,
  updateSupportProgram,
} from '../../api/supportProgramApi'

const STATUS_CONFIG = {
  APPLYING: { label: '신청중', icon: 'edit_document', className: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  REVIEWING: { label: '심사중', icon: 'fact_check', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  SELECTED: { label: '선정', icon: 'verified', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  REJECTED: { label: '탈락', icon: 'block', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  DONE: { label: '완료', icon: 'task_alt', className: 'border-slate-200 bg-slate-50 text-slate-700' },
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = {
  programName: '',
  organization: '',
  appliedDate: today(),
  amount: '',
  status: 'APPLYING',
  managerName: '',
  memo: '',
}
const fieldClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
const won = (value) => value != null ? `${Number(value || 0).toLocaleString('ko-KR')}원` : '-'

function KpiCard({ label, value, icon, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black opacity-70">{label}</p>
        <span className="material-symbols-outlined text-xl opacity-70">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-black">{value}</p>
    </div>
  )
}

function SupportCard({ item, onEdit, onDelete }) {
  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.APPLYING
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{item.programName || item.program_name}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{item.organization || '-'}</p>
          <p className="mt-2 text-sm font-black text-sky-700">{won(item.amount)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${config.className}`}>{config.label}</span>
      </div>
      <div className="mt-3 space-y-1 text-xs font-bold text-slate-500">
        <p>신청일: {item.appliedDate || item.applied_date || '-'}</p>
        {item.managerName || item.manager_name ? <p>담당: {item.managerName || item.manager_name}</p> : null}
        {item.memo ? <p className="truncate">메모: {item.memo}</p> : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => onEdit(item)} className="rounded border border-sky-200 px-3 py-1.5 text-xs font-black text-sky-700">수정</button>
        <button onClick={() => onDelete(item.id)} className="rounded border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-600">삭제</button>
      </div>
    </div>
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
    const [listRes, kpiRes] = await Promise.all([getSupportProgramList(), getSupportProgramKpi()])
    setItems(Array.isArray(listRes.data) ? listRes.data : [])
    setKpi(kpiRes.data || {})
  }

  useEffect(() => {
    load().catch(() => {
      setItems([])
      setKpi({})
    })
  }, [])

  const grouped = useMemo(() => {
    const base = Object.fromEntries(Object.keys(STATUS_CONFIG).map((key) => [key, []]))
    items.forEach((item) => {
      const status = item.status || 'APPLYING'
      if (!base[status]) base[status] = []
      base[status].push(item)
    })
    return base
  }, [items])

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const openNew = () => {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
  }

  const handleEdit = (item) => {
    setForm({
      programName: item.programName || item.program_name || '',
      organization: item.organization || '',
      appliedDate: item.appliedDate || item.applied_date || today(),
      amount: item.amount || '',
      status: item.status || 'APPLYING',
      managerName: item.managerName || item.manager_name || '',
      memo: item.memo || '',
    })
    setEditId(item.id)
    setShowForm(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, amount: Number(form.amount || 0) }
      if (editId) await updateSupportProgram(editId, payload)
      else await createSupportProgram(payload)
      setShowForm(false)
      setForm(emptyForm)
      setEditId(null)
      await load()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    await deleteSupportProgram(id)
    await load()
  }

  return (
    <div className="space-y-6 bg-slate-50 p-6 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Strategy Finance</p>
          <h1 className="mt-1 text-2xl font-black">지원사업 신청 현황</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">정부지원, 보조금, 사업화 과제 신청과 선정 금액을 관리합니다.</p>
        </div>
        <button onClick={openNew} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
          <span className="material-symbols-outlined text-lg">add</span>
          신규 등록
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="진행중 과제" value={`${Number(kpi.activeCount || 0).toLocaleString('ko-KR')}건`} icon="pending_actions" tone="blue" />
        <KpiCard label="진행중 신청금액" value={won(kpi.activeTotalAmount)} icon="payments" />
        <KpiCard label="선정 금액" value={won(kpi.selectedTotalAmount)} icon="verified" tone="emerald" />
      </section>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">{editId ? '지원사업 수정' : '지원사업 등록'}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-black text-slate-500">사업명</span>
              <input className={fieldClass} value={form.programName} onChange={(e) => setValue('programName', e.target.value)} required />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">주관기관</span>
              <input className={fieldClass} value={form.organization} onChange={(e) => setValue('organization', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">신청일</span>
              <input type="date" className={fieldClass} value={form.appliedDate} onChange={(e) => setValue('appliedDate', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">지원금액</span>
              <input type="number" className={fieldClass} value={form.amount} onChange={(e) => setValue('amount', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">상태</span>
              <select className={fieldClass} value={form.status} onChange={(e) => setValue('status', e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">담당자</span>
              <input className={fieldClass} value={form.managerName} onChange={(e) => setValue('managerName', e.target.value)} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-black text-slate-500">메모</span>
              <textarea className={`${fieldClass} h-24 py-2`} value={form.memo} onChange={(e) => setValue('memo', e.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-600">취소</button>
            <button type="submit" disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{loading ? '저장 중' : '저장'}</button>
          </div>
        </form>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className={`rounded-xl border p-4 ${config.className}`}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black">
              <span className="material-symbols-outlined text-lg">{config.icon}</span>
              {config.label}
              <span className="text-slate-400">({grouped[status]?.length || 0})</span>
            </h3>
            <div className="space-y-3">
              {(grouped[status] || []).map((item) => <SupportCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />)}
              {(grouped[status] || []).length === 0 && <p className="rounded bg-white/70 p-4 text-center text-xs font-bold text-slate-400">없음</p>}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
