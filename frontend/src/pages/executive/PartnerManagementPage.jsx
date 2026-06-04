import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveReceivables,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import { pct, won } from './formatters'

const partnerTypes = [
  { value: 'PRODUCTION', label: '생산 거래처', icon: 'precision_manufacturing' },
  { value: 'MARKETING', label: '마케팅 거래처', icon: 'campaign' },
  { value: 'SALES', label: '영업 거래처', icon: 'handshake' },
  { value: 'OVERSEAS', label: '해외 거래처', icon: 'public' },
  { value: 'LOGISTICS', label: '물류 거래처', icon: 'local_shipping' },
  { value: 'ETC', label: '기타 거래처', icon: 'business' },
]

const emptyForm = {
  partner_type: 'PRODUCTION',
  partner_name: '',
  business_scope: '',
  manager_name: '',
  owner_name: '',
  contact: '',
  tax_email: '',
  bank_account: '',
  settlement_terms: '',
  country: '',
  contract_status: 'ACTIVE',
  last_contact_date: '',
  invoice_amount: 0,
  paid_amount: 0,
  due_date: '',
  status: 'EXPECTED',
  risk_level: 'NORMAL',
  memo: '',
}

const fieldClass = 'h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none transition-colors focus:border-sky-400'
const textareaClass = 'w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-sky-400'

const typeLabel = (value) => partnerTypes.find((type) => type.value === value)?.label || value || '-'

function Field({ label, children, wide = false }) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-1 block text-xs font-bold text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function SegmentedTabs({ activeTab, setActiveTab }) {
  return (
    <div className="mb-6 inline-flex rounded-lg border border-white/10 bg-slate-900/70 p-1">
      {[
        { id: 'partners', label: '거래처 원장', icon: 'groups' },
        { id: 'receivables', label: '미수금 관리', icon: 'request_quote' },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-black transition-colors ${
            activeTab === tab.id ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-lg">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function PartnerForm({ selected, form, setValue, onSubmit, onReset, message }) {
  return (
    <Panel
      title={selected ? '거래처 정보 수정' : '거래처 등록'}
      right={message ? <span className="text-xs font-black text-emerald-300">{message}</span> : null}
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="거래처 구분">
          <select value={form.partner_type} onChange={(e) => setValue('partner_type', e.target.value)} className={fieldClass}>
            {partnerTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </Field>
        <Field label="계약 상태">
          <select value={form.contract_status} onChange={(e) => setValue('contract_status', e.target.value)} className={fieldClass}>
            <option value="ACTIVE">거래중</option>
            <option value="PENDING">검토중</option>
            <option value="PAUSED">보류</option>
            <option value="ENDED">종료</option>
          </select>
        </Field>
        <Field label="거래처명">
          <input required value={form.partner_name} onChange={(e) => setValue('partner_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="주요 업무/품목">
          <input value={form.business_scope} onChange={(e) => setValue('business_scope', e.target.value)} className={fieldClass} placeholder="예: OEM 생산, 광고 운영, 해외 바이어" />
        </Field>
        <Field label="담당자">
          <input value={form.manager_name} onChange={(e) => setValue('manager_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="내부 담당자">
          <input value={form.owner_name} onChange={(e) => setValue('owner_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="연락처">
          <input value={form.contact} onChange={(e) => setValue('contact', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="세금계산서 이메일">
          <input type="email" value={form.tax_email} onChange={(e) => setValue('tax_email', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="정산 조건">
          <input value={form.settlement_terms} onChange={(e) => setValue('settlement_terms', e.target.value)} className={fieldClass} placeholder="예: 월말 마감 익월 15일" />
        </Field>
        <Field label="계좌 정보">
          <input value={form.bank_account} onChange={(e) => setValue('bank_account', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="국가/지역">
          <input value={form.country} onChange={(e) => setValue('country', e.target.value)} className={fieldClass} placeholder="해외 거래처인 경우 필수 기재" />
        </Field>
        <Field label="마지막 커뮤니케이션">
          <input type="date" value={form.last_contact_date || ''} onChange={(e) => setValue('last_contact_date', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="관리 메모" wide>
          <textarea value={form.memo} onChange={(e) => setValue('memo', e.target.value)} rows="3" className={textareaClass} />
        </Field>
        <div className="flex justify-end gap-2 md:col-span-2">
          {selected && (
            <button type="button" onClick={onReset} className="h-10 rounded-lg border border-white/10 px-5 text-sm font-black text-slate-300 transition-colors hover:bg-white/5">
              신규 등록
            </button>
          )}
          <button type="submit" className="h-10 rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300">
            {selected ? '수정 저장' : '거래처 등록'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

function ReceivableForm({ selected, form, setValue, onSubmit, onReset, message }) {
  return (
    <Panel
      title={selected ? '미수금 수정' : '미수금 입력'}
      right={message ? <span className="text-xs font-black text-emerald-300">{message}</span> : null}
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="거래처명">
          <input required value={form.partner_name} onChange={(e) => setValue('partner_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="거래처 구분">
          <select value={form.partner_type} onChange={(e) => setValue('partner_type', e.target.value)} className={fieldClass}>
            {partnerTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </Field>
        <Field label="청구 금액">
          <input type="number" value={form.invoice_amount} onChange={(e) => setValue('invoice_amount', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="입금 완료 금액">
          <input type="number" value={form.paid_amount} onChange={(e) => setValue('paid_amount', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="입금 예정일">
          <input required type="date" value={form.due_date || ''} onChange={(e) => setValue('due_date', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="상태">
          <select value={form.status} onChange={(e) => setValue('status', e.target.value)} className={fieldClass}>
            <option value="EXPECTED">입금 예정</option>
            <option value="PARTIAL">부분 입금</option>
            <option value="OVERDUE">연체</option>
            <option value="DONE">완료</option>
          </select>
        </Field>
        <Field label="위험도">
          <select value={form.risk_level} onChange={(e) => setValue('risk_level', e.target.value)} className={fieldClass}>
            <option value="NORMAL">정상</option>
            <option value="WATCH">주의</option>
            <option value="HIGH">위험</option>
            <option value="CRITICAL">회수 필요</option>
          </select>
        </Field>
        <Field label="담당자">
          <input value={form.manager_name} onChange={(e) => setValue('manager_name', e.target.value)} className={fieldClass} />
        </Field>
        <div className="flex justify-end gap-2 md:col-span-2">
          {selected && (
            <button type="button" onClick={onReset} className="h-10 rounded-lg border border-white/10 px-5 text-sm font-black text-slate-300 transition-colors hover:bg-white/5">
              신규 입력
            </button>
          )}
          <button type="submit" className="h-10 rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300">
            {selected ? '수정 저장' : '미수금 저장'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

export default function PartnerManagementPage() {
  const [rows, setRows] = useState([])
  const [activeTab, setActiveTab] = useState('partners')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')

  const load = () => getExecutiveReceivables().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const summary = useMemo(() => {
    const totalReceivable = rows.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0)
    const riskCount = rows.filter((row) => ['WATCH', 'HIGH', 'CRITICAL'].includes(row.risk_level)).length
    const typeCounts = partnerTypes.map((type) => ({
      ...type,
      count: rows.filter((row) => (row.partner_type || 'SALES') === type.value).length,
    }))
    return { totalReceivable, riskCount, typeCounts }
  }, [rows])

  const reset = () => {
    setSelected(null)
    setForm(emptyForm)
    setMessage('')
  }

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const selectRow = (row) => {
    setSelected(row)
    setMessage('')
    setForm({
      ...emptyForm,
      ...row,
      partner_type: row.partner_type || 'SALES',
      contract_status: row.contract_status || 'ACTIVE',
      due_date: row.due_date || '',
      last_contact_date: row.last_contact_date || '',
      invoice_amount: row.invoice_amount || 0,
      paid_amount: row.paid_amount || 0,
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      invoice_amount: Number(form.invoice_amount || 0),
      paid_amount: Number(form.paid_amount || 0),
      due_date: form.due_date || new Date().toISOString().slice(0, 10),
    }

    if (selected) {
      await updateExecutiveRecord('receivables', selected.id, payload)
      setMessage(activeTab === 'receivables' ? '미수금 정보가 수정되었습니다.' : '거래처 정보가 수정되었습니다.')
    } else {
      await createExecutiveRecord('receivables', payload)
      setMessage(activeTab === 'receivables' ? '미수금이 등록되었습니다.' : '거래처가 등록되었습니다.')
      setForm(emptyForm)
    }
    await load()
  }

  return (
    <>
      <PageHeader
        title="거래처 관리"
        description="생산, 마케팅, 영업, 해외 거래처를 분류하고 미수금은 별도 영역에서 관리합니다."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="등록 거래처" value={`${rows.length.toLocaleString('ko-KR')}곳`} helperText="전체 거래처 원장" icon="groups" />
        <KpiCard label="총 미수 잔액" value={won(summary.totalReceivable)} helperText="청구 금액 - 입금 완료" tone="rose" icon="request_quote" />
        <KpiCard label="위험 거래처" value={`${summary.riskCount}곳`} helperText="주의 이상 위험도" tone={summary.riskCount ? 'amber' : 'emerald'} icon="gpp_maybe" />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {summary.typeCounts.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => {
              setForm((prev) => ({ ...prev, partner_type: type.value }))
              setActiveTab('partners')
            }}
            className="rounded-lg border border-white/10 bg-slate-900/70 p-4 text-left transition-colors hover:border-sky-400/40 hover:bg-slate-900"
          >
            <span className="material-symbols-outlined text-xl text-sky-300">{type.icon}</span>
            <p className="mt-3 text-xs font-black text-slate-400">{type.label}</p>
            <p className="mt-1 text-xl font-black text-white">{type.count}곳</p>
          </button>
        ))}
      </section>

      <SegmentedTabs activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab)
        reset()
      }} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]">
        {activeTab === 'partners' ? (
          <>
            <PartnerForm selected={selected} form={form} setValue={setValue} onSubmit={submit} onReset={reset} message={message} />
            <Panel title="거래처 원장">
              <DataTable
                rows={rows}
                rowKey={(row) => row.id}
                searchPlaceholder="거래처명, 구분, 담당자, 품목, 국가 검색"
                columns={[
                  { key: 'partner_name', label: '거래처명', render: (row) => <button type="button" onClick={() => selectRow(row)} className="font-black text-sky-100 hover:text-sky-300">{row.partner_name}</button> },
                  { key: 'partner_type', label: '구분', render: (row) => typeLabel(row.partner_type || 'SALES') },
                  { key: 'business_scope', label: '주요 업무/품목', render: (row) => row.business_scope || '-' },
                  { key: 'manager_name', label: '담당자', render: (row) => row.manager_name || '-' },
                  { key: 'owner_name', label: '내부 담당', render: (row) => row.owner_name || '-' },
                  { key: 'contact', label: '연락처', render: (row) => row.contact || '-' },
                  { key: 'settlement_terms', label: '정산 조건', render: (row) => row.settlement_terms || '-' },
                  { key: 'country', label: '국가', render: (row) => row.country || '-' },
                  { key: 'contract_status', label: '계약', render: (row) => <StatusBadge value={row.contract_status || 'ACTIVE'} /> },
                  { key: 'last_contact_date', label: '최근 연락', render: (row) => row.last_contact_date || '-' },
                  {
                    key: 'actions',
                    label: '관리',
                    searchable: false,
                    render: (row) => (
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteExecutiveRecord('receivables', row.id)
                          if (selected?.id === row.id) reset()
                          await load()
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-400/30 px-2 text-xs font-black text-rose-100 transition-colors hover:bg-rose-400/10"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        삭제
                      </button>
                    ),
                  },
                ]}
              />
            </Panel>
          </>
        ) : (
          <>
            <ReceivableForm selected={selected} form={form} setValue={setValue} onSubmit={submit} onReset={reset} message={message} />
            <Panel title="미수금 현황">
              <DataTable
                rows={rows.filter((row) => Number(row.remaining_amount || 0) > 0 || row.status !== 'DONE')}
                rowKey={(row) => row.id}
                searchPlaceholder="거래처, 담당자, 위험도, 메모 검색"
                columns={[
                  { key: 'partner_name', label: '거래처명', render: (row) => <button type="button" onClick={() => selectRow(row)} className="font-black text-sky-100 hover:text-sky-300">{row.partner_name}</button> },
                  { key: 'partner_type', label: '구분', render: (row) => typeLabel(row.partner_type || 'SALES') },
                  { key: 'invoice_amount', label: '청구 금액', render: (row) => won(row.invoice_amount) },
                  { key: 'paid_amount', label: '입금 완료', render: (row) => won(row.paid_amount) },
                  { key: 'remaining_amount', label: '미수 잔액', render: (row) => won(row.remaining_amount) },
                  { key: 'due_date', label: '입금 예정일' },
                  { key: 'overdue_days', label: '연체', render: (row) => `${row.overdue_days || 0}일` },
                  { key: 'recovery_rate', label: '회수율', render: (row) => pct(row.recovery_rate) },
                  { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
                  { key: 'risk_level', label: '위험도', render: (row) => <StatusBadge value={row.risk_level} /> },
                  { key: 'memo', label: '메모', render: (row) => row.memo || '-' },
                ]}
              />
            </Panel>
          </>
        )}
      </section>
    </>
  )
}
