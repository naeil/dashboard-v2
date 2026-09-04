import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMyLeave, submitLeave, getLeaveInbox, getLeaveAll, actOnLeave } from '../../api/hrApi'

const LEAVE_TYPES = ['연차', '반차', '병가', '경조사', '기타']
const day = (v) => (v ? String(v).slice(0, 10) : '-')
const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-sky-400 focus:outline-none'
const STATUS = {
  SUBMITTED: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: '승인', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: '반려', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}
function Badge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200' }
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-black ${s.cls}`}>{s.label}</span>
}
const rangeDays = (s, e) => {
  if (!s || !e) return 1
  const d = (new Date(e) - new Date(s)) / 86400000
  return Number.isFinite(d) && d >= 0 ? d + 1 : 1
}

function MyLeave() {
  const [ov, setOv] = useState(null)
  const [f, setF] = useState({ leaveType: '연차', startDate: '', endDate: '', days: '', reason: '' })
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(() => { getMyLeave().then(setOv).catch(() => {}) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const set = (patch) => setF((prev) => {
    const next = { ...prev, ...patch }
    if ((patch.startDate || patch.endDate || patch.leaveType) && next.leaveType !== '반차') {
      next.days = String(rangeDays(next.startDate, next.endDate))
    }
    if (patch.leaveType === '반차') next.days = '0.5'
    return next
  })

  const submit = async () => {
    setMsg('')
    if (!f.startDate) { setMsg('시작일을 선택하세요.'); return }
    setSaving(true)
    try {
      const res = await submitLeave({ ...f, endDate: f.endDate || f.startDate, days: f.days || rangeDays(f.startDate, f.endDate || f.startDate) })
      if (res.success === false) throw new Error(res.message)
      setMsg('휴가를 신청했습니다. 승인 대기 중입니다.')
      setF({ leaveType: '연차', startDate: '', endDate: '', days: '', reason: '' })
      load()
    } catch (e) { setMsg(e?.response?.data?.message || e.message || '신청 실패') }
    finally { setSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-[11px] font-bold text-slate-400">부여</p>
            <p className="mt-1 text-xl font-black text-slate-900">{ov ? Number(ov.annualTotal) : '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-[11px] font-bold text-slate-400">사용</p>
            <p className="mt-1 text-xl font-black text-slate-500">{ov ? Number(ov.annualUsed) : '-'}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-center">
            <p className="text-[11px] font-bold text-emerald-600">잔여</p>
            <p className="mt-1 text-xl font-black text-emerald-700">{ov ? Number(ov.annualRemain) : '-'}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-black text-slate-800">휴가 신청</p>
          <div className="space-y-3">
            <label className="flex flex-col gap-1"><span className="text-[12px] font-black text-slate-500">종류</span>
              <select className={input} value={f.leaveType} onChange={(e) => set({ leaveType: e.target.value })}>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[12px] font-black text-slate-500">시작일</span>
                <input type="date" className={input} value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
              <label className="flex flex-col gap-1"><span className="text-[12px] font-black text-slate-500">종료일</span>
                <input type="date" className={input} value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} disabled={f.leaveType === '반차'} /></label>
            </div>
            <label className="flex flex-col gap-1"><span className="text-[12px] font-black text-slate-500">사용 일수</span>
              <input className={input} inputMode="decimal" value={f.days} onChange={(e) => set({ days: e.target.value })} /></label>
            <label className="flex flex-col gap-1"><span className="text-[12px] font-black text-slate-500">사유</span>
              <input className={input} value={f.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="선택" /></label>
            {msg && <div className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-600">{msg}</div>}
            <button type="button" disabled={saving} onClick={submit} className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-black text-white hover:bg-sky-600 disabled:opacity-50">{saving ? '신청 중…' : '휴가 신청'}</button>
          </div>
        </div>
      </div>
      <div className="xl:col-span-3">
        <p className="mb-2 text-sm font-black text-slate-700">내 휴가 내역</p>
        <div className="rounded-xl border border-slate-200 bg-white">
          {!ov ? <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
            : (ov.requests || []).length === 0 ? <p className="py-12 text-center text-sm text-slate-400">신청 내역이 없습니다.</p>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="px-3 py-2.5 text-left">종류</th><th className="px-3 py-2.5 text-left">기간</th><th className="px-3 py-2.5 text-center">일수</th><th className="px-3 py-2.5 text-center">상태</th>
                </tr></thead>
                <tbody>{ov.requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2.5 text-[13px] font-bold text-slate-700">{r.leave_type}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500">{day(r.start_date)} ~ {day(r.end_date)}</td>
                    <td className="px-3 py-2.5 text-center text-[13px] font-black text-slate-700">{Number(r.days)}</td>
                    <td className="px-3 py-2.5 text-center"><Badge status={r.status} /></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  )
}

function LeaveInbox({ mode }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [flash, setFlash] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    ;(mode === 'inbox' ? getLeaveInbox() : getLeaveAll()).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [mode])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const act = async (id, action) => {
    setBusy(`${id}-${action}`); setFlash('')
    try {
      const res = await actOnLeave(id, action, '')
      if (res.success === false) throw new Error(res.message)
      setFlash(res.message || '처리했습니다.'); load(); setTimeout(() => setFlash(''), 3000)
    } catch (e) { setFlash(e?.response?.data?.message || e.message || '처리 실패') }
    finally { setBusy('') }
  }

  return (
    <div>
      {flash && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{flash}</div>}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
          : rows.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">{mode === 'inbox' ? '승인 대기 중인 휴가가 없습니다.' : '휴가 내역이 없습니다.'}</p>
          : (
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="px-3 py-2.5 text-left">신청자</th><th className="px-3 py-2.5 text-left">종류</th><th className="px-3 py-2.5 text-left">기간</th><th className="px-3 py-2.5 text-center">일수</th><th className="px-3 py-2.5 text-left">사유</th><th className="px-3 py-2.5 text-center">{mode === 'inbox' ? '처리' : '상태'}</th>
              </tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2.5"><span className="text-[13px] font-black text-slate-800">{r.display_name}</span> <span className="text-[11px] text-slate-400">{r.department || ''}</span></td>
                  <td className="px-3 py-2.5 text-[13px] text-slate-600">{r.leave_type}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{day(r.start_date)} ~ {day(r.end_date)}</td>
                  <td className="px-3 py-2.5 text-center text-[13px] font-black text-slate-700">{Number(r.days)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{r.reason || '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {mode === 'inbox' ? (
                      <span className="inline-flex gap-1.5">
                        <button type="button" disabled={busy} onClick={() => act(r.id, 'REJECT')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] font-black text-rose-600 hover:bg-rose-100 disabled:opacity-50">반려</button>
                        <button type="button" disabled={busy} onClick={() => act(r.id, 'APPROVE')} className="rounded-lg bg-sky-500 px-3 py-1 text-[12px] font-black text-white hover:bg-sky-600 disabled:opacity-50">승인</button>
                      </span>
                    ) : <Badge status={r.status} />}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  )
}

export default function HrLeavePage({ role = 'EMPLOYEE' }) {
  const isHr = role === 'EXECUTIVE' || role === 'HR_MANAGER'
  const [tab, setTab] = useState('my')
  const tabs = useMemo(() => isHr
    ? [{ id: 'my', label: '내 휴가' }, { id: 'inbox', label: '승인 대기함' }, { id: 'all', label: '전체 내역' }]
    : [{ id: 'my', label: '내 휴가' }], [isHr])

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-black text-slate-900">휴가 · 연차</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">{isHr ? '휴가를 신청하고, 직원 휴가를 승인·관리합니다. 승인 시 연차가 자동 차감됩니다.' : '휴가를 신청하면 인사담당자·대표가 승인합니다. 승인 시 연차가 차감됩니다.'}</p>
      </div>
      {isHr && (
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-black ${tab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t.label}</button>
          ))}
        </div>
      )}
      {tab === 'my' && <MyLeave />}
      {tab === 'inbox' && isHr && <LeaveInbox mode="inbox" />}
      {tab === 'all' && isHr && <LeaveInbox mode="all" />}
    </div>
  )
}
