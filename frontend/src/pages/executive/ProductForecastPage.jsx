import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveProductForecasts,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

const numberValue = (value) => Number(value || 0)
const roundValue = (value) => Math.round(Number(value || 0) * 100) / 100
const MIN_MARKETING_RATE = 3
const MIN_ONLINE_AD_RATE = 10
const FORECAST_MONTHS = 12
const LOAN_REPAYMENT_TARGET = 100_000_000
const MONTHLY_GROWTH_FACTORS = [0.35, 0.55, 0.75, 0.95, 1.1, 1.25, 1.4, 1.55, 1.7, 1.85, 2.0, 2.15]
const ALL_PRODUCTS = '전체'

const CHECKLIST_STATUS = {
  WAITING: { label: '대기', tone: 'slate', score: 0 },
  IN_PROGRESS: { label: '진행중', tone: 'sky', score: 0.45 },
  DONE: { label: '완료', tone: 'emerald', score: 1 },
  RISK: { label: '위험', tone: 'rose', score: 0 },
  HOLD: { label: '보류', tone: 'amber', score: 0.15 },
}

const NPD_CHECKLIST_CATEGORIES = [
  {
    id: 'planning',
    label: '제품 기획',
    metricLabel: '기획 준비율',
    items: ['제품명 확정', '제품 컨셉 정의', '핵심 타겟 정의', '경쟁 제품 조사', '예상 판매가 검토', '예상 원가 검토', '예상 영업이익률 계산', 'MOQ 확인', 'OEM 가능 여부 확인', '시장 검색량 조사', '수출 가능성 검토'],
  },
  {
    id: 'production',
    label: '생산 / 원료',
    metricLabel: '생산 준비율',
    items: ['원료 수급 가능 여부', '원료 단가 확정', '샘플 생산 완료', '맛 테스트 완료', '영양성분 검증 완료', '표시사항 검토 완료', 'OEM QC 체크 완료', '유통기한 테스트 완료', '패키지 오탈자 검수 완료', '생산 일정 확정', '초도 생산 수량 확정'],
  },
  {
    id: 'branding',
    label: '디자인 / 브랜딩',
    metricLabel: '브랜딩 준비율',
    items: ['패키지 디자인 완료', '패키지 목업 확인', '상세페이지 완료', '썸네일 제작 완료', '브랜드 메시지 정리', '광고 소재 제작', 'SNS 콘텐츠 제작', '제품 촬영 완료', '영상 콘텐츠 제작'],
  },
  {
    id: 'sales',
    label: '판매 채널',
    metricLabel: '채널 준비율',
    items: ['스마트스토어 등록', '쿠팡 등록', '자사몰 등록', '배송 정책 설정', 'CS 정책 설정', '반품 정책 설정', '재고 시스템 등록', '바코드 등록', '오프라인 제안서 준비', '수출 영문자료 준비'],
  },
  {
    id: 'marketing',
    label: '마케팅',
    metricLabel: '마케팅 준비율',
    items: ['키워드 조사 완료', '광고 예산 설정', 'ROAS 목표 설정', '체험단 모집', '리뷰 확보 계획', '인플루언서 리스트업', 'Meta 광고 세팅', '네이버 광고 세팅', '리타겟팅 세팅', '초기 이벤트 기획'],
  },
  {
    id: 'cashflow',
    label: '현금흐름 / 운영',
    metricLabel: '운영 준비율',
    items: ['생산 선금 확인', '광고 선집행 비용 확인', '예상 입금일 계산', '오프라인 정산일 확인', '수출 결제 조건 확인', '월 고정비 반영', '재생산 가능 시점 계산', '손익분기점 계산', '재고 소진 예상일 계산'],
  },
  {
    id: 'postLaunch',
    label: '런칭 후 운영',
    metricLabel: '운영 추적율',
    items: ['광고 CTR 확인', '광고 CPA 확인', 'ROAS 확인', '장바구니 이탈률 확인', '리뷰 수집', '재구매율 확인', '재발주 여부 확인', '오프라인 회전 확인', '수출 재주문 여부 확인'],
  },
]

const CRITICAL_NPD_ITEMS = new Set([
  '예상 판매가 검토',
  '예상 원가 검토',
  '예상 영업이익률 계산',
  'MOQ 확인',
  '원료 수급 가능 여부',
  '영양성분 검증 완료',
  '표시사항 검토 완료',
  '생산 일정 확정',
  '초도 생산 수량 확정',
  '스마트스토어 등록',
  '쿠팡 등록',
  '재고 시스템 등록',
  '키워드 조사 완료',
  '광고 예산 설정',
  'ROAS 목표 설정',
  'Meta 광고 세팅',
  '네이버 광고 세팅',
  '생산 선금 확인',
  '광고 선집행 비용 확인',
  '예상 입금일 계산',
  '손익분기점 계산',
  '재고 소진 예상일 계산',
])

const forecastFields = [
  { name: 'product_name', label: '신제품명', required: true },
  { name: 'brand_name', label: '브랜드', type: 'select', required: true, options: [
    { value: '하이프리', label: '하이프리' },
    { value: '국민한상', label: '국민한상' },
  ] },
  { name: 'category', label: '제품 카테고리' },
  { name: 'npd_stage', label: 'NPD 단계', type: 'select', required: true, options: [
    { value: 'IDEA', label: '아이디어' },
    { value: 'RND', label: 'R&D' },
    { value: 'SAMPLE', label: '샘플 개발' },
    { value: 'COSTING', label: '원가 검토' },
    { value: 'LAUNCH_READY', label: '출시 준비' },
    { value: 'LAUNCHED', label: '출시 완료' },
  ] },
  { name: 'launch_month', label: '예상 출시월', type: 'date' },
  { name: 'forecast_months', label: '예상 기간(개월, 12개월 고정)', type: 'number', required: true, readOnly: true },
  { name: 'expected_monthly_units', label: '기준 월 판매수량', type: 'number', required: true },
  { name: 'expected_selling_price', label: '예상 판매가', type: 'number', required: true },
  { name: 'unit_production_cost', label: '개당 생산원가', type: 'number', required: true },
  { name: 'platform_fee_rate', label: '채널 수수료율(%)', type: 'number' },
  { name: 'ad_cost_rate', label: '광고비율(%)', type: 'number' },
  { name: 'operating_admin_rate', label: '운영 판관비율(%)', type: 'number' },
  { name: 'logistics_cost_per_unit', label: '개당 물류비', type: 'number' },
  { name: 'expected_sales', label: '예상 매출', type: 'number', readOnly: true },
  { name: 'expected_gross_profit', label: '예상 매출이익', type: 'number', readOnly: true },
  { name: 'expected_gross_margin_rate', label: '예상 매출이익률', type: 'number', readOnly: true },
  { name: 'expected_operating_profit', label: '예상 영업이익', type: 'number', readOnly: true },
  { name: 'expected_operating_margin_rate', label: '예상 영업이익률', type: 'number', readOnly: true },
  { name: 'memo', label: '메모', wide: true },
]

const stageLabels = {
  IDEA: '아이디어',
  RND: 'R&D',
  SAMPLE: '샘플 개발',
  COSTING: '원가 검토',
  LAUNCH_READY: '출시 준비',
  LAUNCHED: '출시 완료',
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, countToAdd) {
  return new Date(date.getFullYear(), date.getMonth() + countToAdd, 1)
}

function parseMonth(value) {
  if (!value) return null
  const parsed = new Date(`${String(value).slice(0, 7)}-01T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : monthStart(parsed)
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
}

function shortMonthLabel(date) {
  return `${date.getMonth() + 1}월`
}

function growthFactor(index) {
  return MONTHLY_GROWTH_FACTORS[Math.min(index, MONTHLY_GROWTH_FACTORS.length - 1)]
}

function forecastMonthCount() {
  return FORECAST_MONTHS
}

function forecastedUnits(row, index) {
  return Math.round(numberValue(row.expected_monthly_units) * growthFactor(index))
}

function monthlyForecastValues(row, index) {
  const units = forecastedUnits(row, index)
  const sales = units * numberValue(row.expected_selling_price)
  const productionCost = units * numberValue(row.unit_production_cost)
  const logisticsCost = units * numberValue(row.logistics_cost_per_unit)
  const grossProfit = sales - productionCost
  const platformFee = sales * (numberValue(row.platform_fee_rate) / 100)
  const adCost = sales * (numberValue(row.ad_cost_rate) / 100)
  const adminCost = sales * (numberValue(row.operating_admin_rate) / 100)
  const operatingProfit = grossProfit - platformFee - adCost - adminCost - logisticsCost

  return {
    units,
    sales,
    grossProfit,
    operatingProfit,
  }
}

function computeForecastValues(values) {
  const normalizedValues = { ...values, forecast_months: FORECAST_MONTHS }
  const monthlyValues = Array.from({ length: forecastMonthCount() }, (_, index) => monthlyForecastValues(normalizedValues, index))
  const expectedSales = monthlyValues.reduce((sum, month) => sum + month.sales, 0)
  const grossProfit = monthlyValues.reduce((sum, month) => sum + month.grossProfit, 0)
  const operatingProfit = monthlyValues.reduce((sum, month) => sum + month.operatingProfit, 0)

  return {
    ...normalizedValues,
    expected_sales: roundValue(expectedSales),
    expected_gross_profit: roundValue(grossProfit),
    expected_gross_margin_rate: expectedSales > 0 ? roundValue((grossProfit / expectedSales) * 100) : 0,
    expected_operating_profit: roundValue(operatingProfit),
    expected_operating_margin_rate: expectedSales > 0 ? roundValue((operatingProfit / expectedSales) * 100) : 0,
  }
}

function toInitialValues(row) {
  return forecastFields.reduce((acc, field) => {
    acc[field.name] = row?.[field.name] ?? ''
    return acc
  }, {})
}

function MetricCard({ label, value, tone = 'sky' }) {
  const toneMap = {
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  }
  return (
    <article className={`rounded-lg border p-5 ${toneMap[tone]}`}>
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </article>
  )
}

function ForecastStatus({ row }) {
  const margin = numberValue(row.expected_operating_margin_rate)
  const className = margin < 0
    ? 'border-rose-400/30 bg-rose-400/15 text-rose-100'
    : margin < 10
      ? 'border-amber-400/30 bg-amber-400/15 text-amber-100'
      : 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
  const label = margin < 0 ? '손실 예상' : margin < 10 ? '마진 주의' : '검토 가능'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{label}</span>
}

function checklistItemKey(categoryId, item) {
  return `${categoryId}::${item}`
}

function inferredChecklistState(row) {
  const state = {}
  NPD_CHECKLIST_CATEGORIES.forEach((category) => {
    category.items.forEach((item) => {
      state[checklistItemKey(category.id, item)] = 'WAITING'
    })
  })

  const markDone = (categoryId, item, condition) => {
    if (condition) state[checklistItemKey(categoryId, item)] = 'DONE'
  }

  markDone('planning', '제품명 확정', Boolean(row.product_name))
  markDone('planning', '예상 판매가 검토', numberValue(row.expected_selling_price) > 0)
  markDone('planning', '예상 원가 검토', numberValue(row.unit_production_cost) > 0)
  markDone('planning', '예상 영업이익률 계산', numberValue(row.expected_sales) > 0)
  markDone('planning', 'MOQ 확인', numberValue(row.expected_monthly_units) > 0)
  markDone('production', '생산 일정 확정', Boolean(row.launch_month))
  markDone('production', '초도 생산 수량 확정', numberValue(row.expected_monthly_units) > 0)
  markDone('marketing', '광고 예산 설정', numberValue(row.ad_cost_rate) > 0)
  markDone('cashflow', '손익분기점 계산', numberValue(row.expected_sales) > 0)

  return state
}

function parseChecklistState(row) {
  const inferred = inferredChecklistState(row)
  if (!row.launch_checklist) return inferred

  try {
    const saved = JSON.parse(row.launch_checklist)
    return { ...inferred, ...saved }
  } catch {
    return inferred
  }
}

function analyzeChecklist(row) {
  const state = parseChecklistState(row)
  const categories = NPD_CHECKLIST_CATEGORIES.map((category) => {
    const items = category.items.map((item) => {
      const key = checklistItemKey(category.id, item)
      const status = state[key] || 'WAITING'
      return {
        key,
        categoryId: category.id,
        categoryLabel: category.label,
        item,
        status,
        critical: CRITICAL_NPD_ITEMS.has(item),
      }
    })
    const weightedScore = items.reduce((sum, item) => sum + (CHECKLIST_STATUS[item.status]?.score || 0), 0)
    const completeCount = items.filter((item) => item.status === 'DONE').length
    const riskCount = items.filter((item) => item.status === 'RISK').length
    return {
      ...category,
      items,
      completeCount,
      riskCount,
      readiness: Math.round((weightedScore / Math.max(1, items.length)) * 100),
    }
  })
  const allItems = categories.flatMap((category) => category.items)
  const completeCount = allItems.filter((item) => item.status === 'DONE').length
  const riskItems = allItems.filter((item) => item.status === 'RISK')
  const holdItems = allItems.filter((item) => item.status === 'HOLD')
  const waitingItems = allItems.filter((item) => item.status === 'WAITING')
  const criticalMissing = allItems.filter((item) => item.critical && item.status !== 'DONE')
  const readiness = Math.round((allItems.reduce((sum, item) => sum + (CHECKLIST_STATUS[item.status]?.score || 0), 0) / Math.max(1, allItems.length)) * 100)
  const margin = numberValue(row.expected_operating_margin_rate)
  const sales = numberValue(row.expected_sales)
  const riskScore = Math.min(100, Math.round(
    riskItems.length * 7
    + holdItems.length * 4
    + waitingItems.length * 1.2
    + criticalMissing.length * 4
    + (!row.launch_month ? 8 : 0)
    + (sales <= 0 ? 8 : 0)
    + (margin < 0 ? 14 : margin < 10 ? 7 : 0),
  ))
  const decision = readiness >= 85 && riskScore <= 22 && criticalMissing.length === 0
    ? '런칭 가능'
    : readiness >= 60 && riskScore <= 55
      ? '주의'
      : '위험'

  return {
    row,
    state,
    categories,
    allItems,
    completeCount,
    totalCount: allItems.length,
    readiness,
    riskScore,
    riskItems,
    holdItems,
    waitingItems,
    criticalMissing,
    decision,
  }
}

function decisionClass(decision) {
  if (decision === '런칭 가능') return 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100'
  if (decision === '주의') return 'border-amber-300/40 bg-amber-300/15 text-amber-100'
  return 'border-rose-300/40 bg-rose-300/15 text-rose-100'
}

function statusButtonClass(status, active) {
  const base = 'h-8 rounded-md border px-2.5 text-[11px] font-black transition-colors'
  const inactive = 'border-white/10 bg-slate-950 text-slate-500 hover:bg-white/5 hover:text-white'
  const activeMap = {
    WAITING: 'border-slate-400/30 bg-slate-500/20 text-slate-100',
    IN_PROGRESS: 'border-sky-300/40 bg-sky-300/15 text-sky-100',
    DONE: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100',
    RISK: 'border-rose-300/40 bg-rose-300/15 text-rose-100',
    HOLD: 'border-amber-300/40 bg-amber-300/15 text-amber-100',
  }
  return `${base} ${active ? activeMap[status] : inactive}`
}

function ReadinessBar({ value, tone = 'sky' }) {
  const color = tone === 'rose' ? 'bg-rose-300' : tone === 'amber' ? 'bg-amber-300' : tone === 'emerald' ? 'bg-emerald-300' : 'bg-sky-300'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

function buildForecastMonths(rows) {
  const startMonth = monthStart()
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = addMonths(startMonth, index)
    return {
      key: monthKey(date),
      date,
      label: monthLabel(date),
      shortLabel: shortMonthLabel(date),
      expectedSales: 0,
      grossProfit: 0,
      operatingProfit: 0,
      launchRows: [],
      activeRows: [],
    }
  })
  const monthMap = new Map(months.map((month) => [month.key, month]))

  rows.forEach((row) => {
    const launchMonth = parseMonth(row.launch_month)
    if (!launchMonth) return

    for (let index = 0; index < forecastMonthCount(); index += 1) {
      const target = monthMap.get(monthKey(addMonths(launchMonth, index)))
      if (!target) continue
      const monthly = monthlyForecastValues(row, index)
      target.expectedSales += monthly.sales
      target.grossProfit += monthly.grossProfit
      target.operatingProfit += monthly.operatingProfit
      target.activeRows.push(row)
    }

    const launchTarget = monthMap.get(monthKey(launchMonth))
    if (launchTarget) launchTarget.launchRows.push(row)
  })

  return months
}

function actionPlanForMonth(index, row) {
  if (index === 0) {
    return '런칭월: 스마트스토어 상품 등록, 상세페이지/썸네일 점검, 초기 쿠폰, 체험단/리뷰 확보, 검색 노출 키워드 세팅이 필요합니다.'
  }
  if (index === 1) {
    return '2개월차: 전환율, 클릭률, 장바구니 이탈을 점검하고 네이버 쇼핑검색/브랜드검색 소재를 A/B 테스트해야 합니다.'
  }
  if (index === 2) {
    return '3개월차: ROAS가 맞는 키워드와 소재만 증액하고, 재구매 쿠폰/알림톡/리뷰 콘텐츠로 반복 구매를 만들어야 합니다.'
  }
  if (numberValue(row.expected_monthly_units) >= 3000) {
    return '확장 구간: 광고 증액 전 재고, 생산 리드타임, CS/물류 처리량을 먼저 확인하고 품절 리스크를 막아야 합니다.'
  }
  return '운영 구간: 광고 효율이 낮은 소재는 중단하고, 유입 키워드와 구매 전환 데이터를 기준으로 판매가/쿠폰을 조정해야 합니다.'
}

function buildMonthlyActionPlans(rows) {
  return rows.flatMap((row) => {
    const launchMonth = parseMonth(row.launch_month)
    if (!launchMonth) return []

    return Array.from({ length: forecastMonthCount() }, (_, index) => {
      const date = addMonths(launchMonth, index)
      const monthly = monthlyForecastValues(row, index)
      const marketingCost = monthly.sales * (MIN_MARKETING_RATE / 100)
      const adCost = monthly.sales * (MIN_ONLINE_AD_RATE / 100)
      return {
        id: `${row.id}-${monthKey(date)}-${index}`,
        productId: row.id,
        productName: row.product_name,
        brandName: row.brand_name,
        monthIndex: index + 1,
        monthKey: monthKey(date),
        monthLabel: monthLabel(date),
        growthRate: growthFactor(index),
        expectedUnits: monthly.units,
        expectedSales: monthly.sales,
        grossProfit: monthly.grossProfit,
        operatingProfit: monthly.operatingProfit,
        marketingCost,
        adCost,
        minimumOnlineBudget: marketingCost + adCost,
        actionPlan: actionPlanForMonth(index, row),
      }
    })
  }).sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.productName.localeCompare(b.productName))
}

function ForecastRevenueChartLegacy({ months }) {
  const maxSales = Math.max(1, ...months.map((month) => month.expectedSales))
  const maxProfit = Math.max(1, ...months.map((month) => Math.abs(month.operatingProfit)))
  const cumulativeMonths = months.reduce((acc, month) => {
    const previous = acc.at(-1)?.cumulativeOperatingProfit || 0
    acc.push({
      ...month,
      cumulativeOperatingProfit: previous + month.operatingProfit,
    })
    return acc
  }, [])
  const maxCumulativeProfit = Math.max(1, ...cumulativeMonths.map((month) => month.cumulativeOperatingProfit))
  const lineScaleMax = Math.max(LOAN_REPAYMENT_TARGET, maxCumulativeProfit)
  const chartLeft = 64
  const chartRight = 1136
  const chartTop = 30
  const chartBottom = 238
  const chartHeight = chartBottom - chartTop
  const linePoints = cumulativeMonths.map((month, index) => {
    const x = chartLeft + index * ((chartRight - chartLeft) / Math.max(1, cumulativeMonths.length - 1))
    const y = chartBottom - Math.max(0, Math.min(1, month.cumulativeOperatingProfit / lineScaleMax)) * chartHeight
    return { x, y, month }
  })
  const targetY = chartBottom - (LOAN_REPAYMENT_TARGET / lineScaleMax) * chartHeight
  const payoffMonth = cumulativeMonths.find((month) => month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET)
  const lastCumulativeProfit = cumulativeMonths.at(-1)?.cumulativeOperatingProfit || 0
  const remainingLoanProfit = Math.max(0, LOAN_REPAYMENT_TARGET - lastCumulativeProfit)
  const gridRows = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/12 p-4">
          <p className="text-[13px] font-black text-amber-100">대출 상환 목표</p>
          <p className="mt-2 text-2xl font-black text-white">{won(LOAN_REPAYMENT_TARGET)}</p>
          <p className="mt-1 text-xs font-bold text-amber-100/80">누적 영업이익 기준</p>
        </div>
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/12 p-4">
          <p className="text-[13px] font-black text-emerald-100">12개월 누적 영업이익</p>
          <p className={`mt-2 text-2xl font-black ${lastCumulativeProfit >= LOAN_REPAYMENT_TARGET ? 'text-white' : 'text-amber-100'}`}>
            {won(lastCumulativeProfit)}
          </p>
          <p className="mt-1 text-xs font-bold text-emerald-100/80">
            {payoffMonth ? `${payoffMonth.label} 상환 가능` : `부족액 ${won(remainingLoanProfit)}`}
          </p>
        </div>
        <div className="rounded-lg border border-sky-300/30 bg-sky-300/12 p-4">
          <p className="text-[13px] font-black text-sky-100">상환선 도달 월</p>
          <p className="mt-2 text-2xl font-black text-white">{payoffMonth?.label || '미도달'}</p>
          <p className="mt-1 text-xs font-bold text-sky-100/80">노란 점선이 1억 기준선입니다.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-950/45 px-4 pb-7 pt-5">
        <div className="relative h-[350px] min-w-[1040px] pb-10">
          <svg
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[270px] w-full"
            viewBox="0 0 1200 270"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="forecast-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#22d3ee" floodOpacity="0.65" />
              </filter>
              <filter id="forecast-point-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#020617" floodOpacity="0.75" />
              </filter>
            </defs>
            {gridRows.map((ratio) => {
              const y = chartBottom - ratio * chartHeight
              return <line key={ratio} x1="32" x2="1168" y1={y} y2={y} stroke="rgba(148, 163, 184, 0.18)" strokeWidth="1" />
            })}
            <line x1="32" x2="1168" y1={targetY} y2={targetY} stroke="rgb(251 191 36)" strokeWidth="3" strokeDasharray="10 8" />
            <rect x="932" y={Math.max(8, targetY - 31)} width="218" height="26" rx="6" fill="rgba(15, 23, 42, 0.92)" stroke="rgba(251, 191, 36, 0.45)" />
            <text x="1041" y={Math.max(26, targetY - 12)} fill="rgb(254 243 199)" fontSize="18" fontWeight="900" textAnchor="middle">
              대출 1억 상환선
            </text>
            <polyline
              points={linePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgba(8, 47, 73, 0.95)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={linePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgb(103 232 249)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#forecast-line-glow)"
            />
            {linePoints.map((point) => (
              <circle
                key={point.month.key}
                cx={point.x}
                cy={point.y}
                r={point.month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET ? 8 : 6}
                fill={point.month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET ? 'rgb(251 191 36)' : 'rgb(103 232 249)'}
                stroke="rgb(2 6 23)"
                strokeWidth="4"
                filter="url(#forecast-point-shadow)"
              />
            ))}
          </svg>

          <div className="grid h-[300px] grid-cols-12 items-end gap-4 pt-8">
            {months.map((month) => {
              const salesHeight = Math.max(12, (month.expectedSales / maxSales) * 230)
              const profitHeight = Math.max(6, (Math.abs(month.operatingProfit) / maxProfit) * 104)
              const profitTone = month.operatingProfit >= 0 ? 'bg-emerald-300 shadow-emerald-950/30' : 'bg-rose-300 shadow-rose-950/30'

              return (
                <div key={month.key} className="relative flex h-[285px] flex-col items-center justify-end gap-2">
                  <div className="absolute top-0 w-full rounded-md bg-slate-950/70 px-1.5 py-1 text-center ring-1 ring-white/10">
                    <p className="truncate text-xs font-black leading-4 text-white">{won(month.expectedSales)}</p>
                    <p className={`text-[11px] font-black leading-4 ${month.operatingProfit >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                      {won(month.operatingProfit)}
                    </p>
                  </div>
                  <div className="flex h-[230px] w-full items-end justify-center gap-1.5">
                    <div
                      className="w-8 rounded-t-md bg-sky-300 shadow-lg shadow-sky-950/40 ring-1 ring-sky-100/20"
                      style={{ height: `${salesHeight}px` }}
                      title={`${month.label} 예상 매출 ${won(month.expectedSales)}`}
                    />
                    <div
                      className={`w-4 rounded-t-md shadow-lg ring-1 ring-white/20 ${profitTone}`}
                      style={{ height: `${profitHeight}px` }}
                      title={`${month.label} 영업이익 ${won(month.operatingProfit)}`}
                    />
                  </div>
                  <p className="absolute -bottom-7 whitespace-nowrap text-[13px] font-black text-slate-200">{month.shortLabel}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-black text-slate-200">
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-sky-300" />예상 매출</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-300" />영업이익</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-rose-300" />영업손실</span>
        <span className="inline-flex items-center gap-2"><i className="h-1 w-7 rounded-full bg-cyan-300 shadow-sm shadow-cyan-300/40" />누적 영업이익</span>
        <span className="inline-flex items-center gap-2"><i className="h-0.5 w-7 border-t-2 border-dashed border-amber-300" />대출 1억 상환선</span>
      </div>
    </div>
  )
}

function ForecastProgressBar({ value, percent, tone = 'sky', subValue }) {
  const toneMap = {
    sky: 'bg-sky-300 shadow-sky-400/20',
    emerald: 'bg-emerald-300 shadow-emerald-400/20',
    amber: 'bg-amber-300 shadow-amber-400/20',
    rose: 'bg-rose-300 shadow-rose-400/20',
    cyan: 'bg-cyan-300 shadow-cyan-400/20',
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-black text-white">{value}</span>
        {subValue ? <span className="text-[11px] font-black text-slate-400">{subValue}</span> : null}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
        <div
          className={`h-full rounded-full shadow-lg ${toneMap[tone]}`}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  )
}

function ForecastRevenueChart({ months }) {
  const cumulativeMonths = months.reduce((acc, month) => {
    const previous = acc.at(-1)?.cumulativeOperatingProfit || 0
    acc.push({
      ...month,
      cumulativeOperatingProfit: previous + month.operatingProfit,
    })
    return acc
  }, [])
  const maxSales = Math.max(1, ...months.map((month) => month.expectedSales))
  const maxProfit = Math.max(1, ...months.map((month) => Math.abs(month.operatingProfit)))
  const payoffMonth = cumulativeMonths.find((month) => month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET)
  const lastCumulativeProfit = cumulativeMonths.at(-1)?.cumulativeOperatingProfit || 0
  const remainingLoanProfit = Math.max(0, LOAN_REPAYMENT_TARGET - lastCumulativeProfit)

  const rows = cumulativeMonths.map((month) => {
    const cumulativePercent = Math.max(0, (month.cumulativeOperatingProfit / LOAN_REPAYMENT_TARGET) * 100)
    const isPaid = month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET
    const isLoss = month.operatingProfit < 0
    return {
      ...month,
      salesPercent: (month.expectedSales / maxSales) * 100,
      profitPercent: (Math.abs(month.operatingProfit) / maxProfit) * 100,
      cumulativePercent,
      statusLabel: isPaid ? '상환선 도달' : isLoss ? '손실 월' : '진행 중',
      statusClass: isPaid
        ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
        : isLoss
          ? 'border-rose-300/40 bg-rose-300/15 text-rose-100'
          : 'border-sky-300/30 bg-sky-300/12 text-sky-100',
    }
  })

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/12 p-4">
          <p className="text-[13px] font-black text-amber-100">대출 상환 목표</p>
          <p className="mt-2 text-2xl font-black text-white">{won(LOAN_REPAYMENT_TARGET)}</p>
          <p className="mt-1 text-xs font-bold text-amber-100/80">누적 영업이익 기준</p>
        </div>
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/12 p-4">
          <p className="text-[13px] font-black text-emerald-100">12개월 누적 영업이익</p>
          <p className={`mt-2 text-2xl font-black ${lastCumulativeProfit >= LOAN_REPAYMENT_TARGET ? 'text-white' : 'text-amber-100'}`}>
            {won(lastCumulativeProfit)}
          </p>
          <p className="mt-1 text-xs font-bold text-emerald-100/80">
            {payoffMonth ? `${payoffMonth.label} 상환 가능` : `부족액 ${won(remainingLoanProfit)}`}
          </p>
        </div>
        <div className="rounded-lg border border-sky-300/30 bg-sky-300/12 p-4">
          <p className="text-[13px] font-black text-sky-100">상환선 도달 월</p>
          <p className="mt-2 text-2xl font-black text-white">{payoffMonth?.label || '미도달'}</p>
          <p className="mt-1 text-xs font-bold text-sky-100/80">노란 기준선 대신 진행률로 표시합니다.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-950/45">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[90px_1.25fr_1.15fr_1.35fr_120px] gap-5 border-b border-white/10 px-5 py-3 text-xs font-black text-slate-400">
            <span>월</span>
            <span>예상 매출</span>
            <span>영업이익</span>
            <span>누적 상환 진행률</span>
            <span className="text-center">상태</span>
          </div>
          {rows.map((row) => {
            const profitTone = row.operatingProfit >= 0 ? 'emerald' : 'rose'
            return (
              <div
                key={row.key}
                className="grid grid-cols-[90px_1.25fr_1.15fr_1.35fr_120px] items-center gap-5 border-b border-white/10 px-5 py-4 last:border-b-0"
              >
                <div>
                  <p className="text-base font-black text-white">{row.shortLabel}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">{row.label}</p>
                </div>
                <ForecastProgressBar
                  value={won(row.expectedSales)}
                  percent={row.salesPercent}
                  tone="sky"
                  subValue="매출"
                />
                <ForecastProgressBar
                  value={won(row.operatingProfit)}
                  percent={row.profitPercent}
                  tone={profitTone}
                  subValue={row.operatingProfit >= 0 ? '이익' : '손실'}
                />
                <ForecastProgressBar
                  value={won(row.cumulativeOperatingProfit)}
                  percent={row.cumulativePercent}
                  tone={row.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET ? 'amber' : 'cyan'}
                  subValue={`${Math.max(0, Math.round(row.cumulativePercent))}%`}
                />
                <span className={`justify-self-center rounded-full border px-3 py-1.5 text-xs font-black ${row.statusClass}`}>
                  {row.statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-xs font-bold text-slate-500">
        매출과 영업이익 막대는 각각 12개월 최대값 기준이며, 누적 상환 진행률은 대출 상환 목표 1억 대비 실제 누적 영업이익입니다.
      </p>
    </div>
  )
}

function NpdRiskCommandCenter({ analyses, selectedId, onSelect }) {
  const sorted = [...analyses].sort((a, b) => b.riskScore - a.riskScore || a.readiness - b.readiness)
  const selected = analyses.find((analysis) => analysis.row.id === selectedId) || analyses[0]
  const averageReadiness = analyses.length
    ? Math.round(analyses.reduce((sum, analysis) => sum + analysis.readiness, 0) / analyses.length)
    : 0
  const dangerCount = analyses.filter((analysis) => analysis.decision === '위험').length
  const launchableCount = analyses.filter((analysis) => analysis.decision === '런칭 가능').length
  const criticalMissingCount = analyses.reduce((sum, analysis) => sum + analysis.criticalMissing.length, 0)

  if (analyses.length === 0) {
    return (
      <Panel title="NPD 런칭 리스크 관리">
        <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 py-10 text-center text-sm font-bold text-slate-500">
          NPD 제품을 먼저 등록하면 런칭 체크리스트와 리스크 보드가 생성됩니다.
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      title="NPD 런칭 리스크 관리"
      right={<span className="text-xs font-black text-slate-400">경영진 의사결정 보드</span>}
    >
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="평균 런칭 준비율" value={`${averageReadiness}%`} tone={averageReadiness >= 80 ? 'emerald' : averageReadiness >= 60 ? 'amber' : 'rose'} />
        <MetricCard label="런칭 가능 제품" value={count(launchableCount, '개')} tone="emerald" />
        <MetricCard label="위험 제품" value={count(dangerCount, '개')} tone={dangerCount > 0 ? 'rose' : 'emerald'} />
        <MetricCard label="핵심 누락 항목" value={count(criticalMissingCount, '개')} tone={criticalMissingCount > 0 ? 'rose' : 'emerald'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {sorted.map((analysis) => {
            const active = selected?.row.id === analysis.row.id
            return (
              <button
                key={analysis.row.id}
                type="button"
                onClick={() => onSelect(analysis.row.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  active ? 'border-sky-300/50 bg-sky-300/10' : 'border-white/10 bg-slate-950/45 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{analysis.row.product_name}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{analysis.row.launch_month || '출시월 미정'} · 위험점수 {analysis.riskScore}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${decisionClass(analysis.decision)}`}>
                    {analysis.decision}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] font-black text-slate-400">
                    <span>런칭 준비율</span>
                    <span>{analysis.readiness}%</span>
                  </div>
                  <ReadinessBar value={analysis.readiness} tone={analysis.decision === '위험' ? 'rose' : analysis.decision === '주의' ? 'amber' : 'emerald'} />
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950/45 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xl font-black text-white">{selected.row.product_name}</p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                런칭 준비율 {selected.readiness}% · 리스크 점수 {selected.riskScore} · 완료 {selected.completeCount}/{selected.totalCount}
              </p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${decisionClass(selected.decision)}`}>
              {selected.decision}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {selected.categories.slice(0, 6).map((category) => (
              <div key={category.id} className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-slate-300">{category.metricLabel}</p>
                  <p className="text-xs font-black text-white">{category.readiness}%</p>
                </div>
                <ReadinessBar value={category.readiness} tone={category.riskCount > 0 ? 'rose' : category.readiness >= 75 ? 'emerald' : 'amber'} />
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-4">
              <p className="text-sm font-black text-rose-100">핵심 누락 / 위험 항목</p>
              <div className="mt-3 space-y-2">
                {[...selected.riskItems, ...selected.criticalMissing.filter((item) => item.status !== 'RISK')].slice(0, 8).map((item) => (
                  <div key={`${item.key}-${item.status}`} className="rounded-md border border-rose-300/20 bg-slate-950/50 px-3 py-2">
                    <p className="text-xs font-black text-white">{item.item}</p>
                    <p className="mt-1 text-[11px] font-bold text-rose-100/80">{item.categoryLabel} · {CHECKLIST_STATUS[item.status]?.label}</p>
                  </div>
                ))}
                {selected.riskItems.length + selected.criticalMissing.length === 0 && (
                  <p className="text-sm font-bold text-slate-400">핵심 위험 항목이 없습니다.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-sm font-black text-amber-100">대표 체크포인트</p>
              <div className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-300">
                <p>회전 가능성: 재고 소진 예상일, 재발주 여부, 리뷰 확보 계획을 우선 확인하세요.</p>
                <p>현금흐름: 생산 선금, 광고 선집행 비용, 예상 입금일이 완료되어야 합니다.</p>
                <p>광고 효율: 키워드, ROAS 목표, Meta/네이버 세팅 중 하나라도 위험이면 런칭 후 손실 가능성이 큽니다.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function NpdChecklistBoard({ analysis, savingKey, onStatusChange }) {
  const [activeCategoryId, setActiveCategoryId] = useState('planning')
  if (!analysis) return null
  const activeCategory = analysis.categories.find((category) => category.id === activeCategoryId) || analysis.categories[0]
  const priorityItems = [
    ...analysis.riskItems,
    ...analysis.criticalMissing.filter((item) => item.status !== 'RISK'),
    ...analysis.waitingItems.filter((item) => item.critical),
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.key === item.key) === index).slice(0, 14)

  return (
    <Panel
      title={`${analysis.row.product_name} 런칭 우선순위 체크`}
      right={<span className={`rounded-full border px-3 py-1.5 text-xs font-black ${decisionClass(analysis.decision)}`}>{analysis.decision}</span>}
    >
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="런칭 준비율" value={`${analysis.readiness}%`} tone={analysis.readiness >= 80 ? 'emerald' : analysis.readiness >= 60 ? 'amber' : 'rose'} />
        <MetricCard label="제품별 리스크 점수" value={`${analysis.riskScore}점`} tone={analysis.riskScore >= 55 ? 'rose' : analysis.riskScore >= 25 ? 'amber' : 'emerald'} />
        <MetricCard label="핵심 누락" value={count(analysis.criticalMissing.length, '개')} tone={analysis.criticalMissing.length > 0 ? 'rose' : 'emerald'} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {analysis.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategoryId(category.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              activeCategory?.id === category.id ? 'border-sky-300/50 bg-sky-300/10' : 'border-white/10 bg-slate-950/45 hover:bg-white/[0.04]'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-300">{category.label}</p>
              <p className="text-xs font-black text-white">{category.readiness}%</p>
            </div>
            <ReadinessBar value={category.readiness} tone={category.riskCount > 0 ? 'rose' : category.readiness >= 75 ? 'emerald' : 'amber'} />
            <p className="mt-2 text-[11px] font-bold text-slate-500">완료 {category.completeCount}/{category.items.length} · 위험 {category.riskCount}개</p>
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <section className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-black text-white">{activeCategory?.label}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">이 단계의 항목만 관리합니다.</p>
            </div>
            <span className="text-sm font-black text-sky-100">{activeCategory?.readiness || 0}%</span>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {(activeCategory?.items || []).map((item) => {
              const current = analysis.state[item.key] || 'WAITING'
              return (
                <div key={item.key} className={`rounded-lg border p-3 ${current === 'RISK' ? 'border-rose-300/30 bg-rose-300/10' : item.critical && current !== 'DONE' ? 'border-amber-300/25 bg-amber-300/10' : 'border-white/10 bg-slate-900/60'}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{item.item}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{CHECKLIST_STATUS[current]?.label || current}</p>
                    </div>
                    {item.critical && current !== 'DONE' && (
                      <span className="shrink-0 rounded-full border border-rose-300/30 bg-rose-300/15 px-2 py-0.5 text-[10px] font-black text-rose-100">핵심</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CHECKLIST_STATUS).map(([status, meta]) => (
                      <button
                        key={status}
                        type="button"
                        disabled={savingKey === item.key}
                        onClick={() => onStatusChange(analysis.row, item.key, status)}
                        className={statusButtonClass(status, current === status)}
                      >
                        {savingKey === item.key && current !== status ? '저장중' : meta.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-4">
          <p className="text-base font-black text-rose-100">우선 조치 항목</p>
          <p className="mt-1 text-xs font-bold text-rose-100/70">위험/핵심 누락만 먼저 봅니다.</p>
          <div className="mt-4 space-y-2">
            {priorityItems.length === 0 ? (
              <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">
                우선 조치가 필요한 핵심 누락 항목이 없습니다.
              </div>
            ) : priorityItems.slice(0, 8).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveCategoryId(item.categoryId)}
                className="w-full rounded-lg border border-rose-300/20 bg-slate-950/50 px-3 py-2 text-left hover:bg-slate-900"
              >
                <p className="text-xs font-black text-white">{item.item}</p>
                <p className="mt-1 text-[11px] font-bold text-rose-100/80">{item.categoryLabel} · {CHECKLIST_STATUS[item.status]?.label}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Panel>
  )
}

function ForecastCalendar({ months, unscheduledRows }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {months.map((month) => (
        <article key={month.key} className="min-h-40 rounded-lg border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">{month.label}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{month.launchRows.length}개 출시 / {month.activeRows.length}개 매출 반영</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-sky-200">{won(month.expectedSales)}</p>
              <p className={`mt-1 text-[11px] font-bold ${month.operatingProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {won(month.operatingProfit)}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {month.launchRows.length === 0 ? (
              <p className="rounded-md border border-dashed border-white/10 px-3 py-3 text-xs font-bold text-slate-500">출시 예정 제품 없음</p>
            ) : (
              month.launchRows.slice(0, 3).map((row) => (
                <div key={`${month.key}-${row.id}`} className="rounded-md border border-sky-400/15 bg-sky-400/10 px-3 py-2">
                  <p className="truncate text-xs font-black text-white">{row.product_name}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{stageLabels[row.npd_stage] || row.npd_stage} · 기준 월 {count(row.expected_monthly_units, '개')}</p>
                </div>
              ))
            )}
            {month.launchRows.length > 3 && (
              <p className="text-[11px] font-black text-sky-300">+{month.launchRows.length - 3}개 더 있음</p>
            )}
          </div>
        </article>
      ))}

      {unscheduledRows.length > 0 && (
        <article className="min-h-40 rounded-lg border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-sm font-black text-amber-100">출시월 미정</p>
          <p className="mt-1 text-[11px] font-bold text-amber-100/70">출시월을 입력하면 그래프와 달력에 자동 반영됩니다.</p>
          <div className="mt-4 space-y-2">
            {unscheduledRows.slice(0, 5).map((row) => (
              <p key={row.id} className="truncate rounded-md border border-amber-400/20 bg-slate-950/40 px-3 py-2 text-xs font-black text-white">
                {row.product_name}
              </p>
            ))}
          </div>
        </article>
      )}
    </div>
  )
}

function MonthlyActionPlanTable({ plans }) {
  const totalSales = plans.reduce((sum, plan) => sum + plan.expectedSales, 0)
  const totalBudget = plans.reduce((sum, plan) => sum + plan.minimumOnlineBudget, 0)
  const totalOperatingProfit = plans.reduce((sum, plan) => sum + plan.operatingProfit, 0)

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-sky-400/15 bg-sky-400/10 p-4">
          <p className="text-xs font-black text-slate-400">월별 예상 매출 합계</p>
          <p className="mt-2 text-xl font-black text-white">{won(totalSales)}</p>
        </div>
        <div className="rounded-lg border border-amber-400/15 bg-amber-400/10 p-4">
          <p className="text-xs font-black text-slate-400">최소 마케팅+광고비</p>
          <p className="mt-2 text-xl font-black text-white">{won(totalBudget)}</p>
          <p className="mt-1 text-[11px] font-bold text-amber-100/80">마케팅 {MIN_MARKETING_RATE}% + 광고 {MIN_ONLINE_AD_RATE}% 기준</p>
        </div>
        <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/10 p-4">
          <p className="text-xs font-black text-slate-400">예상 영업이익</p>
          <p className={`mt-2 text-xl font-black ${totalOperatingProfit >= 0 ? 'text-white' : 'text-rose-200'}`}>
            {won(totalOperatingProfit)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-[1180px] divide-y divide-white/10 text-left">
          <thead className="bg-slate-950/70">
            <tr>
              {['월', '제품명', '회차', '성장계수', '예상 수량', '예상 매출', '마케팅 최소', '광고 최소', '최소 예산', '영업이익', '액션플랜'].map((label) => (
                <th key={label} className="px-4 py-3 text-xs font-black text-slate-400">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {plans.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                  출시월이 입력된 포케스트가 없습니다. 제품의 예상 출시월을 입력하면 월별 실행 계획이 자동 생성됩니다.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="align-top hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-white">{plan.monthLabel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-200">{plan.productName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-300">{plan.monthIndex}개월차</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-sky-200">{Math.round(plan.growthRate * 100)}%</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-300">{count(plan.expectedUnits, '개')}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-sky-100">{won(plan.expectedSales)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-amber-100">{won(plan.marketingCost)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-amber-100">{won(plan.adCost)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-amber-100">{won(plan.minimumOnlineBudget)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-sm font-black ${plan.operatingProfit >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {won(plan.operatingProfit)}
                  </td>
                  <td className="min-w-[360px] max-w-[520px] px-4 py-3 text-sm font-medium leading-relaxed text-slate-300">
                    {plan.actionPlan}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProductForecastPage() {
  const [rows, setRows] = useState([])
  const [editingRow, setEditingRow] = useState(null)
  const [productFilter, setProductFilter] = useState(ALL_PRODUCTS)
  const [selectedNpdProductId, setSelectedNpdProductId] = useState(null)
  const [savingChecklistKey, setSavingChecklistKey] = useState(null)

  const load = () => getExecutiveProductForecasts().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const productOptions = useMemo(() => {
    const names = rows
      .map((row) => row.product_name)
      .filter(Boolean)
      .filter((name, index, array) => array.indexOf(name) === index)
      .sort((a, b) => a.localeCompare(b))
    return [ALL_PRODUCTS, ...names]
  }, [rows])

  const filteredRows = useMemo(() => (
    productFilter === ALL_PRODUCTS ? rows : rows.filter((row) => row.product_name === productFilter)
  ), [rows, productFilter])

  const summary = useMemo(() => {
    const expectedSales = filteredRows.reduce((sum, row) => sum + numberValue(row.expected_sales), 0)
    const grossProfit = filteredRows.reduce((sum, row) => sum + numberValue(row.expected_gross_profit), 0)
    const operatingProfit = filteredRows.reduce((sum, row) => sum + numberValue(row.expected_operating_profit), 0)
    return {
      expectedSales,
      grossProfit,
      operatingProfit,
      operatingMargin: expectedSales > 0 ? (operatingProfit / expectedSales) * 100 : 0,
    }
  }, [filteredRows])

  const forecastMonths = useMemo(() => buildForecastMonths(filteredRows), [filteredRows])
  const unscheduledRows = useMemo(() => filteredRows.filter((row) => !parseMonth(row.launch_month)), [filteredRows])
  const monthlyActionPlans = useMemo(() => buildMonthlyActionPlans(filteredRows), [filteredRows])
  const npdAnalyses = useMemo(() => filteredRows.map((row) => analyzeChecklist(row)), [filteredRows])
  const selectedNpdAnalysis = useMemo(() => {
    if (npdAnalyses.length === 0) return null
    return npdAnalyses.find((analysis) => analysis.row.id === selectedNpdProductId) || npdAnalyses[0]
  }, [npdAnalyses, selectedNpdProductId])

  const updateChecklistStatus = async (row, itemKey, status) => {
    const nextState = { ...parseChecklistState(row), [itemKey]: status }
    setSavingChecklistKey(itemKey)
    try {
      await updateExecutiveRecord('product-forecasts', row.id, { launch_checklist: JSON.stringify(nextState) })
      await load()
    } finally {
      setSavingChecklistKey(null)
    }
  }

  return (
    <>
      <PageHeader
        title="NPD 런칭 리스크 관리"
        description="신제품 출시 전 준비율, 핵심 누락, 현금흐름, 생산, 광고, 재고 리스크를 한 화면에서 판단합니다."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-900/70 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">제품별 런칭 판단 기준</h2>
          <p className="mt-1 text-xs font-bold text-slate-400">런칭 준비율, 핵심 누락, 리스크 점수, 예상 손익을 함께 보고 출시 가능 여부를 판단합니다.</p>
        </div>
        <div className="flex max-w-full flex-wrap gap-2">
          {productOptions.map((productName) => (
            <button
              key={productName}
              type="button"
              onClick={() => setProductFilter(productName)}
              className={`h-10 rounded-lg border px-4 text-sm font-black transition-colors ${
                productFilter === productName
                  ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
                  : 'border-white/10 bg-slate-950 text-slate-400 hover:bg-white/5'
              }`}
              title={productName}
            >
              <span className="block max-w-36 truncate">{productName}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="예상 매출" value={won(summary.expectedSales)} />
        <MetricCard label="예상 매출이익" value={won(summary.grossProfit)} tone="emerald" />
        <MetricCard label="예상 영업이익" value={won(summary.operatingProfit)} tone={summary.operatingProfit >= 0 ? 'emerald' : 'rose'} />
        <MetricCard label="예상 영업이익률" value={pct(summary.operatingMargin)} tone={summary.operatingMargin >= 10 ? 'emerald' : 'amber'} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6">
        <NpdRiskCommandCenter
          analyses={npdAnalyses}
          selectedId={selectedNpdAnalysis?.row.id}
          onSelect={setSelectedNpdProductId}
        />
        <NpdChecklistBoard
          analysis={selectedNpdAnalysis}
          savingKey={savingChecklistKey}
          onStatusChange={updateChecklistStatus}
        />
      </section>

      <Panel title="NPD 제품 현황" right={<span className="text-xs font-black text-slate-400">{npdAnalyses.length}개 제품</span>}>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-[980px] divide-y divide-white/10 text-left">
            <thead className="bg-slate-950/70">
              <tr>
                {['제품명', '출시월', '런칭 판단', '준비율', '리스크 점수', '핵심 누락', '예상 매출', '영업이익률'].map((label) => (
                  <th key={label} className="px-4 py-3 text-xs font-black text-slate-400">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {npdAnalyses.map((analysis) => (
                <tr key={analysis.row.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-sm font-black text-white">{analysis.row.product_name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-300">{analysis.row.launch_month || '미정'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${decisionClass(analysis.decision)}`}>
                      {analysis.decision}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-sky-100">{analysis.readiness}%</td>
                  <td className="px-4 py-3 text-sm font-black text-amber-100">{analysis.riskScore}점</td>
                  <td className="px-4 py-3 text-sm font-black text-rose-100">{count(analysis.criticalMissing.length, '개')}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">{won(analysis.row.expected_sales)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">{pct(analysis.row.expected_operating_margin_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
