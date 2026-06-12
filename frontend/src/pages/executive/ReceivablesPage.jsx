import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveReceivables,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { pct, won } from './formatters'

const fields = [
  { name: 'partner_name', label: '거래처명', required: true },
  { name: 'manager_name', label: '담당자' },
  { name: 'contact', label: '연락처' },
  { name: 'invoice_amount', label: '청구 금액', type: 'number', required: true },
  { name: 'paid_amount', label: '입금 완료 금액', type: 'number' },
  { name: 'due_date', label: '입금 예정일', type: 'date', required: true },
  { name: 'status', label: '상태', type: 'select', options: [
    { value: 'EXPECTED', label: '입금 예정' },
    { value: 'PARTIAL', label: '부분 입금' },
    { value: 'OVERDUE', label: '연체' },
  ] },
  { name: 'risk_level', label: '위험도', type: 'select', options: [
    { value: 'NORMAL', label: '정상' },
    { value: 'WATCH', label: '주의' },
    { value: 'HIGH', label: '위험' },
    { value: 'CRITICAL', label: '회수 필요' },
  ] },
  { name: 'memo', label: '메모', wide: true },
]

const toInitialValues = (row) => ({
  partner_name: row.partner_name || '',
  manager_name: row.manager_name || '',
  contact: row.contact || '',
  invoice_amount: row.invoice_amount || '',
  paid_amount: row.paid_amount || 0,
  due_date: String(row.due_date || '').slice(0, 10),
  status: row.status || 'EXPECTED',
  risk_level: row.risk_level || 'NORMAL',
  memo: row.memo || '',
})

export default function ReceivablesPage() {
  const [rows, setRows] = useState([])
  const [editingRow, setEditingRow] = useState(null)

  const load = () => getExecutiveReceivables().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0), [rows])
  const risky = rows.filter((row) => ['HIGH', 'CRITICAL'].includes(row.risk_level)).length

  return (
    <>
      <PageHeader title="미수금 관리" description="거래처, 담당자, 위험도를 검색하고 미수금 상태를 수정합니다." />
      <RecordForm
        key={editingRow?.id || 'new-receivable'}
        title={editingRow ? '미수금 수정' : '미수금 입력'}
        fields={fields}
        initialValues={editingRow ? toInitialValues(editingRow) : { paid_amount: 0, status: 'EXPECTED', risk_level: 'NORMAL' }}
        submitLabel={editingRow ? '수정 저장' : '저장'}
        modeLabel={editingRow ? `${editingRow.partner_name} 수정 중` : undefined}
        onSubmit={async (values) => {
          if (editingRow) {
            await updateExecutiveRecord('receivables', editingRow.id, values)
            setEditingRow(null)
          } else {
            await createExecutiveRecord('receivables', values)
          }
          await load()
        }}
      />
      {editingRow && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setEditingRow(null)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50"
          >
            수정 취소
          </button>
        </div>
      )}
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="미수금 총액" value={won(total)} tone="rose" icon="request_quote" />
        <KpiCard label="위험 거래처" value={`${risky}곳`} badge={risky > 0 ? 'HIGH' : 'NORMAL'} tone="amber" icon="gpp_maybe" />
        <KpiCard label="관리 거래처" value={`${rows.length}곳`} icon="groups" />
      </section>
      <Panel title="거래처별 미수금 현황">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          searchPlaceholder="거래처, 담당자, 연락처, 메모 검색"
          columns={[
            { key: 'partner_name', label: '거래처명' },
            { key: 'manager_name', label: '담당자' },
            { key: 'contact', label: '연락처' },
            { key: 'invoice_amount', label: '청구 금액', render: (row) => won(row.invoice_amount) },
            { key: 'paid_amount', label: '입금 완료', render: (row) => won(row.paid_amount) },
            { key: 'remaining_amount', label: '미수 잔액', render: (row) => won(row.remaining_amount) },
            { key: 'due_date', label: '입금 예정일' },
            { key: 'overdue_days', label: '연체 일수', render: (row) => `${row.overdue_days}일` },
            { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'risk_level', label: '위험도', render: (row) => <StatusBadge value={row.risk_level} /> },
            { key: 'recovery_rate', label: '회수율', render: (row) => pct(row.recovery_rate) },
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
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-black text-sky-700 transition-colors hover:bg-sky-100"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteExecutiveRecord('receivables', row.id)
                      if (editingRow?.id === row.id) setEditingRow(null)
                      await load()
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-black text-rose-700 transition-colors hover:bg-rose-100"
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
