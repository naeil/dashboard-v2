import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutivePartners,
  getExecutiveReceivables,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import { pct, won } from './formatters'

const partnerTypes = [
  { value: 'PRODUCTION', label: '제조사', icon: 'precision_manufacturing' },
  { value: 'MARKETING', label: '마케팅/브랜드', icon: 'campaign' },
  { value: 'SALES', label: '유통/벤더', icon: 'handshake' },
  { value: 'OVERSEAS', label: '해외 거래처', icon: 'public' },
  { value: 'LOGISTICS', label: '물류사', icon: 'local_shipping' },
  { value: 'ETC', label: '파트너/지원', icon: 'business' },
]

const emptyPartner = {
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
  memo: '',
}

const emptyReceivable = {
  partner_id: '',
  partner_name: '',
  partner_type: 'SALES',
  manager_name: '',
  contact: '',
  invoice_amount: 0,
  paid_amount: 0,
  due_date: '',
  status: 'EXPECTED',
  risk_level: 'NORMAL',
  memo: '',
}

const fieldClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
const textareaClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
const today = () => new Date().toISOString().slice(0, 10)
const typeLabel = (value) => partnerTypes.find((type) => type.value === value)?.label || value || '-'

function Field({ label, children, wide = false }) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-1 block text-xs font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function SegmentedTabs({ activeTab, setActiveTab }) {
  return (
    <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {[
        { id: 'partners', label: '거래처 원장', icon: 'groups' },
        { id: 'receivables', label: '미수금 관리', icon: 'request_quote' },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-black transition-colors ${
            activeTab === tab.id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
          }`}
        >
          <span className="material-symbols-outlined text-lg">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function PartnerForm({ selected, form, setValue, onSubmit, onReset, onDelete, message }) {
  return (
    <Panel
      title={selected ? '거래처 정보 수정' : '거래처 등록'}
      right={message ? <span className="text-xs font-black text-emerald-600">{message}</span> : null}
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="거래처 구분">
          <select value={form.partner_type} onChange={(e) => setValue('partner_type', e.target.value)} className={fieldClass}>
            {partnerTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </Field>
        <Field label="거래 상태">
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
        <Field label="주요업무/품목">
          <input value={form.business_scope || ''} onChange={(e) => setValue('business_scope', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="담당자">
          <input value={form.manager_name || ''} onChange={(e) => setValue('manager_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="내부담당">
          <input value={form.owner_name || ''} onChange={(e) => setValue('owner_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="연락처">
          <input value={form.contact || ''} onChange={(e) => setValue('contact', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="이메일">
          <input type="email" value={form.tax_email || ''} onChange={(e) => setValue('tax_email', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="정산 조건">
          <input value={form.settlement_terms || ''} onChange={(e) => setValue('settlement_terms', e.target.value)} className={fieldClass} placeholder="예: 월말 마감 익월 15일" />
        </Field>
        <Field label="계좌 정보">
          <input value={form.bank_account || ''} onChange={(e) => setValue('bank_account', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="국가/지역">
          <input value={form.country || ''} onChange={(e) => setValue('country', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="최근 연락일">
          <input type="date" value={String(form.last_contact_date || '').slice(0, 10)} onChange={(e) => setValue('last_contact_date', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="관리 메모" wide>
          <textarea value={form.memo || ''} onChange={(e) => setValue('memo', e.target.value)} rows="3" className={textareaClass} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
          {selected && (
            <button type="button" onClick={onDelete} className="h-10 rounded-lg border border-rose-200 px-4 text-sm font-black text-rose-600 transition-colors hover:bg-rose-50">
              삭제
            </button>
          )}
          {selected && (
            <button type="button" onClick={onReset} className="h-10 rounded-lg border border-slate-200 px-5 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50">
              신규 등록
            </button>
          )}
          <button type="submit" className="h-10 rounded-lg bg-slate-950 px-6 text-sm font-black text-white transition-colors hover:bg-slate-800">
            {selected ? '수정 저장' : '거래처 등록'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

function ReceivableForm({ selected, form, setValue, onSubmit, onReset, partners, message }) {
  const applyPartner = (partnerId) => {
    const partner = partners.find((item) => String(item.id) === String(partnerId))
    setValue('partner_id', partnerId)
    if (partner) {
      setValue('partner_name', partner.partner_name || '')
      setValue('partner_type', partner.partner_type || 'SALES')
      setValue('manager_name', partner.manager_name || '')
      setValue('contact', partner.contact || '')
    }
  }

  return (
    <Panel
      title={selected ? '미수금 정보 수정' : '미수금 입력'}
      right={message ? <span className="text-xs font-black text-emerald-600">{message}</span> : null}
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="거래처 선택">
          <select value={form.partner_id || ''} onChange={(e) => applyPartner(e.target.value)} className={fieldClass}>
            <option value="">직접 입력</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.partner_name}</option>)}
          </select>
        </Field>
        <Field label="거래처명">
          <input required value={form.partner_name} onChange={(e) => setValue('partner_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="청구 금액">
          <input type="number" value={form.invoice_amount} onChange={(e) => setValue('invoice_amount', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="입금 완료 금액">
          <input type="number" value={form.paid_amount} onChange={(e) => setValue('paid_amount', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="입금 예정일">
          <input required type="date" value={String(form.due_date || '').slice(0, 10)} onChange={(e) => setValue('due_date', e.target.value)} className={fieldClass} />
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
          <input value={form.manager_name || ''} onChange={(e) => setValue('manager_name', e.target.value)} className={fieldClass} />
        </Field>
        <Field label="메모" wide>
          <textarea value={form.memo || ''} onChange={(e) => setValue('memo', e.target.value)} rows="3" className={textareaClass} />
        </Field>
        <div className="flex justify-end gap-2 md:col-span-2">
          {selected && (
            <button type="button" onClick={onReset} className="h-10 rounded-lg border border-slate-200 px-5 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50">
              신규 입력
            </button>
          )}
          <button type="submit" className="h-10 rounded-lg bg-slate-950 px-6 text-sm font-black text-white transition-colors hover:bg-slate-800">
            {selected ? '수정 저장' : '미수금 저장'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

export default function PartnerManagementPage() {
  const [partners, setPartners] = useState([])
  const [receivables, setReceivables] = useState([])
  const [activeTab, setActiveTab] = useState('partners')
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [selectedReceivable, setSelectedReceivable] = useState(null)
  const [partnerForm, setPartnerForm] = useState(emptyPartner)
  const [receivableForm, setReceivableForm] = useState({ ...emptyReceivable, due_date: today() })
  const [message, setMessage] = useState('')

  const load = async () => {
    const [partnerRes, receivableRes] = await Promise.all([getExecutivePartners(), getExecutiveReceivables()])
    setPartners(partnerRes.data || [])
    setReceivables(receivableRes.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const visibleReceivables = useMemo(() => (
    receivables.filter((row) => Number(row.remaining_amount || 0) > 0 || row.status !== 'DONE')
  ), [receivables])

  const summary = useMemo(() => {
    const totalReceivable = receivables.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0)
    const riskCount = receivables.filter((row) => ['WATCH', 'HIGH', 'CRITICAL'].includes(row.risk_level)).length
    const typeCounts = partnerTypes.map((type) => ({
      ...type,
      count: partners.filter((row) => (row.partner_type || 'SALES') === type.value).length,
    }))
    return { totalReceivable, riskCount, typeCounts }
  }, [partners, receivables])

  const resetPartner = () => {
    setSelectedPartner(null)
    setPartnerForm(emptyPartner)
    setMessage('')
  }

  const resetReceivable = () => {
    setSelectedReceivable(null)
    setReceivableForm({ ...emptyReceivable, due_date: today() })
    setMessage('')
  }

  const setPartnerValue = (key, value) => setPartnerForm((prev) => ({ ...prev, [key]: value }))
  const setReceivableValue = (key, value) => setReceivableForm((prev) => ({ ...prev, [key]: value }))

  const selectPartner = (row) => {
    setSelectedPartner(row)
    setMessage('')
    setPartnerForm({
      ...emptyPartner,
      ...row,
      last_contact_date: String(row.last_contact_date || '').slice(0, 10),
    })
  }

  const selectReceivable = (row) => {
    setSelectedReceivable(row)
    setMessage('')
    setReceivableForm({
      ...emptyReceivable,
      ...row,
      partner_id: row.partner_id || '',
      due_date: String(row.due_date || '').slice(0, 10),
      invoice_amount: row.invoice_amount || 0,
      paid_amount: row.paid_amount || 0,
    })
  }

  const submitPartner = async (event) => {
    event.preventDefault()
    if (selectedPartner) {
      await updateExecutiveRecord('partners', selectedPartner.id, partnerForm)
      setMessage('거래처 정보가 수정되었습니다.')
    } else {
      await createExecutiveRecord('partners', partnerForm)
      setPartnerForm(emptyPartner)
      setMessage('거래처가 등록되었습니다.')
    }
    await load()
  }

  const submitReceivable = async (event) => {
    event.preventDefault()
    const payload = {
      ...receivableForm,
      invoice_amount: Number(receivableForm.invoice_amount || 0),
      paid_amount: Number(receivableForm.paid_amount || 0),
      due_date: receivableForm.due_date || today(),
      partner_id: receivableForm.partner_id || null,
    }
    if (selectedReceivable) {
      await updateExecutiveRecord('receivables', selectedReceivable.id, payload)
      setMessage('미수금 정보가 수정되었습니다.')
    } else {
      await createExecutiveRecord('receivables', payload)
      setReceivableForm({ ...emptyReceivable, due_date: today() })
      setMessage('미수금이 등록되었습니다.')
    }
    await load()
  }

  const removePartner = async () => {
    if (!selectedPartner) return
    await deleteExecutiveRecord('partners', selectedPartner.id)
    resetPartner()
    await load()
  }

  return (
    <>
      <PageHeader
        title="거래처 관리"
        description="거래처 원장과 미수금 데이터를 분리해서 관리합니다. 원장 정보는 거래처 탭에서, 청구/입금 정보는 미수금 탭에서 수정합니다."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="등록 거래처" value={`${partners.length.toLocaleString('ko-KR')}곳`} helperText="거래처 원장 기준" icon="groups" />
        <KpiCard label="총 미수 금액" value={won(summary.totalReceivable)} helperText="청구 금액 - 입금 완료" tone="rose" icon="request_quote" />
        <KpiCard label="위험 거래처" value={`${summary.riskCount}곳`} helperText="주의 이상 위험도" tone={summary.riskCount ? 'amber' : 'emerald'} icon="gpp_maybe" />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {summary.typeCounts.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => {
              setPartnerForm((prev) => ({ ...prev, partner_type: type.value }))
              setActiveTab('partners')
            }}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/40"
          >
            <span className="material-symbols-outlined text-xl text-sky-600">{type.icon}</span>
            <p className="mt-3 text-xs font-black text-slate-500">{type.label}</p>
            <p className="mt-1 text-xl font-black text-slate-950">{type.count}곳</p>
          </button>
        ))}
      </section>

      <SegmentedTabs activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab)
        setMessage('')
      }} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]">
        {activeTab === 'partners' ? (
          <>
            <PartnerForm selected={selectedPartner} form={partnerForm} setValue={setPartnerValue} onSubmit={submitPartner} onReset={resetPartner} onDelete={removePartner} message={message} />
            <Panel title="거래처 원장">
              <DataTable
                rows={partners}
                rowKey={(row) => row.id}
                searchPlaceholder="거래처명, 구분, 담당자, 품목, 연락처, 이메일 검색"
                columns={[
                  { key: 'partner_name', label: '거래처명', render: (row) => <button type="button" onClick={() => selectPartner(row)} className="font-black text-sky-700 hover:text-sky-500">{row.partner_name}</button> },
                  { key: 'partner_type', label: '구분', render: (row) => typeLabel(row.partner_type || 'SALES') },
                  { key: 'business_scope', label: '주요업무/품목', render: (row) => row.business_scope || '-' },
                  { key: 'manager_name', label: '담당자', render: (row) => row.manager_name || '-' },
                  { key: 'owner_name', label: '내부담당', render: (row) => row.owner_name || '-' },
                  { key: 'contact', label: '연락처', render: (row) => row.contact || '-' },
                  { key: 'tax_email', label: '이메일', render: (row) => row.tax_email || '-' },
                  { key: 'settlement_terms', label: '정산 조건', render: (row) => row.settlement_terms || '-' },
                  { key: 'contract_status', label: '상태', render: (row) => <StatusBadge value={row.contract_status || 'ACTIVE'} /> },
                  {
                    key: 'actions',
                    label: '관리',
                    searchable: false,
                    render: (row) => (
                      <button type="button" onClick={() => selectPartner(row)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50">
                        <span className="material-symbols-outlined text-sm">edit</span>
                        수정
                      </button>
                    ),
                  },
                ]}
              />
            </Panel>
          </>
        ) : (
          <>
            <ReceivableForm selected={selectedReceivable} form={receivableForm} setValue={setReceivableValue} onSubmit={submitReceivable} onReset={resetReceivable} partners={partners} message={message} />
            <Panel title="미수금 현황">
              <DataTable
                rows={visibleReceivables}
                rowKey={(row) => row.id}
                searchPlaceholder="거래처, 담당자, 위험도, 메모 검색"
                columns={[
                  { key: 'partner_name', label: '거래처명', render: (row) => <button type="button" onClick={() => selectReceivable(row)} className="font-black text-sky-700 hover:text-sky-500">{row.partner_name}</button> },
                  { key: 'partner_type', label: '구분', render: (row) => typeLabel(row.partner_type || 'SALES') },
                  { key: 'invoice_amount', label: '청구 금액', render: (row) => won(row.invoice_amount) },
                  { key: 'paid_amount', label: '입금 완료', render: (row) => won(row.paid_amount) },
                  { key: 'remaining_amount', label: '미수 금액', render: (row) => won(row.remaining_amount) },
                  { key: 'due_date', label: '입금 예정일', render: (row) => String(row.due_date || '-').slice(0, 10) },
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
