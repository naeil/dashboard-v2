import { useCallback, useEffect, useState } from 'react'
import { getRoster, getHrCard, saveHrCard } from '../../api/hrApi'

const roleLabel = { EXECUTIVE: '대표', MANAGER: '팀장', HR_MANAGER: '인사담당자', EMPLOYEE: '직원' }
const won = (v) => (v == null || v === '' ? '-' : `${Math.round(Number(v)).toLocaleString('ko-KR')}원`)
const day = (v) => (v ? String(v).slice(0, 10) : '-')
const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-sky-400 focus:outline-none'

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function CardModal({ id, onClose, onSaved }) {
  const [d, setD] = useState(null)
  const [f, setF] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getHrCard(id).then((data) => {
      setD(data)
      setF({
        positionName: data.position_name || '', email: data.email || '', phone: data.phone || '',
        hireDate: day(data.hire_date) === '-' ? '' : day(data.hire_date),
        birthDate: day(data.birth_date) === '-' ? '' : day(data.birth_date),
        employmentType: data.employment_type || '', address: data.address || '',
        emergencyContact: data.emergency_contact || '', baseSalary: data.base_salary || '',
        bankName: data.bank_name || '', bankAccount: data.bank_account || '',
        residentNumber: data.resident_number || '', annualLeaveTotal: data.annual_leave_total || '',
        hrMemo: data.hr_memo || '',
      })
    }).catch(() => {})
  }, [id])

  const set = (patch) => setF((prev) => ({ ...prev, ...patch }))
  const save = async () => {
    setSaving(true); setMsg('')
    try {
      const res = await saveHrCard(id, f)
      if (res.success === false) throw new Error(res.message)
      setMsg('저장했습니다.')
      onSaved()
      setTimeout(onClose, 600)
    } catch (e) { setMsg(e?.response?.data?.message || e.message || '저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-black text-slate-900">인사카드 {d && `— ${d.display_name}`}</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><span className="material-symbols-outlined">close</span></button>
        </div>
        {!d ? <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p> : (
          <div className="px-5 py-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-base font-black text-white">{String(d.display_name || '?').slice(0, 1)}</span>
              <div>
                <p className="text-base font-black text-slate-900">{d.display_name} <span className="ml-1 text-[12px] font-bold text-slate-400">{roleLabel[d.role] || d.role} · {d.department || '-'}</span></p>
                <p className="text-[12px] text-slate-400">아이디 {d.username} · 연차 잔여 {Number(d.annual_leave_total || 0) - Number(d.leaveUsed || 0)}일 (부여 {d.annual_leave_total}일 · 사용 {d.leaveUsed}일)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="직급"><input className={input} value={f.positionName} onChange={(e) => set({ positionName: e.target.value })} /></Field>
              <Field label="고용형태"><input className={input} value={f.employmentType} onChange={(e) => set({ employmentType: e.target.value })} placeholder="정규직/계약직 등" /></Field>
              <Field label="입사일"><input type="date" className={input} value={f.hireDate} onChange={(e) => set({ hireDate: e.target.value })} /></Field>
              <Field label="생년월일"><input type="date" className={input} value={f.birthDate} onChange={(e) => set({ birthDate: e.target.value })} /></Field>
              <Field label="연락처"><input className={input} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="이메일"><input className={input} value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="주소"><input className={input} value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="비상연락처"><input className={input} value={f.emergencyContact} onChange={(e) => set({ emergencyContact: e.target.value })} /></Field>
              <Field label="기본급 (월)"><input className={input} inputMode="numeric" value={f.baseSalary} onChange={(e) => set({ baseSalary: e.target.value })} /></Field>
              <Field label="연차 부여일수"><input className={input} inputMode="decimal" value={f.annualLeaveTotal} onChange={(e) => set({ annualLeaveTotal: e.target.value })} /></Field>
              <Field label="급여 은행"><input className={input} value={f.bankName} onChange={(e) => set({ bankName: e.target.value })} /></Field>
              <Field label="급여 계좌"><input className={input} value={f.bankAccount} onChange={(e) => set({ bankAccount: e.target.value })} /></Field>
              <Field label="주민등록번호 (민감)"><input className={input} value={f.residentNumber} onChange={(e) => set({ residentNumber: e.target.value })} placeholder="마스킹 표시 · 새로 입력 시에만 변경" /></Field>
            </div>
            <div className="mt-3">
              <Field label="인사 메모"><textarea className="min-h-[70px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" value={f.hrMemo} onChange={(e) => set({ hrMemo: e.target.value })} /></Field>
            </div>
            {msg && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-600">{msg}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">닫기</button>
              <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-black text-white hover:bg-sky-600 disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HrRosterPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getRoster().then(setRows).catch((e) => setError(e?.response?.data?.message || '직원 명부를 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true
    const s = q.trim().toLowerCase()
    return [r.display_name, r.department, r.position_name, r.username].some((v) => String(v || '').toLowerCase().includes(s))
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-black text-slate-900">직원 명부 · 인사카드</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">직원 기본정보·급여·연차를 관리합니다. 행을 클릭하면 인사카드가 열립니다. (인사담당자·대표 전용)</p>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input className={`${input} max-w-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·부서·직급 검색" />
        <span className="text-[12px] text-slate-400">{filtered.length}명</span>
      </div>
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-bold text-rose-600">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
              <th className="px-3 py-2.5 text-left">이름</th>
              <th className="px-3 py-2.5 text-left">부서 · 직급</th>
              <th className="px-3 py-2.5 text-left">역할</th>
              <th className="px-3 py-2.5 text-left">입사일</th>
              <th className="px-3 py-2.5 text-right">기본급</th>
              <th className="px-3 py-2.5 text-left">연락처</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">불러오는 중…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">직원이 없습니다.</td></tr>
              : filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-sky-50/40" onClick={() => setOpenId(r.id)}>
                  <td className="px-3 py-2.5"><span className="text-[13px] font-black text-slate-800">{r.display_name}</span> <span className="text-[11px] text-slate-400">{r.username}</span></td>
                  <td className="px-3 py-2.5 text-[13px] text-slate-600">{r.department || '-'} · {r.position_name || '-'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{roleLabel[r.role] || r.role}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{day(r.hire_date)}</td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-bold text-slate-700">{won(r.base_salary)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{r.phone || '-'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {openId && <CardModal id={openId} onClose={() => setOpenId(null)} onSaved={load} />}
    </div>
  )
}
