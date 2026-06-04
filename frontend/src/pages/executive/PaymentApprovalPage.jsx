import { useEffect, useMemo, useState } from 'react'
import { approvePaymentRequest, getExecutivePaymentRequests, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'
import { count, won } from './formatters'
import { flowTypeClass, flowTypeLabel, paymentStatusClass, paymentStatusLabels, paymentTypeLabels } from './paymentUtils'

function Kpi({ label, value, tone = 'sky' }) {
  const toneMap = {
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  }
  return (
    <article className={`rounded-lg border p-5 ${toneMap[tone]}`}>
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </article>
  )
}

function Pill({ className, children }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{children}</span>
}

export default function PaymentApprovalPage() {
  const [requests, setRequests] = useState([])
  const [filter, setFilter] = useState('승인대기')

  const load = () => getExecutivePaymentRequests().then((res) => setRequests(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const pending = requests.filter((request) => ['SUBMITTED', 'REVIEWING'].includes(request.status))
  const applied = requests.filter((request) => request.status === 'CASH_APPLIED')
  const urgent = pending.filter((request) => request.urgent)
  const pendingOutflow = pending.filter((request) => request.flow_type === 'OUTFLOW').reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const pendingInflow = pending.filter((request) => request.flow_type === 'INFLOW').reduce((sum, request) => sum + Number(request.amount || 0), 0)

  const filteredRequests = useMemo(() => {
    if (filter === '전체') return requests
    if (filter === '승인대기') return pending
    if (filter === '긴급') return urgent
    if (filter === '현금반영') return applied
    return requests.filter((request) => request.flow_type === filter)
  }, [requests, filter])

  const approve = async (request) => {
    await approvePaymentRequest(request.id)
    await load()
  }

  const reject = async (request) => {
    await updateExecutiveRecord('payment-requests', request.id, {
      status: 'REJECTED',
      review_comment: '반려되었습니다.',
    })
    await load()
  }

  const markDone = async (request) => {
    const doneStatus = request.flow_type === 'INFLOW' ? 'RECEIVED' : 'PAID'
    await updateExecutiveRecord('payment-requests', request.id, { status: doneStatus })
    if (request.cash_flow_id) {
      await updateExecutiveRecord('cash-flows', request.cash_flow_id, { status: 'DONE' })
    }
    await load()
  }

  return (
    <>
      <PageHeader title="입출금 결재 관리" description="직원이 제출한 지출결의서와 입금/출금 요청을 승인하고, 승인 즉시 현금흐름에 반영합니다." />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <Kpi label="승인 대기" value={count(pending.length, '건')} tone={pending.length > 0 ? 'amber' : 'emerald'} />
        <Kpi label="긴급 요청" value={count(urgent.length, '건')} tone={urgent.length > 0 ? 'rose' : 'emerald'} />
        <Kpi label="대기 출금" value={won(pendingOutflow)} tone={pendingOutflow > 0 ? 'rose' : 'emerald'} />
        <Kpi label="대기 입금" value={won(pendingInflow)} tone="emerald" />
        <Kpi label="현금 반영" value={count(applied.length, '건')} />
      </section>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-4">
        {['승인대기', '긴급', '현금반영', 'INFLOW', 'OUTFLOW', '전체'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`h-10 rounded-lg border px-4 text-sm font-black ${filter === item ? 'border-sky-400/40 bg-sky-400/15 text-sky-100' : 'border-white/10 bg-slate-950 text-slate-400 hover:bg-white/5'}`}
          >
            {item === 'INFLOW' ? '입금' : item === 'OUTFLOW' ? '출금' : item}
          </button>
        ))}
      </div>

      <Panel title="입출금 요청 리스트" right={<span className="text-xs font-black text-slate-400">{filteredRequests.length}건</span>}>
        <DataTable
          rows={filteredRequests}
          rowKey={(row) => row.id}
          columns={[
            { key: 'purpose', label: '사용 목적', render: (row) => <span className="font-black text-white">{row.purpose}</span> },
            { key: 'request_type', label: '유형', render: (row) => paymentTypeLabels[row.request_type] || row.request_type },
            { key: 'flow_type', label: '입출금', render: (row) => <Pill className={flowTypeClass(row.flow_type)}>{flowTypeLabel(row.flow_type)}</Pill> },
            { key: 'amount', label: '금액', render: (row) => <span className="font-black text-white">{won(row.amount)}</span> },
            { key: 'scheduled_date', label: '예정일' },
            { key: 'counterparty', label: '거래처' },
            { key: 'requester_name', label: '요청자' },
            { key: 'expense_category', label: '계정과목' },
            { key: 'status', label: '상태', render: (row) => <Pill className={paymentStatusClass(row.status)}>{paymentStatusLabels[row.status] || row.status}</Pill> },
            { key: 'actions', label: '처리', render: (row) => (
              <div className="flex items-center gap-2">
                {['SUBMITTED', 'REVIEWING'].includes(row.status) && (
                  <>
                    <button type="button" onClick={() => approve(row)} className="h-8 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-black text-emerald-100 hover:bg-emerald-400/20">
                      승인/현금반영
                    </button>
                    <button type="button" onClick={() => reject(row)} className="h-8 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-black text-rose-100 hover:bg-rose-400/20">
                      반려
                    </button>
                  </>
                )}
                {row.status === 'CASH_APPLIED' && (
                  <button type="button" onClick={() => markDone(row)} className="h-8 rounded-md border border-sky-400/30 bg-sky-400/10 px-3 text-xs font-black text-sky-100 hover:bg-sky-400/20">
                    지급/입금 완료
                  </button>
                )}
              </div>
            ) },
          ]}
        />
      </Panel>
    </>
  )
}
