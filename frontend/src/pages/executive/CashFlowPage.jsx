import { useEffect, useMemo, useState } from 'react'
import { createExecutiveRecord, deleteExecutiveRecord, getExecutiveCashFlow, importOnlineSettlements, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { won } from './formatters'

const formatDate = (value) => String(value || '').slice(5)
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0)

function DecisionCard({ title, value, description, tone = 'sky', icon }) {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
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

function CashProjectionChart({ rows }) {
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
        <div className="pointer-events-none absolute inset-x-0 top-1/4 h-px bg-slate-200" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-200" />
        <div className="pointer-events-none absolute inset-x-0 top-3/4 h-px bg-slate-200" />
        <div className="flex h-72 items-end gap-2">
          {rows.map((row) => {
            const balance = Number(row.projected_balance || 0)
            const height = Math.max(10, ((balance - min) / range) * 100)
            const isRisk = balance < 30_000_000
            const isNegative = balance < 0

            return (
              <div key={row.target_date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-56 w-full items-end rounded bg-white px-1">
                  <div
                    className={`w-full rounded-t ${isNegative ? 'bg-rose-500' : isRisk ? 'bg-amber-400' : 'bg-sky-500'}`}
                    style={{ height: `${height}%` }}
                    title={`${row.target_date}: ${won(balance)}`}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] font-bold text-slate-500">
                  {formatDate(row.target_date)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-500" />정상</span>
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-400" />주의</span>
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-500" />부족</span>
      </div>
    </div>
  )
}

export default function CashFlowPage() {
  const [data, setData] = useState(null)
  const [showFlowForm, setShowFlowForm] = useState(false)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [importStartDate, setImportStartDate] = useState(() => new Date().toISOString().slice(0, 8) + '01')
  const [importEndDate, setImportEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

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
  const upcomingOutflows = data?.upcomingOutflows || []

  const currentCash = sum(accounts, 'balance')
  const day7 = projection[6]?.projected_balance ?? currentCash
  const day30 = projection[29]?.projected_balance ?? projection.at(-1)?.projected_balance ?? currentCash
  const lowest = useMemo(() => {
    if (!projection.length) return null
    return projection.reduce((minRow, row) =>
      Number(row.projected_balance) < Number(minRow.projected_balance) ? row : minRow,
    projection[0])
  }, [projection])

  const runwayDays = useMemo(() => {
    const shortageIndex = projection.findIndex((row) => Number(row.projected_balance || 0) < 0)
    return shortageIndex < 0 ? '30일+' : `${shortageIndex}일`
  }, [projection])

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          title="현금 흐름"
          description="계좌 잔액과 예정 입출금을 합산해 30일 현금 런웨이를 관리합니다."
        />
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null)
              setShowAccountForm((prev) => !prev)
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-black text-white transition-colors hover:bg-sky-500"
          >
            <span className="material-symbols-outlined text-base">{showAccountForm ? 'close' : 'account_balance'}</span>
            {showAccountForm ? '계좌 입력 닫기' : '계좌 잔액 입력'}
          </button>
          <button
            type="button"
            onClick={() => setShowFlowForm((prev) => !prev)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-base">{showFlowForm ? 'close' : 'add'}</span>
            {showFlowForm ? '입출금 입력 닫기' : '입출금 예정 추가'}
          </button>
        </div>
      </div>

      {showAccountForm && (
        <RecordForm
          key={editingAccount?.id || 'new-account'}
          title={editingAccount ? '계좌 잔액 수정' : '계좌 잔액 입력'}
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
          } : { status: 'NORMAL' }}
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
          title="입출금 예정 입력"
          fields={[
            { name: 'flow_date', label: '일자', type: 'date', required: true },
            { name: 'flow_type', label: '유형', type: 'select', required: true, options: [
              { value: 'INFLOW', label: '입금' },
              { value: 'OUTFLOW', label: '출금' },
            ] },
            { name: 'category', label: '카테고리', required: true, placeholder: '급여, 광고비, 상품대금' },
            { name: 'counterparty', label: '거래처/지급처', required: true },
            { name: 'amount', label: '금액', type: 'number', required: true },
            { name: 'confidence_level', label: '확정도', type: 'select', options: [
              { value: 'CONFIRMED', label: '확정' },
              { value: 'EXPECTED', label: '예상' },
              { value: 'CONSERVATIVE', label: '보수적' },
            ] },
            { name: 'status', label: '상태', type: 'select', options: [
              { value: 'EXPECTED', label: '예정' },
              { value: 'SCHEDULED', label: '대기' },
              { value: 'DONE', label: '완료' },
              { value: 'DELAYED', label: '지연' },
              { value: 'CANCELLED', label: '취소' },
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
            await createExecutiveRecord('cash-flows', values)
            await load()
            setShowFlowForm(false)
          }}
        />
      )}

      <section className="mb-6 rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black text-sky-800">온라인 채널 정산 자동 반영</p>
            <p className="mt-1 text-xs font-bold text-slate-600">
              스마트스토어, 쿠팡 등 온라인 주문 정산만 현금흐름 입금 예정으로 가져옵니다. 오프라인, 수출, B2B, 매입/출금은 직접 입력하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">시작일</span>
              <input
                type="date"
                value={importStartDate}
                onChange={(event) => setImportStartDate(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">종료일</span>
              <input
                type="date"
                value={importEndDate}
                onChange={(event) => setImportEndDate(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <button
              type="button"
              disabled={importing}
              onClick={async () => {
                setImporting(true)
                setImportMessage('')
                try {
                  const response = await importOnlineSettlements({ startDate: importStartDate, endDate: importEndDate })
                  setImportMessage(`생성 ${response.data.insertedCount}건 / 중복 제외 ${response.data.skippedCount}건 / 대상 ${response.data.candidateCount}건`)
                  await load()
                } catch (error) {
                  setImportMessage(error?.response?.data?.message || '온라인 정산 불러오기에 실패했습니다.')
                } finally {
                  setImporting(false)
                }
              }}
              className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {importing ? '불러오는 중...' : '온라인 정산 불러오기'}
            </button>
          </div>
        </div>
        {importMessage && <p className="mt-3 text-xs font-black text-sky-700">{importMessage}</p>}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DecisionCard title="현재 가용 현금" value={won(currentCash)} description="등록된 계좌 잔액 합계" tone="sky" icon="account_balance_wallet" />
        <DecisionCard title="7일 후 예상 잔액" value={won(day7)} description="오늘부터 7일 누적 입출금 반영" tone={Number(day7) < 30_000_000 ? 'amber' : 'emerald'} icon="calendar_view_week" />
        <DecisionCard title="30일 후 예상 잔액" value={won(day30)} description="30일 현금 런웨이 기준" tone={Number(day30) < 30_000_000 ? 'rose' : 'emerald'} icon="monitoring" />
        <DecisionCard title="현금 런웨이" value={runwayDays} description={data?.expectedCashShortageDate ? `${data.expectedCashShortageDate} 부족 예상` : '30일 내 부족일 없음'} tone={data?.expectedCashShortageDate ? 'rose' : 'emerald'} icon="rocket_launch" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="오늘 입금 예정" value={won(totals.today_inflow)} icon="south_west" />
        <KpiCard label="오늘 출금 예정" value={won(totals.today_outflow)} tone="rose" icon="north_east" />
        <KpiCard label="이번 주 입금 예정" value={won(totals.week_inflow)} tone="emerald" icon="calendar_month" />
        <KpiCard label="이번 주 출금 예정" value={won(totals.week_outflow)} tone="amber" icon="event" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel
            title="30일 예상 잔액 그래프"
            right={lowest && <span className="text-xs font-black text-slate-500">최저점 {formatDate(lowest.target_date)} · {won(lowest.projected_balance)}</span>}
          >
            <CashProjectionChart rows={projection} />
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Panel title="대표 체크포인트" right={<StatusBadge value={data?.expectedCashShortageDate ? 'HIGH' : 'NORMAL'} />}>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">지연 입금</p>
                <p className="mt-1 text-2xl font-black text-rose-700">{delayedInflows.length}건</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">다가오는 큰 출금</p>
                <p className="mt-1 text-2xl font-black text-amber-700">{upcomingOutflows.length}건</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">이번 달 순현금</p>
                <p className={`mt-1 text-2xl font-black ${Number(totals.month_inflow || 0) >= Number(totals.month_outflow || 0) ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {won(Number(totals.month_inflow || 0) - Number(totals.month_outflow || 0))}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="계좌 잔액">
          <DataTable
            rows={accounts}
            columns={[
              { key: 'bank_name', label: '은행' },
              { key: 'account_name', label: '계좌명' },
              { key: 'balance', label: '잔액', render: (row) => won(row.balance) },
              { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'source_type', label: '출처', render: (row) => row.source_type === 'ONLINE_SETTLEMENT' ? '온라인 자동' : '직접 입력' },
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
        <Panel title="다가오는 출금 일정">
          <DataTable
            rows={upcomingOutflows}
            columns={[
              { key: 'flow_date', label: '일자' },
              { key: 'category', label: '구분' },
              { key: 'counterparty', label: '지급처' },
              { key: 'amount', label: '금액', render: (row) => won(row.amount) },
              { key: 'confidence_level', label: '확정도', render: (row) => <StatusBadge value={row.confidence_level} /> },
            ]}
          />
        </Panel>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="입금 예정 리스트">
          <DataTable
            rows={inflows}
            columns={[
              { key: 'flow_date', label: '일자' },
              { key: 'category', label: '구분' },
              { key: 'counterparty', label: '거래처' },
              { key: 'amount', label: '금액', render: (row) => won(row.amount) },
              { key: 'confidence_level', label: '확정도', render: (row) => <StatusBadge value={row.confidence_level} /> },
              { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
            ]}
          />
        </Panel>
        <Panel title="출금 예정 리스트">
          <DataTable
            rows={outflows}
            columns={[
              { key: 'flow_date', label: '일자' },
              { key: 'category', label: '구분' },
              { key: 'counterparty', label: '지급처' },
              { key: 'amount', label: '금액', render: (row) => won(row.amount) },
              { key: 'recurring_rule', label: '반복' },
              { key: 'memo', label: '메모' },
            ]}
          />
        </Panel>
      </section>
    </>
  )
}
