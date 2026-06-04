import { useEffect, useRef, useState } from 'react'
import { getPayrollMonths, getPayrollRecords, sendPayslips, uploadPayrollExcel, updateUserEmail } from '../../api/payrollApi'
import { getUsers } from '../../api/authApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'

const fmt = (val) =>
  val != null ? Number(val).toLocaleString('ko-KR') + ' 원' : '-'

const fmtDate = (val) =>
  val ? String(val).replace('T', ' ').slice(0, 16) : '-'

export default function PayrollPage() {
  const [months, setMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState({ text: '', type: 'info' })
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadMonth, setUploadMonth] = useState('')
  const [emailEdits, setEmailEdits] = useState({})
  const [savingEmail, setSavingEmail] = useState(null)
  const fileInputRef = useRef(null)

  const notify = (text, type = 'info') => setMessage({ text, type })

  const load = async () => {
    const [monthRes, userRes] = await Promise.all([getPayrollMonths(), getUsers()])
    const monthList = monthRes.data || []
    setMonths(monthList)
    setUsers(userRes.data || [])
    if (monthList.length > 0 && !selectedMonth) {
      setSelectedMonth(monthList[0])
    }
  }

  const loadRecords = async () => {
    if (!selectedMonth) return
    const res = await getPayrollRecords(selectedMonth)
    setRecords(res.data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadRecords() }, [selectedMonth])

  const handleUpload = async (e) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) { notify('파일을 선택하세요.', 'error'); return }
    if (!uploadMonth) { notify('급여 연월을 입력하세요.', 'error'); return }
    setUploading(true)
    try {
      const res = await uploadPayrollExcel(file, uploadMonth)
      const r = res.data
      notify(`업로드 완료 — 총 ${r.total}건 중 ${r.imported}건 저장, ${r.skipped}건 중복 스킵`, 'success')
      fileInputRef.current.value = ''
      await load()
      setSelectedMonth(uploadMonth)
    } catch (err) {
      notify(err?.response?.data?.message || '업로드 실패', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSend = async () => {
    if (!selectedMonth) { notify('월을 선택하세요.', 'error'); return }
    if (!window.confirm(`${selectedMonth} 급여명세서를 전체 발송할까요?`)) return
    setSending(true)
    try {
      const res = await sendPayslips(selectedMonth)
      const r = res.data
      if (r.failed > 0) {
        notify(`발송 완료 — ${r.sent}건 성공, ${r.failed}건 실패 (${r.failedNames?.join(', ')})`, 'warn')
      } else {
        notify(`${r.sent}건 발송 완료!`, 'success')
      }
      await loadRecords()
    } catch (err) {
      notify(err?.response?.data?.message || '발송 실패', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleSaveEmail = async (userId) => {
    const email = emailEdits[userId]
    if (!email?.trim()) return
    setSavingEmail(userId)
    try {
      await updateUserEmail(userId, email.trim())
      notify('이메일이 등록되었습니다.', 'success')
    } catch {
      notify('이메일 등록 실패', 'error')
    } finally {
      setSavingEmail(null)
    }
  }

  const msgColor = message.type === 'success'
    ? 'text-emerald-300'
    : message.type === 'error'
      ? 'text-rose-300'
      : message.type === 'warn'
        ? 'text-amber-300'
        : 'text-sky-300'

  return (
    <>
      <PageHeader
        title="임금 지급 내역"
        description="세무사 엑셀 파일을 업로드하고 직원별 급여명세서를 자동 발송합니다."
      />

      {message.text && (
        <div className={`mb-4 rounded-lg border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold ${msgColor}`}>
          {message.text}
        </div>
      )}

      {/* 상단 2열 */}
      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">

        {/* 엑셀 업로드 */}
        <Panel title="엑셀 업로드">
          <form onSubmit={handleUpload} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black text-slate-400">급여 연월 (예: 2026-05)</span>
              <input
                type="month"
                value={uploadMonth}
                onChange={(e) => setUploadMonth(e.target.value)}
                className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black text-slate-400">세무사 엑셀 파일 (.xlsx)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-sky-400"
              />
            </label>
            <button
              type="submit"
              disabled={uploading}
              className="h-11 w-full rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {uploading ? '업로드 중...' : '업로드'}
            </button>
            <p className="text-xs font-bold text-slate-500">
              헤더에 <strong className="text-slate-300">성명(이름)</strong>, 기본급, 국민연금, 실지급액 등 컬럼이 있어야 합니다.
            </p>
          </form>
        </Panel>

        {/* 월 선택 + 발송 */}
        <Panel
          title="급여명세서 발송"
          right={
            <button
              onClick={handleSend}
              disabled={sending || !selectedMonth || records.length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-xs font-black text-white hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              {sending ? '발송 중...' : '전체 발송'}
            </button>
          }
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs font-black text-slate-400">조회 월</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-xs font-bold text-slate-500">
              {records.length}명 · 매월 10일 자동 발송
            </span>
          </div>

          <DataTable
            rows={records}
            rowKey={(row) => row.id}
            columns={[
              { key: 'employeeName', label: '직원', render: (row) => <span className="font-black text-white">{row.employeeName}</span> },
              { key: 'netPay', label: '실수령액', render: (row) => <span className="font-bold text-emerald-300">{fmt(row.netPay)}</span> },
              { key: 'totalPayment', label: '지급합계', render: (row) => fmt(row.totalPayment) },
              { key: 'totalDeduction', label: '공제합계', render: (row) => <span className="text-rose-300">{fmt(row.totalDeduction)}</span> },
              {
                key: 'emailSentAt',
                label: '발송',
                searchable: false,
                render: (row) => row.emailSentAt
                  ? <span className="text-xs font-bold text-emerald-400">{fmtDate(row.emailSentAt)}</span>
                  : <span className="text-xs font-bold text-slate-500">미발송</span>,
              },
            ]}
          />
        </Panel>
      </section>

      {/* 상세 내역 */}
      {records.length > 0 && (
        <Panel title={`${selectedMonth} 급여 상세`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs font-bold text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <th className="py-2 text-left">직원</th>
                  <th className="py-2 text-right">기본급</th>
                  <th className="py-2 text-right">식대</th>
                  <th className="py-2 text-right">교통비</th>
                  <th className="py-2 text-right">기타</th>
                  <th className="py-2 text-right text-sky-300">지급합계</th>
                  <th className="py-2 text-right">국민연금</th>
                  <th className="py-2 text-right">건강+장기</th>
                  <th className="py-2 text-right">고용보험</th>
                  <th className="py-2 text-right">소득세+지방</th>
                  <th className="py-2 text-right text-rose-300">공제합계</th>
                  <th className="py-2 text-right text-emerald-300">실수령액</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 font-black text-white">{row.employeeName}</td>
                    <td className="py-2 text-right">{fmt(row.baseSalary)}</td>
                    <td className="py-2 text-right">{fmt(row.mealAllowance)}</td>
                    <td className="py-2 text-right">{fmt(row.transportAllowance)}</td>
                    <td className="py-2 text-right">{fmt(row.otherAllowance)}</td>
                    <td className="py-2 text-right font-black text-sky-200">{fmt(row.totalPayment)}</td>
                    <td className="py-2 text-right">{fmt(row.deductionNationalPension)}</td>
                    <td className="py-2 text-right">{fmt((Number(row.deductionHealthInsurance) + Number(row.deductionLongTermCare)) || 0)}</td>
                    <td className="py-2 text-right">{fmt(row.deductionEmploymentInsurance)}</td>
                    <td className="py-2 text-right">{fmt((Number(row.deductionIncomeTax) + Number(row.deductionLocalIncomeTax)) || 0)}</td>
                    <td className="py-2 text-right font-black text-rose-300">{fmt(row.totalDeduction)}</td>
                    <td className="py-2 text-right font-black text-emerald-300">{fmt(row.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* 직원 이메일 관리 */}
      <Panel title="직원 이메일 등록" className="mt-6">
        <p className="mb-4 text-xs font-bold text-slate-500">
          급여명세서 발송에 사용될 이메일을 등록하세요. 직원 이름과 급여 데이터의 직원명이 일치해야 자동 매칭됩니다.
        </p>
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <span className="text-sm font-black text-white">{user.display_name}</span>
                <p className="text-[11px] text-slate-500">{user.department || '-'}</p>
              </div>
              <input
                type="email"
                placeholder="이메일 주소"
                value={emailEdits[user.id] ?? (user.email || '')}
                onChange={(e) => setEmailEdits((prev) => ({ ...prev, [user.id]: e.target.value }))}
                className="h-9 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
              />
              <button
                onClick={() => handleSaveEmail(user.id)}
                disabled={savingEmail === user.id}
                className="h-9 rounded-lg bg-sky-400 px-4 text-xs font-black text-slate-950 hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-400"
              >
                {savingEmail === user.id ? '저장 중' : '저장'}
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
