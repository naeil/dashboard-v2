import { useEffect, useState } from 'react'
import { createExecutiveRecord, getExecutiveDebts } from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { pct, won } from './formatters'

export default function DebtPage() {
  const [rows, setRows] = useState([])

  const load = () => getExecutiveDebts().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const debtTotal = rows.reduce((sum, row) => sum + Number(row.principal_balance || 0), 0)
  const monthlyPayment = rows.reduce((sum, row) => sum + Number(row.monthly_payment || 0), 0)

  return (
    <>
      <PageHeader title="대출 / 부채" description="대출 잔액, 이자율, 다음 상환일과 월 원리금을 관리합니다." />
      <RecordForm
        title="대출 / 부채 입력"
        fields={[
          { name: 'lender', label: '금융기관', required: true },
          { name: 'loan_name', label: '대출명', required: true },
          { name: 'principal_balance', label: '대출 잔액', type: 'number', required: true },
          { name: 'interest_rate', label: '이자율', type: 'number', required: true },
          { name: 'monthly_payment', label: '월 상환액', type: 'number', required: true },
          { name: 'next_payment_date', label: '다음 상환일', type: 'date', required: true },
          { name: 'maturity_date', label: '만기일', type: 'date' },
          { name: 'status', label: '상태', type: 'select', options: [
            { value: 'NORMAL', label: '정상' },
            { value: 'WATCH', label: '주의' },
            { value: 'HIGH', label: '위험' },
          ] },
        ]}
        initialValues={{ status: 'NORMAL' }}
        onSubmit={async (values) => {
          await createExecutiveRecord('debts', values)
          await load()
        }}
      />
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard label="현재 대출 잔액" value={won(debtTotal)} tone="amber" icon="credit_score" />
        <KpiCard label="월 상환 예정액" value={won(monthlyPayment)} tone="rose" icon="event_repeat" />
      </section>
      <Panel title="대출 상세">
        <DataTable
          rows={rows}
          columns={[
            { key: 'lender', label: '금융기관' },
            { key: 'loan_name', label: '대출명' },
            { key: 'principal_balance', label: '잔액', render: (row) => won(row.principal_balance) },
            { key: 'interest_rate', label: '이자율', render: (row) => pct(row.interest_rate) },
            { key: 'monthly_payment', label: '월 상환액', render: (row) => won(row.monthly_payment) },
            { key: 'next_payment_date', label: '다음 상환일' },
            { key: 'maturity_date', label: '만기일' },
            { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
          ]}
        />
      </Panel>
    </>
  )
}
