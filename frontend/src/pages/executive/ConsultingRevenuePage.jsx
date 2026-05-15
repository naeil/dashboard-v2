import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveConsultingRevenues,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { pct, won } from './formatters'

const numberValue = (value) => Number(value || 0)
const roundValue = (value) => Math.round(Number(value || 0) * 100) / 100

const consultingFields = [
  { name: 'client_name', label: '거래처명', required: true },
  { name: 'project_name', label: '프로젝트명', required: true },
  { name: 'consulting_type', label: '컨설팅 유형', type: 'select', options: [
    { value: '사업전략', label: '사업전략' },
    { value: '브랜딩', label: '브랜딩' },
    { value: '마케팅', label: '마케팅' },
    { value: '수출', label: '수출' },
    { value: '운영개선', label: '운영개선' },
    { value: '기타', label: '기타' },
  ] },
  { name: 'status', label: '상태', type: 'select', options: [
    { value: 'LEAD', label: '리드' },
    { value: 'PROPOSAL', label: '제안중' },
    { value: 'CONTRACTED', label: '계약완료' },
    { value: 'IN_PROGRESS', label: '수행중' },
    { value: 'PAID', label: '입금완료' },
    { value: 'CANCELLED', label: '취소' },
  ] },
  { name: 'contract_amount', label: '계약 금액', type: 'number', required: true },
  { name: 'paid_amount', label: '입금 완료 금액', type: 'number' },
  { name: 'expected_payment_date', label: '입금 예정일', type: 'date' },
  { name: 'start_date', label: '시작일', type: 'date' },
  { name: 'end_date', label: '종료일', type: 'date' },
  { name: 'labor_cost', label: '내부 인건비', type: 'number' },
  { name: 'outsourcing_cost', label: '외주비', type: 'number' },
  { name: 'other_cost', label: '기타 비용', type: 'number' },
  { name: 'owner_name', label: '담당자' },
  { name: 'memo', label: '메모', wide: true },
]

const statusLabels = {
  LEAD: '리드',
  PROPOSAL: '제안중',
  CONTRACTED: '계약완료',
  IN_PROGRESS: '수행중',
  PAID: '입금완료',
  CANCELLED: '취소',
}

function computeConsultingValues(values) {
  const contractAmount = numberValue(values.contract_amount)
  const totalCost = numberValue(values.labor_cost) + numberValue(values.outsourcing_cost) + numberValue(values.other_cost)
  const grossProfit = contractAmount - totalCost

  return {
    ...values,
    total_cost: roundValue(totalCost),
    gross_profit: roundValue(grossProfit),
    operating_profit: roundValue(grossProfit),
    operating_margin_rate: contractAmount > 0 ? roundValue((grossProfit / contractAmount) * 100) : 0,
  }
}

function toInitialValues(row) {
  return consultingFields.reduce((acc, field) => {
    acc[field.name] = row?.[field.name] ?? ''
    return acc
  }, {})
}

function MetricCard({ label, value, tone = 'sky' }) {
  const toneMap = {
    sky: 'border-sky-400/20 bg-sky-400/10',
    emerald: 'border-emerald-400/20 bg-emerald-400/10',
    amber: 'border-amber-400/20 bg-amber-400/10',
    rose: 'border-rose-400/20 bg-rose-400/10',
  }
  return (
    <article className={`rounded-lg border p-5 ${toneMap[tone]}`}>
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </article>
  )
}

function ConsultingBarList({ rows }) {
  const max = Math.max(1, ...rows.map((row) => numberValue(row.contract_amount)))
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm font-bold text-slate-500">
          컨설팅 매출 데이터가 없습니다.
        </p>
      ) : rows.slice(0, 8).map((row) => {
        const width = Math.max(6, (numberValue(row.contract_amount) / max) * 100)
        return (
          <div key={row.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{row.project_name}</p>
                <p className="text-xs font-bold text-slate-500">{row.client_name} · {statusLabels[row.status] || row.status}</p>
              </div>
              <span className="shrink-0 text-sm font-black text-sky-100">{won(row.contract_amount)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InputGuideCard() {
  return (
    <div className="mb-6 rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined rounded-lg bg-sky-400/20 p-2 text-sky-100">edit_note</span>
        <div>
          <h2 className="text-sm font-black text-white">컨설팅 프로젝트 매출 입력 기준</h2>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
            계약금액, 입금 완료 금액, 내부 인건비, 외주비, 기타 비용만 입력하면 총 비용, 매출이익, 영업이익, 영업이익률은 자동 계산됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ConsultingRevenuePage() {
  const [rows, setRows] = useState([])
  const [editingRow, setEditingRow] = useState(null)

  const load = () => getExecutiveConsultingRevenues().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const summary = useMemo(() => {
    const contractAmount = rows.reduce((sum, row) => sum + numberValue(row.contract_amount), 0)
    const paidAmount = rows.reduce((sum, row) => sum + numberValue(row.paid_amount), 0)
    const operatingProfit = rows.reduce((sum, row) => sum + numberValue(row.operating_profit), 0)
    const activeCount = rows.filter((row) => !['PAID', 'CANCELLED'].includes(row.status)).length
    return {
      contractAmount,
      paidAmount,
      receivableAmount: Math.max(0, contractAmount - paidAmount),
      operatingProfit,
      operatingMargin: contractAmount > 0 ? (operatingProfit / contractAmount) * 100 : 0,
      activeCount,
    }
  }, [rows])

  return (
    <>
      <PageHeader
        title="컨설팅 매출"
        description="제품 판매와 별도로 컨설팅 프로젝트 매출, 비용, 입금 예정, 영업이익을 직접 입력해 관리합니다."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <MetricCard label="계약 금액" value={won(summary.contractAmount)} />
        <MetricCard label="입금 완료" value={won(summary.paidAmount)} tone="emerald" />
        <MetricCard label="미입금 잔액" value={won(summary.receivableAmount)} tone={summary.receivableAmount > 0 ? 'amber' : 'emerald'} />
        <MetricCard label="영업이익" value={won(summary.operatingProfit)} tone={summary.operatingProfit >= 0 ? 'emerald' : 'rose'} />
        <MetricCard label="진행 건수" value={`${summary.activeCount}건`} tone="sky" />
      </section>

      <InputGuideCard />

      <RecordForm
        key={editingRow?.id || 'new-consulting-revenue'}
        title={editingRow ? '컨설팅 매출 수정' : '컨설팅 매출 입력'}
        modeLabel={editingRow ? `${editingRow.project_name} 수정 중` : '신규 입력'}
        submitLabel={editingRow ? '수정 저장' : '신규 저장'}
        fields={consultingFields}
        initialValues={editingRow ? toInitialValues(editingRow) : { status: 'LEAD', consulting_type: '사업전략' }}
        computeValues={computeConsultingValues}
        onSubmit={async (values) => {
          if (editingRow) await updateExecutiveRecord('consulting-revenues', editingRow.id, values)
          else await createExecutiveRecord('consulting-revenues', values)
          setEditingRow(null)
          await load()
        }}
      />

      {editingRow && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setEditingRow(null)}
            className="h-10 rounded-lg border border-white/10 bg-slate-900 px-4 text-sm font-black text-slate-200 hover:bg-white/5"
          >
            수정 취소
          </button>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="프로젝트별 계약 금액" right={<span className="text-xs font-black text-slate-400">상위 8건</span>}>
          <ConsultingBarList rows={rows} />
        </Panel>
        <Panel title="컨설팅 매출 관리" right={<span className="text-xs font-black text-slate-400">{rows.length}건</span>}>
          <DataTable
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              { key: 'client_name', label: '거래처', render: (row) => <span className="font-black text-white">{row.client_name}</span> },
              { key: 'project_name', label: '프로젝트명' },
              { key: 'consulting_type', label: '유형' },
              { key: 'contract_amount', label: '계약 금액', render: (row) => won(row.contract_amount) },
              { key: 'paid_amount', label: '입금 완료', render: (row) => won(row.paid_amount) },
              { key: 'expected_payment_date', label: '입금 예정일' },
              { key: 'total_cost', label: '총 비용', render: (row) => won(row.total_cost) },
              { key: 'operating_profit', label: '영업이익', render: (row) => won(row.operating_profit) },
              { key: 'operating_margin_rate', label: '이익률', render: (row) => pct(row.operating_margin_rate) },
              { key: 'status', label: '상태', render: (row) => <StatusBadge value={statusLabels[row.status] || row.status} /> },
              { key: 'actions', label: '관리', render: (row) => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRow(row)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="h-8 rounded-md border border-sky-400/30 bg-sky-400/10 px-3 text-xs font-black text-sky-100 hover:bg-sky-400/20"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('이 컨설팅 매출 데이터를 삭제할까요?')) return
                      await deleteExecutiveRecord('consulting-revenues', row.id)
                      await load()
                    }}
                    className="h-8 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-black text-rose-100 hover:bg-rose-400/20"
                  >
                    삭제
                  </button>
                </div>
              ) },
            ]}
          />
        </Panel>
      </section>
    </>
  )
}
