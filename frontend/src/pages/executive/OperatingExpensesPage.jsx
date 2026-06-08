import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveOperatingExpenses,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { won } from './formatters'

const expenseCategories = [
  '인건비',
  '4대보험',
  '임대료',
  '차량 유지비',
  '식대',
  '통신비',
  '세탁비',
  '광고비',
  '물류비',
  '외주비',
  '생산비',
  '기타 비용',
]

const fields = [
  { name: 'expense_month', label: '기준월', type: 'date', required: true },
  { name: 'category', label: '비용 항목', type: 'select', required: true, options: expenseCategories.map((value) => ({ value, label: value })) },
  { name: 'expense_type', label: '구분', type: 'select', required: true, options: [
    { value: 'FIXED', label: '고정비' },
    { value: 'VARIABLE', label: '변동비' },
  ] },
  { name: 'amount', label: '금액', type: 'number', required: true },
  { name: 'payment_date', label: '지급일', type: 'date' },
  { name: 'vendor', label: '지급처' },
  { name: 'memo', label: '메모', wide: true },
]

const toInitialValues = (row) => ({
  expense_month: String(row.expense_month || '').slice(0, 10),
  category: row.category || '',
  expense_type: row.expense_type || 'FIXED',
  amount: row.amount || '',
  payment_date: String(row.payment_date || '').slice(0, 10),
  vendor: row.vendor || '',
  memo: row.memo || '',
})

const dateText = (value) => String(value || '').slice(0, 10)

export default function OperatingExpensesPage() {
  const [rows, setRows] = useState([])
  const [editingRow, setEditingRow] = useState(null)

  const load = () => getExecutiveOperatingExpenses().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const totals = useMemo(() => rows.reduce(
    (acc, row) => {
      acc.total += Number(row.amount || 0)
      acc[row.expense_type === 'FIXED' ? 'fixed' : 'variable'] += Number(row.amount || 0)
      return acc
    },
    { total: 0, fixed: 0, variable: 0 },
  ), [rows])

  return (
    <>
      <PageHeader title="운영 비용" description="고정비와 변동비를 검색하고, 항목별 금액과 지급일을 수정합니다." />
      <RecordForm
        key={editingRow?.id || 'new-operating-expense'}
        title={editingRow ? '운영 비용 수정' : '운영 비용 입력'}
        fields={fields}
        initialValues={editingRow ? toInitialValues(editingRow) : { expense_type: 'FIXED' }}
        submitLabel={editingRow ? '수정 저장' : '저장'}
        modeLabel={editingRow ? `${editingRow.category} 수정 중` : undefined}
        onSubmit={async (values) => {
          if (editingRow) {
            await updateExecutiveRecord('operating-expenses', editingRow.id, values)
            setEditingRow(null)
          } else {
            await createExecutiveRecord('operating-expenses', values)
          }
          await load()
        }}
      />
      {editingRow && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setEditingRow(null)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-slate-200 transition-colors hover:bg-white/10"
          >
            수정 취소
          </button>
        </div>
      )}
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="이번 달 총비용" value={won(totals.total)} tone="rose" icon="receipt_long" />
        <KpiCard label="고정비" value={won(totals.fixed)} tone="amber" icon="lock" />
        <KpiCard label="변동비" value={won(totals.variable)} icon="sync_alt" />
      </section>
      <Panel title="비용 항목별 상세">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          searchPlaceholder="비용 항목, 지급처, 메모 검색"
          columns={[
            { key: 'category', label: '비용 항목' },
            { key: 'expense_type', label: '구분', render: (row) => (row.expense_type === 'FIXED' ? '고정비' : '변동비') },
            { key: 'amount', label: '금액', render: (row) => won(row.amount) },
            {
              key: 'payment_date',
              label: '지급일',
              render: (row) => (
                <div className="flex items-center gap-2">
                  <span>{dateText(row.payment_date)}</span>
                  {row.recurrence_status === 'RECURRING' && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-700">
                      매월 반복
                    </span>
                  )}
                </div>
              ),
            },
            { key: 'vendor', label: '지급처' },
            { key: 'memo', label: '메모' },
            {
              key: 'actions',
              label: '관리',
              searchable: false,
              render: (row) => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRow(row)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-400/30 px-2 text-xs font-black text-sky-100 transition-colors hover:bg-sky-400/10"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteExecutiveRecord('operating-expenses', row.id)
                      if (editingRow?.id === row.id) setEditingRow(null)
                      await load()
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-400/30 px-2 text-xs font-black text-rose-100 transition-colors hover:bg-rose-400/10"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    삭제
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </>
  )
}
