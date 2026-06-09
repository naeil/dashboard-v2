import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  getExecutiveChannelSales,
  getExecutiveIssues,
  getExecutiveMonthlySales,
  getExecutiveProductProfits,
  getExecutiveSummary,
} from '../../api/executiveApi'
import { BarList, DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, statusLabel, won } from './formatters'

const issueFields = [
  { name: 'issue_date', label: '일자', type: 'date', required: true },
  { name: 'severity', label: '중요도', type: 'select', required: true, options: [
    { value: 'LOW', label: '낮음' },
    { value: 'MEDIUM', label: '보통' },
    { value: 'HIGH', label: '높음' },
    { value: 'CRITICAL', label: '긴급' },
  ] },
  { name: 'category', label: '카테고리', required: true, placeholder: '현금흐름, 미수금, 재고' },
  { name: 'title', label: '제목', required: true, wide: true },
  { name: 'description', label: '상세 내용', wide: true },
  { name: 'status', label: '상태', type: 'select', options: [
    { value: 'OPEN', label: '진행중' },
    { value: 'IN_PROGRESS', label: '처리중' },
    { value: 'RESOLVED', label: '완료' },
  ] },
]

export default function ExecutiveSummary({ onNavigate }) {
  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [channels, setChannels] = useState([])
  const [products, setProducts] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('2026-05')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')

  const load = () => {
    setLoading(true)
    return Promise.all([
      getExecutiveSummary(),
      getExecutiveMonthlySales(),
      getExecutiveChannelSales(),
      getExecutiveProductProfits(),
      getExecutiveIssues(),
    ])
      .then(([summaryRes, monthlyRes, channelRes, productRes, issueRes]) => {
        setSummary(summaryRes.data)
        setMonthly(monthlyRes.data || [])
        setChannels(channelRes.data || [])
        setProducts(productRes.data || [])
        setIssues(issueRes.data || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const safeSummary = summary || {}
  const selectedYear = selectedMonth.slice(0, 4)
  const selectedMonthLabel = `${Number(selectedMonth.slice(5, 7))}월`
  const yearlyRows = monthly.filter((row) => String(row.report_month).slice(0, 4) === selectedYear)
  const selectedMonthRow = monthly.find((row) => String(row.report_month).slice(0, 7) === selectedMonth) || {}
  const chartMax = Math.max(0, ...monthly.map((row) => Math.max(Number(row.sales_amount || 0), Number(row.operating_profit || 0))))
  const topProducts = useMemo(() => [...products]
    .sort((a, b) => Number(b.expected_net_profit || 0) - Number(a.expected_net_profit || 0))
    .slice(0, 5), [products])

  const yearlySales = yearlyRows.reduce((sum, row) => sum + Number(row.sales_amount || 0), 0)
  const yearlyOperatingProfit = yearlyRows.reduce((sum, row) => sum + Number(row.operating_profit || 0), 0)
  const selectedMonthSales = Number(selectedMonthRow.sales_amount || 0)
  const selectedMonthOperatingProfit = Number(selectedMonthRow.operating_profit || 0)
  const selectedMonthMargin = selectedMonthSales > 0 ? (selectedMonthOperatingProfit / selectedMonthSales) * 100 : 0
  const previousMonthSales = Number(safeSummary.previous_month_sales || 0)
  const salesChangeRate = previousMonthSales > 0 ? ((Number(safeSummary.month_sales || 0) - previousMonthSales) / previousMonthSales) * 100 : 0
  const adCostRate = Number(safeSummary.month_sales || 0) > 0 ? (Number(safeSummary.month_ad_cost || 0) / Number(safeSummary.month_sales || 0)) * 100 : 0
  const riskyProducts = products.filter((product) => Number(product.expected_net_profit || 0) < 0 || Number(product.margin_rate || 0) < 10)
  const stockRiskProducts = products.filter((product) => ['LOW_STOCK', 'OVER_STOCK'].includes(product.status))
  const bestProfitProduct = [...products].sort((a, b) => Number(b.expected_net_profit || 0) - Number(a.expected_net_profit || 0))[0]
  const weakestChannel = [...channels].sort((a, b) => Number(a.net_profit || 0) - Number(b.net_profit || 0))[0]
  const strongestChannel = [...channels].sort((a, b) => Number(b.net_profit || 0) - Number(a.net_profit || 0))[0]
  const executiveAlerts = [
    {
      key: 'cash',
      title: '현금 부족 예상',
      value: safeSummary.expectedCashShortageDate || '30일 내 부족 없음',
      active: Boolean(safeSummary.expectedCashShortageDate),
      page: 'cash-flow',
    },
    {
      key: 'ad',
      title: '광고비 과다',
      value: `매출 대비 ${pct(adCostRate)}`,
      active: adCostRate >= 12,
      page: 'ad-performance',
    },
    {
      key: 'stock',
      title: '운영 위임 이슈',
      value: count(safeSummary.inventory_risk_count, '개 감지'),
      active: Number(safeSummary.inventory_risk_count || 0) > 0,
      page: 'inventory',
    },
    {
      key: 'receivable',
      title: '미수 증가',
      value: count(safeSummary.risky_receivable_count, '곳 위험'),
      active: Number(safeSummary.risky_receivable_count || 0) > 0,
      page: 'receivables',
    },
    {
      key: 'sku',
      title: '특정 SKU 적자',
      value: count(riskyProducts.length, '개 후보'),
      active: riskyProducts.length > 0,
      page: 'product-profit',
    },
  ]
  const todayRisks = executiveAlerts.filter((alert) => alert.active)
  const aiPriorities = [
    todayRisks.some((alert) => alert.key === 'cash') ? '현금 유출 예정과 미수금 회수 일정을 오늘 먼저 조정하세요.' : '현금흐름은 즉시 위험 신호가 낮습니다.',
    salesChangeRate < -5 ? `매출이 전월 대비 ${pct(salesChangeRate)} 하락했습니다. 채널별 매출 감소 원인을 먼저 확인하세요.` : `매출은 전월 대비 ${pct(salesChangeRate)} 흐름입니다.`,
    adCostRate >= 12 ? '광고비 비중이 높습니다. ROAS 낮은 캠페인은 예산을 줄이는 쪽이 우선입니다.' : '광고비 비중은 관리 가능한 구간입니다.',
    stockRiskProducts.length > 0 ? `재고 위험 SKU ${count(stockRiskProducts.length, '개')}를 생산/프로모션 계획에 반영하세요.` : '재고 위험 신호는 낮습니다.',
  ]

  const answerAiQuestion = (question) => {
    const normalized = question.toLowerCase()
    const cashLine = `현금흐름: 현재 현금 ${won(summary.cash_balance)}, 오늘 입금 ${won(summary.today_inflow)}, 오늘 출금 ${won(summary.today_outflow)}, 현금 부족 예상일 ${summary.expectedCashShortageDate || '없음'}.`
    const profitLine = `수익성: 이번 달 매출 ${won(summary.month_sales)}, 영업이익 ${won(summary.month_operating_profit)}, 평균 마진 ${pct(summary.average_margin_rate)}, 광고비 ${won(summary.month_ad_cost)}입니다.`
    const receivableLine = `미수금: 총 미수 ${won(summary.receivable_total)}, 위험 거래처 ${count(summary.risky_receivable_count, '곳')}입니다.`
    const inventoryLine = `재고: 평가금액 ${won(summary.inventory_value)}, 위험 SKU ${count(summary.inventory_risk_count, '개')}입니다.`
    const channelLine = `채널: 최고 이익 후보는 ${strongestChannel?.channel_name || '데이터 없음'}, 축소 점검 후보는 ${weakestChannel?.channel_name || '데이터 없음'}입니다.`
    const productLine = `제품: 이익 상위 후보는 ${bestProfitProduct?.product_name || '데이터 없음'}, 저마진/적자 후보는 ${count(riskyProducts.length, '개')}입니다.`

    if (normalized.includes('손익') || normalized.includes('왜 떨어')) {
      return [
        'CFO/COO 판단: 손익 하락 원인은 매출, 광고비, 채널 이익을 같이 봐야 합니다.',
        cashLine,
        profitLine,
        `매출 위험: 전월 대비 매출 변화율은 ${pct(salesChangeRate)}입니다.`,
        `광고 위험: 광고비율은 ${pct(adCostRate)}입니다. ${adCostRate >= 12 ? '현재 광고비 과다 구간입니다.' : '현재 광고비는 과다 신호가 강하지 않습니다.'}`,
        channelLine,
        `운영 우선순위: 1) ${weakestChannel?.channel_name || '저수익 채널'} 이익 구조 확인 2) 광고비율 재점검 3) 미수금 ${won(summary.receivable_total)} 회수 계획 확인.`,
      ].join('\n')
    }
    if (normalized.includes('bep') || normalized.includes('단백') || normalized.includes('몇 봉')) {
      const targetProduct = products.find((product) => String(product.product_name || '').includes('단백깡'))
      if (!targetProduct || !Number(targetProduct.expected_net_profit || 0) || !Number(targetProduct.sold_quantity || 0)) {
        return [
          'CFO/COO 판단: 단백깡 BEP는 현재 제공된 숫자만으로 정확히 계산할 수 없습니다.',
          `확인된 고정비: ${won(summary.month_fixed_cost)}.`,
          '부족 데이터: 단백깡 판매수량, 단백깡 단위 판매가, 단백깡 단위 원가, 단백깡 광고비 또는 단위 공헌이익.',
          '운영 우선순위: 제품 손익 화면에서 단백깡 SKU의 판매수량, 원가, 광고비를 먼저 확정해야 합니다.',
        ].join('\n')
      }
      const unitProfit = Number(targetProduct.expected_net_profit || 0) / Number(targetProduct.sold_quantity || 1)
      const fixedCost = Number(summary.month_fixed_cost || 0)
      return [
        'CFO/COO 판단: 단백깡 BEP 계산입니다.',
        `고정비: ${won(fixedCost)}.`,
        `단백깡 단위 이익 추정: ${won(unitProfit)}.`,
        `BEP 필요 판매량: ${count(Math.ceil(fixedCost / Math.max(1, unitProfit)), '개')}.`,
        '운영 우선순위: 단위 이익이 낮으면 광고비보다 판매가/원가 구조를 먼저 조정해야 합니다.',
      ].join('\n')
    }
    if (normalized.includes('온라인') || normalized.includes('수출')) {
      return [
        'CFO/COO 판단: 온라인 vs 수출 집중도는 현금 회수와 실제 이익 기준으로 결정해야 합니다.',
        `온라인/채널 매출: ${won(summary.channel_month_sales)}.`,
        `수출·컨설팅 입금: ${won(summary.consulting_month_sales)}.`,
        `예정 계약금액: ${won(summary.consulting_expected_month_sales)}.`,
        receivableLine,
        '부족 데이터: 수출 건별 원가, 수출 입금 확정일, 온라인 채널별 순이익률이 더 필요합니다.',
        `운영 우선순위: 단기 현금은 입금 확정성이 높은 쪽, 실행 에너지는 ${strongestChannel?.channel_name || '이익률 높은 채널'} 중심으로 배분하세요.`,
      ].join('\n')
    }
    return [
      'CFO/COO 요약 판단입니다.',
      cashLine,
      profitLine,
      receivableLine,
      inventoryLine,
      productLine,
      channelLine,
      `운영 우선순위: ${todayRisks[0]?.title || '채널별 이익률'}을 먼저 확인하세요.`,
      todayRisks.length ? `오늘 감지된 위험: ${todayRisks.map((risk) => risk.title).join(', ')}.` : '오늘 즉시 위험 신호는 낮습니다.',
    ].join('\n')
  }

  const handleAiQuestion = (question = aiQuestion) => {
    if (!question.trim()) {
      return
    }
    setAiQuestion(question)
    setAiAnswer(answerAiQuestion(question))
  }

  if (loading || !summary) {
    return <PageHeader title="경영 요약" description="대시보드 데이터를 불러오는 중입니다." />
  }

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title="경영 요약" description="주요 지표를 누르면 관련 화면에서 검색, 수정, 입력을 바로 이어갈 수 있습니다." />
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            {loading ? '업데이트 중...' : '최신 데이터 업데이트'}
          </button>
          <button
            type="button"
            onClick={() => setShowIssueForm((prev) => !prev)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white/10 px-5 text-sm font-black text-white transition-colors hover:bg-white/15"
          >
            <span className="material-symbols-outlined text-base">{showIssueForm ? 'close' : 'notification_add'}</span>
            {showIssueForm ? '이슈 입력 닫기' : '이슈 로그 입력'}
          </button>
        </div>
      </div>

      {showIssueForm && (
        <RecordForm
          title="이슈 로그 입력"
          fields={issueFields}
          initialValues={{ severity: 'MEDIUM', status: 'OPEN' }}
          onSubmit={async (values) => {
            await createExecutiveRecord('issues', values)
            await load()
            setShowIssueForm(false)
          }}
        />
      )}

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="AI 경영 브리핑"
          right={<span className={`rounded-full border px-3 py-1 text-[11px] font-black ${todayRisks.length ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{todayRisks.length ? `오늘 위험 ${todayRisks.length}건` : '정상 범위'}</span>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => onNavigate?.('cash-flow')} className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="flex items-center gap-2 text-xs font-black text-slate-500"><span className="material-symbols-outlined text-base">account_balance_wallet</span>금주 현금 흐름</p>
              <p className="mt-2 text-lg font-black text-slate-950">{summary.expectedCashShortageDate ? `${summary.expectedCashShortageDate} 부족 예상` : '30일 내 부족 없음'}</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('channel-sales')} className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="flex items-center gap-2 text-xs font-black text-slate-500"><span className="material-symbols-outlined text-base">leaderboard</span>매출 위험</p>
              <p className="mt-2 text-lg font-black text-slate-950">전월 대비 {pct(salesChangeRate)}</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('ad-performance')} className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="flex items-center gap-2 text-xs font-black text-slate-500"><span className="material-symbols-outlined text-base">campaign</span>광고 위험</p>
              <p className="mt-2 text-lg font-black text-slate-950">광고비율 {pct(adCostRate)}</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('inventory')} className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="flex items-center gap-2 text-xs font-black text-slate-500"><span className="material-symbols-outlined text-base">warehouse</span>운영 위임 이슈</p>
              <p className="mt-2 text-lg font-black text-slate-950">{count(summary.inventory_risk_count, '개')}</p>
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black text-sky-700">대표 우선 순위</p>
            <ol className="mt-3 space-y-2">
              {aiPriorities.map((priority, index) => (
                <li key={priority} className="flex gap-3 text-sm font-bold text-slate-700">
                  <span className="text-sky-600">{index + 1}</span>
                  <span>{priority}</span>
                </li>
              ))}
            </ol>
          </div>
        </Panel>

        <Panel title="AI CFO/COO 질문">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              handleAiQuestion()
            }}
          >
            <input
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
              placeholder="이번 달 손익이 왜 떨어졌어?"
              className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
            />
            <button type="submit" className="h-11 rounded-lg bg-sky-600 px-4 text-sm font-black text-white transition-colors hover:bg-sky-500">
              질문
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {['이번 달 손익이 왜 떨어졌어?', '단백깡 몇 봉 팔아야 BEP 달성할 수 있지?', '온라인 vs 수출 어디에 집중해야 해?'].map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleAiQuestion(question)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700"
              >
                {question}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold leading-5 text-slate-500">
            현금흐름, 수익성, 미수금, 재고 위험, 제품 마진, 채널 성과, 운영 우선순위 순서로 답변합니다. 제공된 대시보드 숫자만 사용합니다.
          </div>
          <div className="mt-4 min-h-24 whitespace-pre-line rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-bold leading-6 text-slate-700">
            {aiAnswer || '질문을 입력하면 현재 대시보드 지표를 기준으로 CFO/COO 관점의 답변을 제공합니다.'}
          </div>
        </Panel>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="AI 경고 시스템">
          <div className="grid gap-3 sm:grid-cols-2">
            {executiveAlerts.map((alert) => (
              <button
                key={alert.key}
                type="button"
                onClick={() => onNavigate?.(alert.page)}
                className={`rounded-lg border p-4 text-left transition-colors ${alert.active ? 'border-rose-200 bg-rose-50 hover:bg-rose-100' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'}`}
              >
                <p className="text-xs font-black text-slate-600">{alert.title}</p>
                <p className="mt-2 text-lg font-black text-slate-950">{alert.value}</p>
                <p className={`mt-2 text-[11px] font-black ${alert.active ? 'text-rose-700' : 'text-emerald-700'}`}>{alert.active ? '감지됨' : '정상'}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="AI 전략 분석">
          <div className="space-y-3">
            <button type="button" onClick={() => onNavigate?.('export-pipeline')} className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="text-sm font-black text-slate-950">온라인 vs 수출 집중 방향</p>
              <p className="mt-2 text-sm font-bold text-slate-500">온라인 매출 {won(summary.channel_month_sales)} / 수출·컨설팅 입금 {won(summary.consulting_month_sales)}. 현금 회수 속도와 마진율을 함께 비교하세요.</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('product-profit')} className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="text-sm font-black text-slate-950">실제 이익 제품</p>
              <p className="mt-2 text-sm font-bold text-slate-500">{bestProfitProduct?.product_name || '제품 데이터 없음'}이 현재 이익 기여 상위 후보입니다. 적자/저마진 SKU {count(riskyProducts.length, '개')}를 같이 정리하세요.</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('channel-sales')} className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50">
              <p className="text-sm font-black text-slate-950">채널 에너지 재배분</p>
              <p className="mt-2 text-sm font-bold text-slate-500">강화 후보: {strongestChannel?.channel_name || '-'} / 축소 점검 후보: {weakestChannel?.channel_name || '-'}. 매출보다 순이익 기준으로 판단하세요.</p>
            </button>
          </div>
        </Panel>
      </section>

      <Panel
        title={`${selectedYear}년도 매출 현황`}
        right={(
          <label className="flex items-center gap-2 text-xs font-black text-slate-400">
            <span className="material-symbols-outlined text-base">calendar_month</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-sky-400"
            />
          </label>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
            <p className="text-xs font-black text-slate-400">{selectedYear}년도 매출</p>
            <p className="mt-2 text-2xl font-black text-white">{won(yearlySales)}</p>
            <p className="mt-1 text-xs font-bold text-sky-100">영업이익 {won(yearlyOperatingProfit)}</p>
          </div>
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
            <p className="text-xs font-black text-slate-400">{selectedMonthLabel} 매출</p>
            <p className="mt-2 text-2xl font-black text-white">{won(selectedMonthSales)}</p>
            <p className="mt-1 text-xs font-bold text-emerald-100">영업이익 {won(selectedMonthOperatingProfit)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/60 p-5">
            <p className="text-xs font-black text-slate-400">{selectedMonthLabel} 평균 마진율</p>
            <p className="mt-2 text-2xl font-black text-white">{pct(selectedMonthMargin)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">선택 월 기준</p>
          </div>
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-5">
            <p className="text-xs font-black text-slate-400">이번 달 매출 구성</p>
            <p className="mt-2 text-sm font-black text-white">채널 {won(summary.channel_month_sales)}</p>
            <p className="mt-1 text-sm font-black text-white">컨설팅 입금 {won(summary.consulting_month_sales)}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">예정 계약금액 {won(summary.consulting_expected_month_sales)}</p>
          </div>
        </div>
      </Panel>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="현금 잔고 / 계좌 잔액" value={won(summary.cash_balance)} badge={summary.cashRiskStatus} tone="amber" icon="account_balance" onClick={() => onNavigate?.('cash-flow')} actionLabel="계좌/현금흐름 수정" />
        <KpiCard label="미수금 총액" value={won(summary.receivable_total)} badge={summary.risky_receivable_count > 0 ? 'HIGH' : 'NORMAL'} tone="rose" icon="request_quote" onClick={() => onNavigate?.('receivables')} actionLabel="미수금 검색/수정" />
        <KpiCard label="재고 평가 금액" value={won(summary.inventory_value)} icon="inventory_2" onClick={() => onNavigate?.('inventory')} actionLabel="재고 검색" />
        <KpiCard label="현재 대출 잔액" value={won(summary.debt_balance)} tone="amber" icon="credit_score" onClick={() => onNavigate?.('debts')} actionLabel="대출/부채 검색" />
        <KpiCard label="고정비" value={won(summary.month_fixed_cost)} icon="receipt_long" onClick={() => onNavigate?.('operating-expenses')} actionLabel="비용 검색/수정" />
        <KpiCard label="광고비" value={won(summary.month_ad_cost)} tone="amber" icon="campaign" onClick={() => onNavigate?.('ad-performance')} actionLabel="광고 성과 검색" />
        <KpiCard label="현금 부족 예상일" value={summary.expectedCashShortageDate || '없음'} badge={summary.expectedCashShortageDate ? 'HIGH' : 'NORMAL'} tone={summary.expectedCashShortageDate ? 'rose' : 'emerald'} icon="event_busy" onClick={() => onNavigate?.('cash-flow')} actionLabel="예정 입출금 확인" />
        <KpiCard label="평균 마진율" value={pct(summary.average_margin_rate)} tone="emerald" icon="percent" onClick={() => onNavigate?.('channel-sales')} actionLabel="채널 매출 분석" />
        <KpiCard label="재고 위험수" value={count(summary.inventory_risk_count, '개')} badge={summary.inventory_risk_count > 0 ? 'WATCH' : 'NORMAL'} icon="production_quantity_limits" onClick={() => onNavigate?.('inventory')} actionLabel="위험 재고 검색" />
        <KpiCard label="미수금 위험 거래처 수" value={count(summary.risky_receivable_count, '곳')} badge={summary.risky_receivable_count > 0 ? 'HIGH' : 'NORMAL'} tone="rose" icon="gpp_maybe" onClick={() => onNavigate?.('receivables')} actionLabel="위험 거래처 검색" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="월 매출 / 영업이익" right={<StatusBadge value={summary.cashRiskStatus} />}>
          <div className="flex h-72 items-end gap-4">
            {monthly.map((row) => {
              const salesValue = Number(row.sales_amount || 0)
              const profitValue = Number(row.operating_profit || 0)
              const salesHeight = chartMax > 0 ? (salesValue / chartMax) * 100 : 0
              const profitHeight = chartMax > 0 ? (profitValue / chartMax) * 100 : 0
              return (
                <div key={row.report_month} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                  <div className="flex h-56 w-full items-end justify-center gap-1 rounded-lg bg-slate-950/50 px-2">
                    <div
                      className="w-1/2 rounded-t-md bg-sky-400"
                      style={{ height: `${salesValue > 0 ? Math.max(4, salesHeight) : 0}%` }}
                    />
                    <div
                      className="w-1/2 rounded-t-md bg-emerald-400"
                      style={{ height: `${profitValue > 0 ? Math.max(4, profitHeight) : 0}%` }}
                    />
                  </div>
                  <span className="block truncate text-xs font-bold text-slate-500">{String(row.report_month).slice(0, 7)}</span>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="채널별 매출 비중" right={<button type="button" onClick={() => onNavigate?.('channel-sales')} className="text-xs font-black text-sky-200 hover:text-sky-100">채널 매출 보기</button>}>
          <BarList
            rows={channels.slice(0, 8)}
            labelKey="channel_name"
            valueKey="sales_amount"
            meta={(row) => `주문 ${count(row.order_count, '건')} · 이익 ${won(row.net_profit)}`}
          />
        </Panel>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="제품별 수익 TOP5" right={<button type="button" onClick={() => onNavigate?.('product-profit')} className="text-xs font-black text-sky-200 hover:text-sky-100">제품 손익 수정</button>}>
          <BarList
            rows={topProducts}
            labelKey="product_name"
            valueKey="expected_net_profit"
            meta={(row) => `${row.sku} · 마진 ${pct(row.margin_rate)} · 재고 ${count(row.stock_quantity, '개')}`}
          />
        </Panel>

        <Panel title="최근 이슈 로그" right={<span className="text-xs font-bold text-rose-300">긴급 {summary.urgentIssueCount}건</span>}>
          <DataTable
            rows={issues.slice(0, 8)}
            rowKey={(row) => row.id}
            searchPlaceholder="이슈 제목, 카테고리, 상태 검색"
            columns={[
              { key: 'issue_date', label: '일자' },
              { key: 'severity', label: '중요도', render: (row) => <StatusBadge value={row.severity} /> },
              { key: 'category', label: '카테고리' },
              { key: 'title', label: '제목' },
              { key: 'status', label: '상태', render: (row) => statusLabel(row.status) },
            ]}
          />
        </Panel>
      </section>
    </>
  )
}
