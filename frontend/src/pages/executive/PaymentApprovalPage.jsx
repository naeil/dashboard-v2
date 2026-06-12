import { useEffect, useMemo, useState } from 'react'
import { approvePaymentRequest, getExecutivePaymentRequests, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'
import { count, won } from './formatters'
import { flowTypeClass, flowTypeLabel, paymentStatusClass, paymentStatusLabels, paymentTypeLabels } from './paymentUtils'

function Kpi({ label, value, tone = 'sky' }) {
  const toneMap = {
    neutral: 'border-slate-200 bg-white text-slate-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  }
  return (
    <article className={`rounded-lg border p-5 shadow-sm ${toneMap[tone] || toneMap.sky}`}>
      <p className="text-xs font-black opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
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
        <Kpi label="승인 대기" value={count(pending.length, '건')} tone="neutral" />
        <Kpi label="긴급 요청" value={count(urgent.length, '건')} tone="rose" />
        <Kpi label="대기 출금" value={won(pendingOutflow)} tone="amber" />
        <Kpi label="대기 입금" value={won(pendingInflow)} tone="emerald" />
        <Kpi label="현금 반영" value={count(applied.length, '건')} />
      </section>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {['승인대기', '긴급', '현금반영', 'INFLOW', 'OUTFLOW', '전체'].map((item) => {
          const active = filter === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`h-10 rounded-lg border px-4 text-sm font-black transition-colors ${
                active
                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
              }`}
            >
              {item === 'INFLOW' ? '입금' : item === 'OUTFLOW' ? '출금' : item}
            </button>
          )
        })}
      </div>

      <Panel title="입출금 요청 리스트" right={<span className="text-xs font-black text-slate-500">{filteredRequests.length}건</span>}>
        <DataTable
          rows={filteredRequests}
          rowKey={(row) => row.id}
          columns={[
            { key: 'purpose', label: '사용 목적', render: (row) => <span className="font-black text-slate-950">{row.purpose}</span> },
            { key: 'request_type', label: '유형', render: (row) => paymentTypeLabels[row.request_type] || row.request_type },
            { key: 'flow_type', label: '입출금', render: (row) => <Pill className={flowTypeClass(row.flow_type)}>{flowTypeLabel(row.flow_type)}</Pill> },
            { key: 'amount', label: '금액', render: (row) => <span className="font-black text-slate-950">{won(row.amount)}</span> },
            { key: 'scheduled_date', label: '예정일' },
            { key: 'counterparty', label: '거래처' },
            { key: 'requester_name', label: '요청자' },
            { key: 'expense_category', label: '계정과목' },
            { key: 'status', label: '상태', render: (row) => <Pill className={paymentStatusClass(row.status)}>{paymentStatusLabels[row.status] || row.status}</Pill> },
            { key: 'actions', label: '처리', render: (row) => (
              <div className="flex items-center gap-2">
                {['SUBMITTED', 'REVIEWING'].includes(row.status) && (
                  <>
                    <button type="button" onClick={() => approve(row)} className="h-8 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                      승인/현금반영
                    </button>
                    <button type="button" onClick={() => reject(row)} className="h-8 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100">
                      반려
                    </button>
                  </>
                )}
                {row.status === 'CASH_APPLIED' && (
                  <button type="button" onClick={() => markDone(row)} className="h-8 rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 hover:bg-sky-100">
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
