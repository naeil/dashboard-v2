import { useEffect, useMemo, useState } from 'react'
import { createExecutiveRecord, getExecutivePaymentRequests, getExecutiveProductForecasts } from '../../api/executiveApi'
import { PageHeader, Panel } from './ExecutiveComponents'
import { count, won } from './formatters'
import { flowTypeClass, flowTypeLabel, paymentStatusClass, paymentStatusLabels, paymentTypeLabels } from './paymentUtils'

const requestTypes = Object.keys(paymentTypeLabels)
const expenseCategories = ['광고비', '생산비', '원료비', '외주비', '물류비', '급여/수당', '세금/공과금', '비품', '운영비', '입금예정', '기타']

function Pill({ className, children }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{children}</span>
}

function Field({ label, children, wide = false }) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-2 block text-xs font-black text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export default function PaymentRequestPage({ username = 'admin' }) {
  const today = new Date().toISOString().slice(0, 10)
  const [requests, setRequests] = useState([])
  const [products, setProducts] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    request_type: 'EXPENSE_APPROVAL',
    flow_type: 'OUTFLOW',
    project_name: '',
    linked_product_name: '',
    counterparty: '',
    requester_name: username,
    department: '',
    amount: '',
    request_date: today,
    scheduled_date: today,
    account_name: '',
    purpose: '',
    detail_reason: '',
    evidence_url: '',
    expense_category: '운영비',
    urgent: false,
    status: 'SUBMITTED',
  })

  const load = async () => {
    const [requestRes, productRes] = await Promise.all([getExecutivePaymentRequests(), getExecutiveProductForecasts()])
    setRequests(requestRes.data || [])
    setProducts(productRes.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const myRequests = useMemo(() => (
    requests.filter((request) => (request.requester_name || '').toLowerCase() === (username || '').toLowerCase())
  ), [requests, username])

  const pendingAmount = myRequests
    .filter((request) => ['SUBMITTED', 'REVIEWING'].includes(request.status))
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    await createExecutiveRecord('payment-requests', {
      ...form,
      requester_name: form.requester_name || username,
      amount: Number(form.amount || 0),
      status: 'SUBMITTED',
    })
    setMessage('입출금 요청이 제출되었습니다.')
    setForm((prev) => ({
      ...prev,
      counterparty: '',
      amount: '',
      purpose: '',
      detail_reason: '',
      evidence_url: '',
      urgent: false,
      status: 'SUBMITTED',
    }))
    await load()
  }

  return (
    <>
      <PageHeader title="입출금 요청" description="직원이 지출결의서, 광고비, 생산비, 입금 예정 내역을 제출합니다. 승인되면 현금흐름에 반영됩니다." />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-slate-900/70 p-5">
          <p className="text-xs font-black text-slate-400">내 요청</p>
          <p className="mt-3 text-2xl font-black text-white">{count(myRequests.length, '건')}</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-xs font-black text-slate-400">승인 대기 금액</p>
          <p className="mt-3 text-2xl font-black text-white">{won(pendingAmount)}</p>
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
          <p className="text-xs font-black text-slate-400">현금 반영</p>
          <p className="mt-3 text-2xl font-black text-white">{count(myRequests.filter((request) => request.status === 'CASH_APPLIED').length, '건')}</p>
        </div>
        <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-5">
          <p className="text-xs font-black text-slate-400">반려/보류</p>
          <p className="mt-3 text-2xl font-black text-white">{count(myRequests.filter((request) => ['REJECTED', 'HOLD'].includes(request.status)).length, '건')}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_440px]">
        <Panel title="입출금 요청 작성" right={message ? <span className="text-xs font-black text-emerald-300">{message}</span> : null}>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="요청 유형">
              <select value={form.request_type} onChange={(e) => setValue('request_type', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400">
                {requestTypes.map((type) => <option key={type} value={type}>{paymentTypeLabels[type]}</option>)}
              </select>
            </Field>
            <Field label="입금 / 출금">
              <select value={form.flow_type} onChange={(e) => setValue('flow_type', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400">
                <option value="OUTFLOW">출금</option>
                <option value="INFLOW">입금</option>
              </select>
            </Field>
            <Field label="프로젝트명">
              <input value={form.project_name} onChange={(e) => setValue('project_name', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <Field label="관련 제품">
              <select value={form.linked_product_name} onChange={(e) => setValue('linked_product_name', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400">
                <option value="">없음</option>
                {products.map((product) => <option key={product.id} value={product.product_name}>{product.product_name}</option>)}
              </select>
            </Field>
            <Field label="거래처 / 지급처">
              <input required value={form.counterparty} onChange={(e) => setValue('counterparty', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <Field label="금액">
              <input required type="number" value={form.amount} onChange={(e) => setValue('amount', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <Field label="예정일">
              <input required type="date" value={form.scheduled_date} onChange={(e) => setValue('scheduled_date', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <Field label="계정과목">
              <select value={form.expense_category} onChange={(e) => setValue('expense_category', e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400">
                {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="사용 목적" wide>
              <input required value={form.purpose} onChange={(e) => setValue('purpose', e.target.value)} placeholder="예: 하이프리 네이버 광고비 집행" className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <Field label="상세 사유" wide>
              <textarea value={form.detail_reason} onChange={(e) => setValue('detail_reason', e.target.value)} rows="3" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <Field label="증빙 링크" wide>
              <input value={form.evidence_url} onChange={(e) => setValue('evidence_url', e.target.value)} placeholder="견적서, 세금계산서, 캡처 링크" className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </Field>
            <label className="flex items-center gap-3 md:col-span-2">
              <input type="checkbox" checked={form.urgent} onChange={(e) => setValue('urgent', e.target.checked)} className="h-4 w-4 rounded border-slate-500 accent-sky-300" />
              <span className="text-sm font-black text-slate-300">긴급 요청</span>
            </label>
            <div className="flex justify-end md:col-span-2">
              <button type="submit" className="h-11 rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 hover:bg-sky-300">제출</button>
            </div>
          </form>
        </Panel>

        <Panel title="내 요청 현황" right={<span className="text-xs font-black text-slate-400">{username}</span>}>
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm font-bold text-slate-500">제출한 요청이 없습니다.</p>
            ) : myRequests.slice(0, 8).map((request) => (
              <article key={request.id} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{request.purpose}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{request.scheduled_date} · {request.counterparty}</p>
                  </div>
                  <Pill className={paymentStatusClass(request.status)}>{paymentStatusLabels[request.status] || request.status}</Pill>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Pill className={flowTypeClass(request.flow_type)}>{flowTypeLabel(request.flow_type)}</Pill>
                  <p className="text-sm font-black text-white">{won(request.amount)}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </section>
    </>
  )
}
