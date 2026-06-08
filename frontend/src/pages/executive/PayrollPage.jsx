import { useEffect, useMemo, useRef, useState } from 'react'
import { calculatePayroll, getPayrollMonths, getPayrollRecords, sendPayslips, uploadPayrollExcel, updateUserEmail } from '../../api/payrollApi'
import { getUsers } from '../../api/authApi'
import { DataTable, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'

const fmt = (val) => val != null ? `${Number(val).toLocaleString('ko-KR')}원` : '-'
const fmtDate = (val) => val ? String(val).replace('T', ' ').slice(0, 16) : '-'
const currentMonth = () => new Date().toISOString().slice(0, 7)

const emptyCalcForm = {
  payYearMonth: currentMonth(),
  employeeName: '',
  userId: '',
  salaryType: 'ANNUAL',
  annualSalary: '',
  hourlyWage: '',
  workDays: 0,
  hoursPerDay: 8,
  mealAllowance: 0,
  transportAllowance: 0,
  otherAllowance: 0,
  nationalPensionRate: 4.5,
  healthInsuranceRate: 3.545,
  longTermCareRate: 12.81,
  employmentInsuranceRate: 0.9,
  incomeTax: 0,
  localIncomeTax: 0,
}

const fieldClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function toNumber(value) {
  return Number(String(value || 0).replaceAll(',', '')) || 0
}

function previewCalculation(form) {
  const workHours = toNumber(form.workDays) * toNumber(form.hoursPerDay)
  const baseSalary = form.salaryType === 'HOURLY'
    ? toNumber(form.hourlyWage) * workHours
    : Math.round(toNumber(form.annualSalary) / 12)
  const totalPayment = baseSalary + toNumber(form.mealAllowance) + toNumber(form.transportAllowance) + toNumber(form.otherAllowance)
  const nationalPension = Math.round(totalPayment * (toNumber(form.nationalPensionRate) / 100))
  const healthInsurance = Math.round(totalPayment * (toNumber(form.healthInsuranceRate) / 100))
  const longTermCare = Math.round(healthInsurance * (toNumber(form.longTermCareRate) / 100))
  const employmentInsurance = Math.round(totalPayment * (toNumber(form.employmentInsuranceRate) / 100))
  const incomeTax = toNumber(form.incomeTax)
  const localIncomeTax = toNumber(form.localIncomeTax)
  const totalDeduction = nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax
  return {
    workHours,
    baseSalary,
    totalPayment,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    totalDeduction,
    netPay: totalPayment - totalDeduction,
  }
}

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState('calculate')
  const [months, setMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState({ text: '', type: 'info' })
  const [uploading, setUploading] = useState(false)
  const [savingPayroll, setSavingPayroll] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadMonth, setUploadMonth] = useState(currentMonth())
  const [calcForm, setCalcForm] = useState(emptyCalcForm)
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

  const preview = useMemo(() => previewCalculation(calcForm), [calcForm])

  const setCalcValue = (key, value) => {
    setCalcForm((prev) => ({ ...prev, [key]: value }))
  }

  const applyUser = (userId) => {
    const user = users.find((item) => String(item.id) === String(userId))
    setCalcForm((prev) => ({
      ...prev,
      userId,
      employeeName: user?.display_name || user?.displayName || user?.username || prev.employeeName,
    }))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) { notify('업로드할 엑셀 파일을 선택하세요.', 'error'); return }
    if (!uploadMonth) { notify('급여 연월을 입력하세요.', 'error'); return }
    setUploading(true)
    try {
      const res = await uploadPayrollExcel(file, uploadMonth)
      const r = res.data
      notify(`업로드 완료: 총 ${r.total}건 중 ${r.imported}건 저장, ${r.skipped}건 중복`, 'success')
      fileInputRef.current.value = ''
      await load()
      setSelectedMonth(uploadMonth)
    } catch (err) {
      notify(err?.response?.data?.message || '업로드에 실패했습니다.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleCalculateSave = async (event) => {
    event.preventDefault()
    if (!calcForm.employeeName.trim()) { notify('직원명을 입력하세요.', 'error'); return }
    if (calcForm.salaryType === 'ANNUAL' && !toNumber(calcForm.annualSalary)) { notify('연봉을 입력하세요.', 'error'); return }
    if (calcForm.salaryType === 'HOURLY' && (!toNumber(calcForm.hourlyWage) || !toNumber(calcForm.workDays) || !toNumber(calcForm.hoursPerDay))) {
      notify('시급, 출근일, 1일 근무시간을 입력하세요.', 'error')
      return
    }
    setSavingPayroll(true)
    try {
      await calculatePayroll({
        ...calcForm,
        workHours: preview.workHours,
      })
      notify('급여명세서가 저장되었습니다.', 'success')
      setSelectedMonth(calcForm.payYearMonth)
      await load()
      await getPayrollRecords(calcForm.payYearMonth).then((res) => setRecords(res.data || []))
    } catch (err) {
      notify(err?.response?.data?.message || '급여 계산 저장에 실패했습니다.', 'error')
    } finally {
      setSavingPayroll(false)
    }
  }

  const handleSend = async () => {
    if (!selectedMonth) { notify('발송할 급여 연월을 선택하세요.', 'error'); return }
    if (!window.confirm(`${selectedMonth} 급여명세서를 전체 발송할까요?`)) return
    setSending(true)
    try {
      const res = await sendPayslips(selectedMonth)
      const r = res.data
      if (r.failed > 0) {
        notify(`발송 완료: ${r.sent}건 성공, ${r.failed}건 실패 (${r.failedNames?.join(', ')})`, 'warn')
      } else {
        notify(`${r.sent}건 발송 완료`, 'success')
      }
      await loadRecords()
    } catch (err) {
      notify(err?.response?.data?.message || '발송에 실패했습니다.', 'error')
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
      notify('이메일이 저장되었습니다.', 'success')
      await load()
    } catch {
      notify('이메일 저장에 실패했습니다.', 'error')
    } finally {
      setSavingEmail(null)
    }
  }

  const msgColor = message.type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : message.type === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : message.type === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-sky-200 bg-sky-50 text-sky-700'

  return (
    <>
      <PageHeader
        title="임금 지급 내역"
        description="연봉제와 시급제 급여명세서를 계산하고, 기존 엑셀 업로드 명세서와 함께 발송합니다."
      />

      {message.text && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${msgColor}`}>
          {message.text}
        </div>
      )}

      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {[
          ['calculate', '급여 계산'],
          ['upload', '엑셀 업로드'],
          ['email', '이메일 관리'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`h-10 rounded-md px-4 text-sm font-black ${activeTab === id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'calculate' && (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]">
          <Panel title="급여명세서 만들기">
            <form onSubmit={handleCalculateSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="급여 연월">
                  <input type="month" value={calcForm.payYearMonth} onChange={(e) => setCalcValue('payYearMonth', e.target.value)} className={fieldClass} />
                </Field>
                <Field label="급여 방식">
                  <select value={calcForm.salaryType} onChange={(e) => setCalcValue('salaryType', e.target.value)} className={fieldClass}>
                    <option value="ANNUAL">연봉제</option>
                    <option value="HOURLY">시급제</option>
                  </select>
                </Field>
              </div>
              <Field label="직원 선택">
                <select value={calcForm.userId} onChange={(e) => applyUser(e.target.value)} className={fieldClass}>
                  <option value="">직접 입력</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.display_name || user.displayName || user.username}</option>
                  ))}
                </select>
              </Field>
              <Field label="직원명">
                <input value={calcForm.employeeName} onChange={(e) => setCalcValue('employeeName', e.target.value)} className={fieldClass} />
              </Field>

              {calcForm.salaryType === 'ANNUAL' ? (
                <Field label="연봉">
                  <input type="number" value={calcForm.annualSalary} onChange={(e) => setCalcValue('annualSalary', e.target.value)} className={fieldClass} placeholder="예: 36000000" />
                </Field>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="시급">
                    <input type="number" value={calcForm.hourlyWage} onChange={(e) => setCalcValue('hourlyWage', e.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="출근일">
                    <input type="number" value={calcForm.workDays} onChange={(e) => setCalcValue('workDays', e.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="1일 시간">
                    <input type="number" value={calcForm.hoursPerDay} onChange={(e) => setCalcValue('hoursPerDay', e.target.value)} className={fieldClass} />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label="식대">
                  <input type="number" value={calcForm.mealAllowance} onChange={(e) => setCalcValue('mealAllowance', e.target.value)} className={fieldClass} />
                </Field>
                <Field label="교통비">
                  <input type="number" value={calcForm.transportAllowance} onChange={(e) => setCalcValue('transportAllowance', e.target.value)} className={fieldClass} />
                </Field>
                <Field label="기타수당">
                  <input type="number" value={calcForm.otherAllowance} onChange={(e) => setCalcValue('otherAllowance', e.target.value)} className={fieldClass} />
                </Field>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-xs font-black text-slate-500">4대보험 요율</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="국민연금 %">
                    <input type="number" step="0.001" value={calcForm.nationalPensionRate} onChange={(e) => setCalcValue('nationalPensionRate', e.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="건강보험 %">
                    <input type="number" step="0.001" value={calcForm.healthInsuranceRate} onChange={(e) => setCalcValue('healthInsuranceRate', e.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="장기요양 %">
                    <input type="number" step="0.001" value={calcForm.longTermCareRate} onChange={(e) => setCalcValue('longTermCareRate', e.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="고용보험 %">
                    <input type="number" step="0.001" value={calcForm.employmentInsuranceRate} onChange={(e) => setCalcValue('employmentInsuranceRate', e.target.value)} className={fieldClass} />
                  </Field>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="소득세">
                  <input type="number" value={calcForm.incomeTax} onChange={(e) => setCalcValue('incomeTax', e.target.value)} className={fieldClass} />
                </Field>
                <Field label="지방소득세">
                  <input type="number" value={calcForm.localIncomeTax} onChange={(e) => setCalcValue('localIncomeTax', e.target.value)} className={fieldClass} />
                </Field>
              </div>

              <button type="submit" disabled={savingPayroll} className="h-11 w-full rounded-lg bg-slate-950 text-sm font-black text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">
                {savingPayroll ? '저장 중...' : '계산 후 명세서 저장'}
              </button>
            </form>
          </Panel>

          <Panel title="계산 결과 미리보기">
            <div className="grid gap-3 md:grid-cols-2">
              <Preview label="근무시간" value={`${preview.workHours.toLocaleString('ko-KR')}시간`} />
              <Preview label="기본급" value={fmt(preview.baseSalary)} />
              <Preview label="지급 합계" value={fmt(preview.totalPayment)} strong />
              <Preview label="국민연금" value={fmt(preview.nationalPension)} tone="rose" />
              <Preview label="건강보험" value={fmt(preview.healthInsurance)} tone="rose" />
              <Preview label="장기요양보험" value={fmt(preview.longTermCare)} tone="rose" />
              <Preview label="고용보험" value={fmt(preview.employmentInsurance)} tone="rose" />
              <Preview label="공제 합계" value={fmt(preview.totalDeduction)} tone="rose" strong />
              <div className="md:col-span-2">
                <Preview label="실제 지급 예상액" value={fmt(preview.netPay)} tone="emerald" strong large />
              </div>
            </div>
            <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
              4대보험 기준 계산이며, 비과세 한도, 보험 상하한, 소득세 간이세액표, 직원별 부양가족 수에 따라 실제 지급액은 달라질 수 있습니다.
            </p>
          </Panel>
        </section>
      )}

      {activeTab === 'upload' && (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
          <Panel title="세무사 엑셀 업로드">
            <form onSubmit={handleUpload} className="space-y-4">
              <Field label="급여 연월">
                <input type="month" value={uploadMonth} onChange={(e) => setUploadMonth(e.target.value)} className={fieldClass} />
              </Field>
              <Field label="급여명세서 엑셀 파일 (.xlsx)">
                <input ref={fileInputRef} type="file" accept=".xlsx" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:border-sky-400" />
              </Field>
              <button type="submit" disabled={uploading} className="h-11 w-full rounded-lg bg-sky-500 px-6 text-sm font-black text-white hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400">
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </form>
          </Panel>

          <PayrollSendPanel selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} records={records} sending={sending} onSend={handleSend} />
        </section>
      )}

      {activeTab === 'email' && (
        <Panel title="직원 이메일 등록">
          <p className="mb-4 text-xs font-bold text-slate-500">
            급여명세서 발송에 사용할 이메일을 등록하세요. 직원 이름과 급여 데이터의 직원명이 일치해야 자동 매칭됩니다.
          </p>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <span className="text-sm font-black text-slate-950">{user.display_name || user.displayName || user.username}</span>
                  <p className="text-[11px] text-slate-500">{user.department || '-'}</p>
                </div>
                <input
                  type="email"
                  placeholder="이메일 주소"
                  value={emailEdits[user.id] ?? (user.email || '')}
                  onChange={(e) => setEmailEdits((prev) => ({ ...prev, [user.id]: e.target.value }))}
                  className={fieldClass}
                />
                <button onClick={() => handleSaveEmail(user.id)} disabled={savingEmail === user.id} className="h-10 rounded-lg bg-sky-500 px-4 text-xs font-black text-white hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400">
                  {savingEmail === user.id ? '저장 중' : '저장'}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <section className="mt-6">
        <PayrollSendPanel selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} records={records} sending={sending} onSend={handleSend} />
      </section>

      {records.length > 0 && (
        <Panel title={`${selectedMonth} 급여 상세`}>
          <DataTable
            rows={records}
            rowKey={(row) => row.id}
            searchPlaceholder="직원명, 급여방식 검색"
            columns={[
              { key: 'employeeName', label: '직원', render: (row) => <span className="font-black text-slate-950">{row.employeeName}</span> },
              { key: 'salaryType', label: '방식', render: (row) => <StatusBadge value={row.salaryType === 'HOURLY' ? '시급제' : row.salaryType === 'ANNUAL' ? '연봉제' : 'EXCEL'} /> },
              { key: 'baseSalary', label: '기본급', render: (row) => fmt(row.baseSalary) },
              { key: 'workHours', label: '근무시간', render: (row) => Number(row.workHours || 0) ? `${Number(row.workHours).toLocaleString('ko-KR')}시간` : '-' },
              { key: 'totalPayment', label: '지급합계', render: (row) => fmt(row.totalPayment) },
              { key: 'totalDeduction', label: '공제합계', render: (row) => <span className="font-bold text-rose-600">{fmt(row.totalDeduction)}</span> },
              { key: 'netPay', label: '실지급액', render: (row) => <span className="font-black text-emerald-600">{fmt(row.netPay)}</span> },
              { key: 'emailSentAt', label: '발송', render: (row) => row.emailSentAt ? fmtDate(row.emailSentAt) : '미발송' },
            ]}
          />
        </Panel>
      )}
    </>
  )
}

function Preview({ label, value, tone = 'slate', strong = false, large = false }) {
  const toneMap = {
    slate: 'text-slate-950',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-1 ${large ? 'text-2xl' : 'text-lg'} ${strong ? 'font-black' : 'font-bold'} ${toneMap[tone]}`}>{value}</p>
    </div>
  )
}

function PayrollSendPanel({ selectedMonth, setSelectedMonth, months, records, sending, onSend }) {
  return (
    <Panel
      title="급여명세서 발송"
      right={
        <button
          onClick={onSend}
          disabled={sending || !selectedMonth || records.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-xs font-black text-white hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          {sending ? '발송 중...' : '전체 발송'}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-black text-slate-500">조회 월</span>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={fieldClass}>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-xs font-bold text-slate-500">{records.length}명</span>
      </div>
      <DataTable
        rows={records}
        rowKey={(row) => row.id}
        columns={[
          { key: 'employeeName', label: '직원', render: (row) => <span className="font-black text-slate-950">{row.employeeName}</span> },
          { key: 'netPay', label: '실지급액', render: (row) => <span className="font-bold text-emerald-600">{fmt(row.netPay)}</span> },
          { key: 'totalPayment', label: '지급합계', render: (row) => fmt(row.totalPayment) },
          { key: 'totalDeduction', label: '공제합계', render: (row) => <span className="text-rose-600">{fmt(row.totalDeduction)}</span> },
          { key: 'emailSentAt', label: '발송', render: (row) => row.emailSentAt ? fmtDate(row.emailSentAt) : '미발송' },
        ]}
      />
    </Panel>
  )
}
