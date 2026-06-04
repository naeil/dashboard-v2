import { useEffect, useMemo, useState } from 'react'
import { createExecutiveRecord, getExecutiveAdPerformance, getExecutiveAdRoasGoals } from '../../api/executiveApi'
import { BarList, DataTable, KpiCard, PageHeader, Panel } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

const adAreaTabs = [
  { id: 'ALL', label: '전체' },
  { id: 'SHOPPING_SEARCH', label: '쇼핑검색' },
  { id: 'POWERLINK', label: '파워링크' },
  { id: 'MANUAL', label: '직접 입력' },
]

const adTypeLabels = {
  ALL: '전체 광고',
  SHOPPING_SEARCH: '쇼핑검색',
  POWERLINK: '파워링크',
  MANUAL: '직접 입력',
}

const periodLabels = {
  MONTHLY: '월간',
  WEEKLY: '주간',
}

const today = new Date()
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

function normalDate(value) {
  return String(value || '').slice(0, 10)
}

function isInGoalPeriod(row, goal) {
  const rowDate = normalDate(row.report_month)
  if (!rowDate) return false
  return rowDate >= normalDate(goal.start_date) && rowDate <= normalDate(goal.end_date)
}

function isSameAdType(row, goal) {
  const goalType = goal.ad_type || 'ALL'
  if (goalType === 'ALL') return true
  if (goalType === 'MANUAL') return row.source === 'MANUAL'
  return row.ad_type === goalType || row.adType === goalType
}

function isSameProduct(row, goal) {
  if (!goal.product_name) return true
  return String(row.product_name || '').trim().toLowerCase() === String(goal.product_name || '').trim().toLowerCase()
}

function goalActualRows(goal, rows) {
  return rows.filter((row) => isInGoalPeriod(row, goal) && isSameAdType(row, goal) && isSameProduct(row, goal))
}

function actualRoas(rows) {
  const cost = rows.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)
  const sales = rows.reduce((sum, row) => sum + Number(row.sales_amount || 0), 0)
  if (cost > 0) return (sales / cost) * 100
  if (rows.length) return rows.reduce((sum, row) => sum + Number(row.roas || 0), 0) / rows.length
  return null
}

function GoalStatusBadge({ status }) {
  const className = status === 'ACHIEVED'
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
    : status === 'NO_DATA'
      ? 'border-slate-500/30 bg-slate-500/15 text-slate-200'
      : 'border-rose-400/30 bg-rose-400/15 text-rose-100'
  const label = status === 'ACHIEVED' ? '달성' : status === 'NO_DATA' ? '데이터 없음' : '주의'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{label}</span>
}

function GoalCard({ goal, rows }) {
  const matchedRows = goalActualRows(goal, rows)
  const roas = actualRoas(matchedRows)
  const target = Number(goal.target_roas || 0)
  const status = roas == null ? 'NO_DATA' : roas >= target ? 'ACHIEVED' : 'WARNING'
  const gap = roas == null ? null : roas - target

  return (
    <article className={`rounded-lg border p-5 ${status === 'WARNING' ? 'border-rose-400/30 bg-rose-400/10' : status === 'ACHIEVED' ? 'border-emerald-400/25 bg-emerald-400/10' : 'border-white/10 bg-slate-950/45'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-400">{periodLabels[goal.period_type] || goal.period_type}</p>
          <p className="mt-2 truncate text-lg font-black text-white">{goal.product_name || adTypeLabels[goal.ad_type] || '전체 광고'}</p>
        </div>
        <GoalStatusBadge status={status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
          <p className="text-[11px] font-black text-slate-500">목표 ROAS</p>
          <p className="mt-1 text-xl font-black text-white">{pct(target)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
          <p className="text-[11px] font-black text-slate-500">실제 ROAS</p>
          <p className={`mt-1 text-xl font-black ${status === 'WARNING' ? 'text-rose-100' : 'text-white'}`}>{roas == null ? '-' : pct(roas)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-400">
        {normalDate(goal.start_date)} ~ {normalDate(goal.end_date)} · {adTypeLabels[goal.ad_type] || goal.ad_type}
      </p>
      {status === 'WARNING' && (
        <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm font-bold leading-6 text-rose-100">
          목표 대비 {pct(Math.abs(gap))} 부족합니다. 소재/키워드/예산 배분을 확인하세요.
        </p>
      )}
      {status === 'NO_DATA' && (
        <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm font-bold leading-6 text-slate-300">
          이 목표와 연결된 광고 성과 데이터가 아직 없습니다.
        </p>
      )}
    </article>
  )
}

export default function AdPerformancePage() {
  const [rows, setRows] = useState([])
  const [goals, setGoals] = useState([])
  const [activeArea, setActiveArea] = useState('ALL')

  const load = async () => {
    const [adRes, goalRes] = await Promise.all([getExecutiveAdPerformance(), getExecutiveAdRoasGoals()])
    setRows(adRes.data || [])
    setGoals(goalRes.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const filteredRows = useMemo(() => {
    if (activeArea === 'ALL') return rows
    if (activeArea === 'MANUAL') return rows.filter((row) => row.source === 'MANUAL')
    return rows.filter((row) => row.ad_type === activeArea || row.adType === activeArea)
  }, [activeArea, rows])

  const activeGoals = goals.filter((goal) => goal.status !== 'DISABLED')
  const goalStatuses = activeGoals.map((goal) => {
    const roas = actualRoas(goalActualRows(goal, rows))
    const target = Number(goal.target_roas || 0)
    return { goal, roas, status: roas == null ? 'NO_DATA' : roas >= target ? 'ACHIEVED' : 'WARNING' }
  })

  const warningGoals = goalStatuses.filter((item) => item.status === 'WARNING')
  const noDataGoals = goalStatuses.filter((item) => item.status === 'NO_DATA')
  const achievedGoals = goalStatuses.filter((item) => item.status === 'ACHIEVED')
  const naverRows = rows.filter((row) => row.source === 'NAVER_SEARCH_AD')
  const shoppingRow = naverRows.find((row) => row.ad_type === 'SHOPPING_SEARCH' || row.adType === 'SHOPPING_SEARCH')
  const powerlinkRow = naverRows.find((row) => row.ad_type === 'POWERLINK' || row.adType === 'POWERLINK')
  const strongestArea = [...naverRows].sort((a, b) => Number(b.roas || 0) - Number(a.roas || 0))[0]
  const weakestArea = [...naverRows].sort((a, b) => Number(a.roas || 0) - Number(b.roas || 0))[0]
  const totalNaverCost = naverRows.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)

  return (
    <>
      <PageHeader title="광고 성과" description="월간/주간 ROAS 목표를 설정하고, 제품별 목표 미달 광고를 빨간색 주의 상태로 관리합니다." />

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecordForm
          title="광고 ROAS 목표 설정"
          fields={[
            { name: 'period_type', label: '목표 주기', type: 'select', required: true, options: [
              { value: 'MONTHLY', label: '월간 목표' },
              { value: 'WEEKLY', label: '주간 목표' },
            ] },
            { name: 'product_name', label: '제품명', placeholder: '예: 하이프리, 단백깡' },
            { name: 'ad_type', label: '광고 영역', type: 'select', required: true, options: [
              { value: 'ALL', label: '전체 광고' },
              { value: 'SHOPPING_SEARCH', label: '쇼핑검색' },
              { value: 'POWERLINK', label: '파워링크' },
              { value: 'MANUAL', label: '직접 입력 광고' },
            ] },
            { name: 'target_roas', label: '목표 ROAS(%)', type: 'number', required: true },
            { name: 'start_date', label: '시작일', type: 'date', required: true, defaultValue: monthStart },
            { name: 'end_date', label: '종료일', type: 'date', required: true, defaultValue: monthEnd },
            { name: 'owner_name', label: '담당자' },
            { name: 'memo', label: '목표 메모' },
          ]}
          onSubmit={async (values) => {
            await createExecutiveRecord('ad-roas-goals', { status: 'ACTIVE', ...values })
            await load()
          }}
        />

        <RecordForm
          title="광고 성과 입력"
          fields={[
            { name: 'product_name', label: '제품명' },
            { name: 'ad_channel', label: '광고 채널', type: 'select', required: true, options: [
              '메타 광고', '네이버 광고', '구글 광고', '틱톡 광고',
            ].map((value) => ({ value, label: value })) },
            { name: 'report_month', label: '기준일', type: 'date', required: true },
            { name: 'ad_cost', label: '광고비', type: 'number', required: true },
            { name: 'click_count', label: '클릭수', type: 'number' },
            { name: 'cpa', label: 'CPA', type: 'number' },
            { name: 'roas', label: 'ROAS', type: 'number' },
            { name: 'conversion_rate', label: '구매 전환율', type: 'number' },
            { name: 'sales_amount', label: '매출', type: 'number' },
            { name: 'net_profit', label: '순이익', type: 'number' },
          ]}
          onSubmit={async (values) => {
            await createExecutiveRecord('ad-performance', values)
            await load()
          }}
        />
      </section>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-2">
        {adAreaTabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveArea(tab.id)} className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-xs font-black transition-colors ${activeArea === tab.id ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="목표 미달" value={count(warningGoals.length, '건')} icon="warning" tone={warningGoals.length ? 'rose' : 'emerald'} helperText="ROAS 목표 대비 주의" />
        <KpiCard label="목표 달성" value={count(achievedGoals.length, '건')} icon="task_alt" tone="emerald" helperText="실제 ROAS가 목표 이상" />
        <KpiCard label="데이터 없음" value={count(noDataGoals.length, '건')} icon="rule" tone="amber" helperText="목표는 있으나 성과 미연결" />
        <KpiCard label="네이버 광고비" value={won(totalNaverCost)} icon="payments" tone="rose" helperText="쇼핑검색 + 파워링크" />
      </section>

      <Panel title="ROAS 목표 달성 현황" right={<span className="text-xs font-black text-slate-400">빨간색은 즉시 확인 필요</span>}>
        {activeGoals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 py-12 text-center text-sm font-bold text-slate-500">
            아직 등록된 ROAS 목표가 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} rows={rows} />)}
          </div>
        )}
      </Panel>

      <section className="my-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="쇼핑검색 ROAS" value={pct(shoppingRow?.roas || 0)} icon="shopping_cart" tone={(shoppingRow?.roas || 0) < 300 ? 'rose' : 'emerald'} helperText="네이버 연동 데이터" />
        <KpiCard label="파워링크 ROAS" value={pct(powerlinkRow?.roas || 0)} icon="search" tone={(powerlinkRow?.roas || 0) < 300 ? 'rose' : 'amber'} helperText="네이버 연동 데이터" />
        <KpiCard label="최고 효율 영역" value={strongestArea?.ad_type_label || strongestArea?.adTypeLabel || '-'} icon="query_stats" tone="sky" helperText={strongestArea ? `ROAS ${pct(strongestArea.roas)}` : '데이터 없음'} />
        <KpiCard label="최저 효율 영역" value={weakestArea?.ad_type_label || weakestArea?.adTypeLabel || '-'} icon="priority_high" tone="rose" helperText={weakestArea ? `ROAS ${pct(weakestArea.roas)}` : '데이터 없음'} />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <Panel title="광고 영역 판단">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs font-black text-slate-400">강화 후보</p>
              <p className="mt-2 text-xl font-black text-white">{strongestArea?.ad_type_label || strongestArea?.adTypeLabel || '데이터 없음'}</p>
              <p className="mt-2 text-sm font-bold text-slate-300">ROAS {pct(strongestArea?.roas || 0)} · 광고비 {won(strongestArea?.ad_cost || 0)}</p>
            </div>
            <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-4">
              <p className="text-xs font-black text-slate-400">점검 후보</p>
              <p className="mt-2 text-xl font-black text-white">{weakestArea?.ad_type_label || weakestArea?.adTypeLabel || '데이터 없음'}</p>
              <p className="mt-2 text-sm font-bold text-slate-300">ROAS {pct(weakestArea?.roas || 0)} · 광고비 {won(weakestArea?.ad_cost || 0)}</p>
            </div>
          </div>
        </Panel>
        <Panel title="네이버 광고 영역 비교">
          <BarList rows={naverRows} labelKey="ad_type_label" valueKey="sales_amount" meta={(row) => `광고비 ${won(row.ad_cost)} · 클릭 ${count(row.click_count)} · ROAS ${pct(row.roas)}`} />
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="광고 채널 ROAS 비교">
          <BarList rows={filteredRows} labelKey="ad_channel" valueKey="sales_amount" meta={(row) => `광고비 ${won(row.ad_cost)} · ROAS ${pct(row.roas)}`} />
        </Panel>
        <Panel title="광고 성과 상세">
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'source', label: '출처', render: (row) => row.source === 'NAVER_SEARCH_AD' ? '네이버 연동' : '직접 입력' },
              { key: 'product_name', label: '제품', render: (row) => row.product_name || '-' },
              { key: 'ad_type_label', label: '광고 영역', render: (row) => row.ad_type_label || row.adTypeLabel || '-' },
              { key: 'ad_channel', label: '광고 채널' },
              { key: 'report_month', label: '기준일' },
              { key: 'ad_cost', label: '광고비', render: (row) => won(row.ad_cost) },
              { key: 'click_count', label: '클릭수', render: (row) => count(row.click_count) },
              { key: 'cpa', label: 'CPA', render: (row) => won(row.cpa) },
              { key: 'roas', label: 'ROAS', render: (row) => pct(row.roas) },
              { key: 'conversion_rate', label: '구매 전환율', render: (row) => pct(row.conversion_rate) },
              { key: 'sales_amount', label: '매출', render: (row) => won(row.sales_amount) },
              { key: 'net_profit', label: '순이익', render: (row) => won(row.net_profit) },
            ]}
            defaultSort="roasDesc"
            sortOptions={[
              { id: 'roasDesc', label: 'ROAS 높은 순', key: 'roas' },
              { id: 'roasAsc', label: 'ROAS 낮은 순', key: 'roas', direction: 'asc' },
              { id: 'costDesc', label: '광고비 높은 순', key: 'ad_cost' },
              { id: 'clickDesc', label: '클릭수 높은 순', key: 'click_count' },
              { id: 'salesDesc', label: '매출 높은 순', key: 'sales_amount' },
              { id: 'profitDesc', label: '순익 높은 순', key: 'net_profit' },
              { id: 'dateDesc', label: '최근 기준일 순', key: 'report_month', type: 'date' },
            ]}
          />
        </Panel>
      </section>
    </>
  )
}
