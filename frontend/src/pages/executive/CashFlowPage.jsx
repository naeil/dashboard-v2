import { useEffect, useMemo, useState } from 'react'
import { createExecutiveRecord, deleteExecutiveRecord, getExecutiveCashFlow, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { won } from './formatters'

const formatDate = (value) => String(value || '').slice(5, 10)
const todayIso = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const daysUntil = (value) => {
  if (!value) return null
  const diff = new Date(`${String(value).slice(0, 10)}T00:00:00`) - new Date(`${todayIso()}T00:00:00`)
  return Math.round(diff / 86_400_000)
}

const SOURCE_META = {
  OPERATING_EXPENSE: { label: '운영 비용', menu: '운영 비용', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  DEBT: { label: '부채 상환', menu: '채권/부채', tone: 'bg-rose-50 text-rose-800 border-rose-200' },
  RECEIVABLE: { label: '채권(미수금)', menu: '채권/부채', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  CONSULTING: { label: '컨설팅 잔금', menu: '컨설팅 매출', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  ONLINE_AUTO: { label: '온라인 정산(추정)', menu: 'PlayAuto 주문', tone: 'bg-sky-50 text-sky-800 border-sky-200' },
  ONLINE_SETTLEMENT: { label: '온라인 정산', menu: '현금 흐름', tone: 'bg-sky-50 text-sky-800 border-sky-200' },
  MANUAL: { label: '직접 입력', menu: '현금 흐름', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
}

function SourceTag({ value }) {
  const meta = SOURCE_META[value] || SOURCE_META.MANUAL
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-black ${meta.tone}`}>{meta.label}</span>
}

function DecisionCard({ title, value, description, tone = 'sky', icon }) {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className={`rounded-lg border p-5 shadow-sm ${tones[tone] || tones.sky}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-black">{title}</p>
        <span className="material-symbols-outlined text-xl opacity-80">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-xs font-bold opacity-80">{description}</p>
    </div>
  )
}

function CashProjectionChart({ rows, threshold }) {
  const balances = rows.map((row) => Number(row.projected_balance || 0))
  const max = Math.max(...balances, 1)
  const min = Math.min(...balances, 0)
  const range = Math.max(max - min, 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        <span>30일 예상 잔액</span>
        <span>{rows.length ? `기간 ${rows.length}일` : '데이터 없음'}</span>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex h-72 items-end gap-1">
          {rows.map((row) => {
            const balance = Number(row.projected_balance || 0)
            const height = Math.max(4, ((balance - min) / range) * 100)
            const isNegative = balance < 0
            const isRisk = balance < threshold
            const moved = Number(row.inflow || 0) - Number(row.outflow || 0)

            return (
              <div key={row.target_date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-56 w-full items-end rounded bg-white px-0.5">
                  <div
                    className={`w-full rounded-t ${isNegative ? 'bg-rose-500' : isRisk ? 'bg-amber-400' : 'bg-sky-500'}`}
                    style={{ height: `${height}%` }}
                    title={`${row.target_date}\n예상 잔액 ${won(balance)}\n입금 ${won(row.inflow)} / 출금 ${won(row.outflow)}`}
                  />
                </div>
                <span className={`w-full truncate text-center text-[10px] font-bold ${moved !== 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {formatDate(row.target_date)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-500" />정상</span>
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-400" />주의 ({won(threshold)} 미만)</span>
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-500" />마이너스</span>
        <span className="text-slate-400">· 진한 날짜 = 입출금 있는 날</span>
      </div>
    </div>
  )
}

function BalanceRefresh({ accounts, freshness, onSaved }) {
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(Object.fromEntries(accounts.map((row) => [row.id, String(Math.round(Number(row.balance || 0)))])))
  }, [accounts])

  const stale = freshness?.is_stale
  const staleDays = freshness?.stale_days

  return (
    <section className={`mb-6 rounded-lg border p-5 shadow-sm ${stale ? 'border-rose-300 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className={`text-sm font-black ${stale ? 'text-rose-800' : 'text-emerald-800'}`}>
            {accounts.length === 0
              ? '등록된 계좌가 없습니다 — 예측의 출발점이 없습니다'
              : stale
                ? `계좌 잔액이 ${staleDays}일 전 기준입니다 — 아래 모든 예측의 출발점이 틀려 있습니다`
                : `계좌 잔액 최신 (가장 오래된 기준일 ${freshness?.oldest_as_of || '-'})`}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            주 1회, 인터넷뱅킹 잔액만 옮겨 적으면 됩니다. 나머지 입출금 예정은 운영 비용·부채·채권·온라인 주문에서 자동으로 계산됩니다.
          </p>
        </div>
      </div>
      {accounts.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {accounts.map((row) => {
              const age = -daysUntil(row.as_of_date)
              return (
                <label key={row.id} className="rounded-lg border border-white bg-white/80 p-3">
                  <span className="flex items-center justify-between text-xs font-black text-slate-600">
                    <span>{row.bank_name} · {row.account_name}</span>
                    <span className={age > (freshness?.threshold_days ?? 7) ? 'text-rose-600' : 'text-emerald-600'}>
                      {String(row.as_of_date || '').slice(0, 10)} ({age}일 전)
                    </span>
                  </span>
                  <input
                    type="number"
                    value={values[row.id] ?? ''}
                    onChange={(event) => setValues((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-black text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              )
            })}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  const asOf = todayIso()
                  await Promise.all(accounts.map((row) => updateExecutiveRecord('cash-accounts', row.id, {
                    bank_name: row.bank_name,
                    account_name: row.account_name,
                    account_number: row.account_number,
                    status: row.status || 'NORMAL',
                    balance: Number(values[row.id] || 0),
                    as_of_date: asOf,
                  })))
                  await onSaved()
                } finally {
                  setSaving(false)
                }
              }}
              className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-black text-white transition-colors hover:bg-slate-700 disabled:bg-slate-300"
            >
              {saving ? '저장 중...' : '오늘 기준으로 잔액 저장'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

const flowColumns = (counterpartyLabel) => [
  { key: 'flow_date', label: '일자', render: (row) => String(row.flow_date || '').slice(0, 10) },
  { key: 'source_type', label: '출처', render: (row) => <SourceTag value={row.source_type} /> },
  { key: 'category', label: '구분' },
  { key: 'counterparty', label: counterpartyLabel },
  { key: 'amount', label: '금액', render: (row) => won(row.amount) },
  { key: 'confidence_level', label: '확정도', render: (row) => <StatusBadge value={row.confidence_level} /> },
  { key: 'memo', label: '메모' },
]

export default function CashFlowPage() {
  const [data, setData] = useState(null)
  const [showFlowForm, setShowFlowForm] = useState(false)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  const load = () => getExecutiveCashFlow().then((res) => setData(res.data))

  useEffect(() => {
    load()
  }, [])

  const totals = data?.totals || {}
  const projection = data?.dailyProjection || []
  const accounts = data?.accounts || []
  const inflows = data?.inflows || []
  const outflows = data?.outflows || []
  const delayedInflows = data?.delayedInflows || []
  const unscheduledInflows = data?.unscheduledInflows || []
  const bigFlows = data?.bigFlows || []
  const sourceSummary = data?.sourceSummary || []
  const freshness = data?.balanceFreshness || {}
  const threshold = Number(data?.riskBalanceThreshold || 30_000_000)
  const horizon = data?.horizonDays || 90

  const currentCash = Number(totals.opening_cash ?? accounts.reduce((sum, row) => sum + Number(row.balance || 0), 0))
  const net30 = Number(totals.inflow_30d || 0) - Number(totals.outflow_30d || 0)
  const lowest = data?.lowestPoint
  const zeroDate = data?.cashZeroDate
  const zeroIn = daysUntil(zeroDate)

  const missingSources = useMemo(() => {
    const present = new Set(sourceSummary.map((row) => row.source_type))
    return ['OPERATING_EXPENSE', 'DEBT', 'RECEIVABLE', 'ONLINE_AUTO'].filter((key) => !present.has(key))
  }, [sourceSummary])

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          title="현금 흐름"
          description={`계좌 잔액 + 운영 비용·부채 상환·채권·온라인 정산을 자동 합산해 ${horizon}일 현금 런웨이를 계산합니다.`}
        />
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null)
              setShowAccountForm((prev) => !prev)
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-base">{showAccountForm ? 'close' : 'account_balance'}</span>
            {showAccountForm ? '계좌 입력 닫기' : '계좌 추가'}
          </button>
          <button
            type="button"
            onClick={() => setShowFlowForm((prev) => !prev)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-base">{showFlowForm ? 'close' : 'add'}</span>
            {showFlowForm ? '입출금 입력 닫기' : '일회성 입출금 추가'}
          </button>
        </div>
      </div>

      {showAccountForm && (
        <RecordForm
          key={editingAccount?.id || 'new-account'}
          title={editingAccount ? '계좌 수정' : '계좌 추가'}
          fields={[
            { name: 'bank_name', label: '은행명', required: true, placeholder: '기업은행' },
            { name: 'account_name', label: '계좌명', required: true, placeholder: '운영자금 계좌' },
            { name: 'account_number', label: '계좌번호' },
            { name: 'balance', label: '현재 잔액', type: 'number', required: true },
            { name: 'as_of_date', label: '기준일', type: 'date', required: true },
            { name: 'status', label: '상태', type: 'select', options: [
              { value: 'NORMAL', label: '정상' },
              { value: 'WATCH', label: '주의' },
              { value: 'HIGH', label: '위험' },
            ] },
          ]}
          initialValues={editingAccount ? {
            bank_name: editingAccount.bank_name || '',
            account_name: editingAccount.account_name || '',
            account_number: editingAccount.account_number || '',
            balance: editingAccount.balance || '',
            as_of_date: String(editingAccount.as_of_date || '').slice(0, 10),
            status: editingAccount.status || 'NORMAL',
          } : { status: 'NORMAL', as_of_date: todayIso() }}
          onSubmit={async (values) => {
            if (editingAccount) await updateExecutiveRecord('cash-accounts', editingAccount.id, values)
            else await createExecutiveRecord('cash-accounts', values)
            await load()
            setEditingAccount(null)
            setShowAccountForm(false)
          }}
        />
      )}

      {showFlowForm && (
        <RecordForm
          title="일회성 입출금 예정 입력 (운영비·대출·채권은 각 메뉴에서 자동 반영되므로 여기 넣지 마세요)"
          fields={[
            { name: 'flow_date', label: '일자', type: 'date', required: true },
            { name: 'flow_type', label: '유형', type: 'select', required: true, options: [
              { value: 'INFLOW', label: '입금' },
              { value: 'OUTFLOW', label: '출금' },
            ] },
            { name: 'category', label: '카테고리', required: true, placeholder: '생산 대금, 수출 대금, 세금' },
            { name: 'counterparty', label: '거래처/지급처', required: true },
            { name: 'amount', label: '금액', type: 'number', required: true },
            { name: 'confidence_level', label: '확정도', type: 'select', options: [
              { value: 'CONFIRMED', label: '확정' },
              { value: 'EXPECTED', label: '예상' },
              { value: 'CONSERVATIVE', label: '보수적' },
            ] },
            { name: 'recurring_rule', label: '반복', type: 'select', options: [
              { value: 'NONE', label: '없음' },
              { value: 'MONTHLY', label: '매월' },
              { value: 'WEEKLY', label: '매주' },
            ] },
            { name: 'memo', label: '메모', wide: true },
          ]}
          initialValues={{ status: 'SCHEDULED', confidence_level: 'EXPECTED', recurring_rule: 'NONE' }}
          onSubmit={async (values) => {
            await createExecutiveRecord('cash-flows', { ...values, status: 'SCHEDULED' })
            await load()
            setShowFlowForm(false)
          }}
        />
      )}

      <BalanceRefresh accounts={accounts} freshness={freshness} onSaved={load} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DecisionCard
          title="현금 바닥 예상일"
          value={zeroDate ? `${String(zeroDate).slice(0, 10)}` : `${horizon}일 내 없음`}
          description={zeroDate ? `D-${zeroIn} · 그 전에 자금 조달 또는 지출 조정 필요` : `${horizon}일 예측 기준 마이너스 잔액 없음`}
          tone={zeroDate ? 'rose' : 'emerald'}
          icon="crisis_alert"
        />
        <DecisionCard
          title="30일 내 최저 잔액"
          value={lowest ? won(lowest.projected_balance) : '-'}
          description={lowest ? `${String(lowest.target_date).slice(0, 10)} 시점` : '데이터 없음'}
          tone={lowest && Number(lowest.projected_balance) < threshold ? 'amber' : 'sky'}
          icon="trending_down"
        />
        <DecisionCard
          title="30일 순현금"
          value={won(net30)}
          description={`입금 ${won(totals.inflow_30d)} / 출금 ${won(totals.outflow_30d)}`}
          tone={net30 >= 0 ? 'emerald' : 'rose'}
          icon="swap_vert"
        />
        <DecisionCard
          title="현재 잔액 (기준일 확인)"
          value={won(currentCash)}
          description={freshness?.is_stale ? `⚠ ${freshness?.stale_days ?? '-'}일 전 잔액 — 신뢰 불가` : '최신 잔액 기준'}
          tone={freshness?.is_stale ? 'slate' : 'sky'}
          icon="account_balance_wallet"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="이번 주 입금 예정" value={won(totals.week_inflow)} tone="emerald" icon="south_west" />
        <KpiCard label="이번 주 출금 예정" value={won(totals.week_outflow)} tone="rose" icon="north_east" />
        <KpiCard label="이번 달 남은 입금" value={won(totals.month_inflow)} tone="emerald" icon="calendar_month" />
        <KpiCard label="이번 달 남은 출금" value={won(totals.month_outflow)} tone="amber" icon="event" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel
            title="30일 예상 잔액 그래프"
            right={lowest && <span className="text-xs font-black text-slate-500">최저점 {formatDate(lowest.target_date)} · {won(lowest.projected_balance)}</span>}
          >
            <CashProjectionChart rows={projection} threshold={threshold} />
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Panel title="30일 내 큰 돈 5건" right={<StatusBadge value={zeroDate ? 'HIGH' : 'NORMAL'} />}>
            <div className="space-y-2">
              {bigFlows.length === 0 && <p className="text-sm font-bold text-slate-500">예정된 입출금이 없습니다.</p>}
              {bigFlows.map((row, index) => (
                <div key={`${row.flow_date}-${row.counterparty}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500">{String(row.flow_date).slice(5, 10)} · <SourceTag value={row.source_type} /></p>
                    <p className="truncate text-sm font-black text-slate-900">{row.counterparty || row.category}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-black ${row.flow_type === 'INFLOW' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.flow_type === 'INFLOW' ? '+' : '-'}{won(row.amount)}
                  </p>
                </div>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-500">지연 입금</p>
                  <p className="mt-1 text-lg font-black text-rose-700">{delayedInflows.length}건 · {won(totals.delayed_inflow_amount)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-500">입금일 미정</p>
                  <p className="mt-1 text-lg font-black text-amber-700">{unscheduledInflows.length}건</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-6">
        <Panel title="예측에 반영된 데이터 출처 (30일)">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sourceSummary.map((row) => (
              <div key={row.source_type} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <SourceTag value={row.source_type} />
                  <span className="text-xs font-black text-slate-500">{row.count}건</span>
                </div>
                <p className="mt-2 text-sm font-black text-emerald-700">입금 {won(row.inflow)}</p>
                <p className="text-sm font-black text-rose-700">출금 {won(row.outflow)}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">수정: {SOURCE_META[row.source_type]?.menu || '-'} 메뉴</p>
              </div>
            ))}
            {missingSources.map((key) => (
              <div key={key} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <SourceTag value={key} />
                <p className="mt-2 text-xs font-bold text-slate-500">30일 내 반영 건 없음 — {SOURCE_META[key].menu} 메뉴 데이터 확인 필요</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-slate-400">
            온라인 정산(추정): 최근 60일 주문 결제액 기준. 쿠팡 D+30·수수료 11%, 스마트스토어 D+10·5.5%, 테무 D+15·7.5%, 기타 D+14·10% 가정 — 실제 정산서와 다르면 조정 필요.
          </p>
        </Panel>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="입금 예정 (30일)">
          <DataTable rows={inflows} columns={flowColumns('거래처')} />
        </Panel>
        <Panel title="출금 예정 (30일)">
          <DataTable rows={outflows} columns={flowColumns('지급처')} />
        </Panel>
      </section>

      {(delayedInflows.length > 0 || unscheduledInflows.length > 0) && (
        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="지연 입금 (예정일 지남 · 예측에서 제외)">
            <DataTable rows={delayedInflows} columns={flowColumns('거래처')} />
          </Panel>
          <Panel title="입금일 미정 (예측에서 제외)">
            <DataTable rows={unscheduledInflows} columns={flowColumns('거래처')} />
          </Panel>
        </section>
      )}

      <section className="mt-6">
        <Panel title="계좌 관리">
          <DataTable
            rows={accounts}
            columns={[
              { key: 'bank_name', label: '은행' },
              { key: 'account_name', label: '계좌명' },
              { key: 'balance', label: '잔액', render: (row) => won(row.balance) },
              { key: 'as_of_date', label: '기준일', render: (row) => String(row.as_of_date || '').slice(0, 10) },
              { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'actions', label: '관리', render: (row) => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount(row)
                      setShowAccountForm(true)
                    }}
                    className="inline-flex h-8 items-center rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 transition-colors hover:bg-sky-100"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('이 계좌를 삭제할까요?')) return
                      await deleteExecutiveRecord('cash-accounts', row.id)
                      if (editingAccount?.id === row.id) {
                        setEditingAccount(null)
                        setShowAccountForm(false)
                      }
                      await load()
                    }}
                    className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 transition-colors hover:bg-rose-100"
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
