import { useEffect, useMemo, useState } from 'react'
import { KpiCard, PageHeader, Panel } from '../ExecutiveComponents'
import { fmtWon, fmtPct, changeOf } from './cfoUtils'
import { LoadingBox, ErrorBox } from './CfoShared'
import { getCfoSummary } from '../../../api/cfoApi'
import { ProfitTab, ProductTab, ChannelTab } from './CfoTabsFinance'
import { CashflowTab, ReceivableTab, DebtTab } from './CfoTabsCash'
import { ExpenseTab, BudgetTab, AlertsTab, DataTab } from './CfoTabsManage'

const TABS = [
  { id: 'summary', label: 'CFO 요약' },
  { id: 'profit', label: '손익 분석' },
  { id: 'product', label: '상품별 수익성' },
  { id: 'channel', label: '채널별 수익성' },
  { id: 'expense', label: '비용 관리' },
  { id: 'cashflow', label: '현금흐름 13주' },
  { id: 'receivable', label: '미수금·미지급' },
  { id: 'debt', label: '대출·부채' },
  { id: 'budget', label: '예산·목표' },
  { id: 'alerts', label: '재무 경보' },
  { id: 'data', label: '데이터 관리' },
]

const PRESETS = [
  { id: 'this-month', label: '이번 달' },
  { id: 'last-month', label: '지난달' },
  { id: 'last-3m', label: '최근 3개월' },
  { id: 'ytd', label: '올해 누적' },
  { id: 'custom', label: '직접 선택' },
]

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

function presetRange(preset) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (preset === 'last-month') {
    return { from: toDateStr(new Date(Date.UTC(y, m - 1, 1))), to: toDateStr(new Date(Date.UTC(y, m, 0))) }
  }
  if (preset === 'last-3m') {
    return { from: toDateStr(new Date(Date.UTC(y, m - 2, 1))), to: toDateStr(now) }
  }
  if (preset === 'ytd') {
    return { from: `${y}-01-01`, to: toDateStr(now) }
  }
  return { from: toDateStr(new Date(Date.UTC(y, m, 1))), to: toDateStr(now) }
}

function SummaryTab({ from, to }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCfoSummary({ from, to })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }, [from, to])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const cur = data.current || {}
  const prev = data.previous || {}
  const basis = cur.basis || {}
  const runway = data.cash?.runwayMonths

  const kpi = (label, value, prevValue, { tone, icon, tooltip, formatter = fmtWon } = {}) => (
    <KpiCard
      label={label}
      value={<span title={tooltip}>{formatter(value)}</span>}
      change={changeOf(value, prevValue)}
      tone={tone || (value != null && Number(value) < 0 ? 'rose' : 'sky')}
      icon={icon || 'monitoring'}
      helperText={prevValue == null ? (tooltip ? '툴팁에 계산 기준 표시' : undefined) : undefined}
    />
  )

  return (
    <div className="space-y-6">
      {(data.briefing || []).length > 0 && (
        <Panel title="CFO 자동 브리핑" right={<span className="text-[11px] font-black uppercase tracking-widest text-slate-400">규칙 기반 생성</span>}>
          <ul className="space-y-2">
            {data.briefing.map((line, index) => (
              <li key={index} className="flex gap-2 text-sm font-bold text-slate-700">
                <span className="material-symbols-outlined text-base text-sky-500">arrow_right</span>
                {line}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpi('순매출', cur.netSales, prev.netSales, { icon: 'payments', tooltip: basis.netSales })}
        {kpi('매출총이익', cur.grossProfit, prev.grossProfit, { icon: 'trending_up', tone: 'emerald', tooltip: basis.cogs })}
        {kpi('공헌이익', cur.contributionProfit, prev.contributionProfit, { icon: 'stacked_line_chart', tone: 'emerald', tooltip: '순매출 − 매출원가 − 판매변동비' })}
        {kpi('영업이익', cur.operatingProfit, prev.operatingProfit, { icon: 'account_balance', tooltip: '공헌이익 − 고정비 − 기타 판관비' })}
        {kpi('매출총이익률', cur.grossMarginPct, prev.grossMarginPct, { icon: 'percent', formatter: fmtPct })}
        {kpi('공헌이익률', cur.contributionMarginPct, prev.contributionMarginPct, { icon: 'percent', formatter: fmtPct })}
        {kpi('영업이익률', cur.operatingMarginPct, prev.operatingMarginPct, { icon: 'percent', formatter: fmtPct })}
        {kpi('원가 매칭 커버리지', cur.costCoveragePct, null, {
          icon: 'rule', formatter: fmtPct,
          tone: Number(cur.costCoveragePct) < 90 ? 'amber' : 'emerald',
          tooltip: basis.costCoveragePct,
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpi('현재 현금·예금', data.cash?.totalBalance, null, { icon: 'savings', tone: 'emerald', tooltip: `계좌 ${data.cash?.accountCount || 0}개 합계 (기준일 ${data.cash?.asOfDate || '미등록'})` })}
        {kpi('이달 예상 유입', data.cash?.monthExpectedInflow, null, { icon: 'south_west', tone: 'emerald' })}
        {kpi('이달 예상 유출', data.cash?.monthExpectedOutflow, null, { icon: 'north_east', tone: 'amber' })}
        <KpiCard
          label="현금 런웨이"
          value={runway === 'NO_BURN' ? '현금 소진 없음' : runway == null ? '데이터 없음' : `${runway}개월`}
          tone={runway === 'NO_BURN' ? 'emerald' : Number(runway) < 3 ? 'rose' : 'sky'}
          icon="hourglass_bottom"
          helperText="최근 3개월 평균 순현금유출 기준"
        />
        {kpi('미수금', data.receivable, null, { icon: 'credit_score', tone: 'amber', tooltip: '세금계산서 발행액 − 입금액' })}
        {kpi('미지급금', data.payable, null, { icon: 'receipt_long', tone: 'amber' })}
        {kpi('총 대출 잔액', data.debt?.total_debt, null, { icon: 'account_balance', tone: 'rose' })}
        {kpi('월 고정비', data.monthlyFixedCost, null, { icon: 'event_repeat', tooltip: basis.fixedCost })}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label="손익분기점 매출 (월)"
          value={<span title="월 고정비 ÷ 공헌이익률">{fmtWon(data.breakEvenRevenue)}</span>}
          icon="balance"
          helperText="월 고정비 ÷ 평균 공헌이익률"
        />
        <KpiCard
          label="이달 매출 목표"
          value={fmtWon(data.revenueGoal && Number(data.revenueGoal) > 0 ? data.revenueGoal : null)}
          icon="flag"
          helperText="예산·목표 탭에서 설정"
        />
        <KpiCard
          label="목표 달성률"
          value={fmtPct(data.goalAchievementPct)}
          tone={data.goalAchievementPct == null ? 'sky' : Number(data.goalAchievementPct) >= 100 ? 'emerald' : Number(data.goalAchievementPct) >= 70 ? 'sky' : 'amber'}
          icon="sports_score"
          helperText="순매출 ÷ 매출 목표"
        />
      </div>
    </div>
  )
}

export default function CfoDashboardPage() {
  const [tab, setTab] = useState('summary')
  const [preset, setPreset] = useState('this-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const range = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo }
    return presetRange(preset)
  }, [preset, customFrom, customTo])

  const month = range.to.slice(0, 7)

  return (
    <div>
      <PageHeader
        title="CFO 재무관리"
        description="회사가 실제로 돈을 벌고 있는지 — 이익·현금·위험을 한 화면에서 판단합니다. 모든 지표에 계산 기준이 표시됩니다."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-black transition-colors ${
              preset === p.id
                ? 'border-sky-500 bg-sky-500 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-bold outline-none focus:border-sky-400" />
            <span className="text-slate-400">~</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-bold outline-none focus:border-sky-400" />
          </span>
        )}
        <span className="ml-auto text-xs font-bold text-slate-400">{range.from} ~ {range.to}</span>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-black transition-colors ${
              tab === t.id
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab from={range.from} to={range.to} />}
      {tab === 'profit' && <ProfitTab month={month} />}
      {tab === 'product' && <ProductTab from={range.from} to={range.to} />}
      {tab === 'channel' && <ChannelTab from={range.from} to={range.to} />}
      {tab === 'expense' && <ExpenseTab month={month} />}
      {tab === 'cashflow' && <CashflowTab />}
      {tab === 'receivable' && <ReceivableTab />}
      {tab === 'debt' && <DebtTab />}
      {tab === 'budget' && <BudgetTab month={month} />}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'data' && <DataTab />}
    </div>
  )
}
