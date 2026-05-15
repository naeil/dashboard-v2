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

function ForecastRevenueChart({ months }) {
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
  const linePoints = cumulativeMonths.map((month, index) => {
    const x = 50 + index * (1100 / Math.max(1, cumulativeMonths.length - 1))
    const y = 210 - Math.max(0, Math.min(1, month.cumulativeOperatingProfit / lineScaleMax)) * 170
    return { x, y, month }
  })
  const targetY = 210 - (LOAN_REPAYMENT_TARGET / lineScaleMax) * 170
  const payoffMonth = cumulativeMonths.find((month) => month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET)
  const lastCumulativeProfit = cumulativeMonths.at(-1)?.cumulativeOperatingProfit || 0
  const remainingLoanProfit = Math.max(0, LOAN_REPAYMENT_TARGET - lastCumulativeProfit)

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-xs font-black text-slate-400">대출 상환 목표</p>
          <p className="mt-2 text-xl font-black text-white">{won(LOAN_REPAYMENT_TARGET)}</p>
          <p className="mt-1 text-[11px] font-bold text-amber-100/80">누적 영업이익 기준</p>
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-xs font-black text-slate-400">12개월 누적 영업이익</p>
          <p className={`mt-2 text-xl font-black ${lastCumulativeProfit >= LOAN_REPAYMENT_TARGET ? 'text-white' : 'text-amber-100'}`}>
            {won(lastCumulativeProfit)}
          </p>
          <p className="mt-1 text-[11px] font-bold text-emerald-100/80">
            {payoffMonth ? `${payoffMonth.label} 상환 가능` : `부족액 ${won(remainingLoanProfit)}`}
          </p>
        </div>
        <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-4">
          <p className="text-xs font-black text-slate-400">상환선 도달 월</p>
          <p className="mt-2 text-xl font-black text-white">{payoffMonth?.label || '미도달'}</p>
          <p className="mt-1 text-[11px] font-bold text-sky-100/80">노란 점선이 1억 기준선입니다.</p>
        </div>
      </div>

      <div className="h-[300px] overflow-x-auto">
        <div className="relative min-w-[920px] border-b border-white/10 pb-8 pt-4">
          <svg
            className="pointer-events-none absolute inset-x-0 top-4 z-20 h-[230px] w-full"
            viewBox="0 0 1200 230"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1="25"
              x2="1175"
              y1={targetY}
              y2={targetY}
              stroke="rgb(251 191 36)"
              strokeWidth="2"
              strokeDasharray="8 8"
            />
            <text x="1010" y={Math.max(16, targetY - 8)} fill="rgb(253 230 138)" fontSize="22" fontWeight="800">
              대출 1억 상환선
            </text>
            <polyline
              points={linePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgb(34 211 238)"
              strokeWidth="4"
            />
            {linePoints.map((point) => (
              <circle
                key={point.month.key}
                cx={point.x}
                cy={point.y}
                r={point.month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET ? 7 : 5}
                fill={point.month.cumulativeOperatingProfit >= LOAN_REPAYMENT_TARGET ? 'rgb(251 191 36)' : 'rgb(34 211 238)'}
                stroke="rgb(15 23 42)"
                strokeWidth="3"
              />
            ))}
          </svg>

          <div className="grid grid-cols-12 items-end gap-3">
        {months.map((month) => {
          const salesHeight = Math.max(8, (month.expectedSales / maxSales) * 210)
          const profitHeight = Math.max(4, (Math.abs(month.operatingProfit) / maxProfit) * 92)
          const profitTone = month.operatingProfit >= 0 ? 'bg-emerald-300' : 'bg-rose-300'

          return (
            <div key={month.key} className="relative flex h-[230px] flex-col items-center justify-end gap-2">
              <div className="absolute top-0 w-full text-center">
                <p className="truncate text-[11px] font-black text-white">{won(month.expectedSales)}</p>
                <p className={`text-[10px] font-bold ${month.operatingProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {won(month.operatingProfit)}
                </p>
              </div>
              <div className="flex h-[210px] w-full items-end justify-center gap-1">
                <div
                  className="w-7 rounded-t-md bg-sky-400 shadow-lg shadow-sky-950/30"
                  style={{ height: `${salesHeight}px` }}
                  title={`${month.label} 예상 매출 ${won(month.expectedSales)}`}
                />
                <div
                  className={`w-3 rounded-t-md ${profitTone}`}
                  style={{ height: `${profitHeight}px` }}
                  title={`${month.label} 영업이익 ${won(month.operatingProfit)}`}
                />
              </div>
              <p className="absolute -bottom-7 text-xs font-black text-slate-400">{month.shortLabel}</p>
            </div>
          )
        })}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-5 text-xs font-bold text-slate-400">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-sky-400" />예상 매출</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />영업이익</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-rose-300" />영업손실</span>
        <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5 bg-cyan-300" />누적 영업이익</span>
        <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5 border-t-2 border-dashed border-amber-300" />대출 1억 상환선</span>
      </div>
    </div>
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
  const [productFilter, setProductFilter] = useState('전체')

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
    return ['전체', ...names]
  }, [rows])

  const filteredRows = useMemo(() => (
    productFilter === '전체' ? rows : rows.filter((row) => row.product_name === productFilter)
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

  return (
    <>
      <PageHeader
        title="제품별 예상 포케스트"
        description="신제품 NPD 개발 후 예상 판매수량, 판매가, 원가, 광고비율을 기준으로 예상 매출과 이익을 시뮬레이션합니다."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-900/70 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">NPD 사업성 기준</h2>
          <p className="mt-1 text-xs font-bold text-slate-400">영업이익 = 예상 매출 - 생산원가 - 채널 수수료 - 광고비 - 운영 판관비 - 물류비</p>
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

      <RecordForm
        key={editingRow?.id || 'new-product-forecast'}
        title={editingRow ? '제품 포케스트 수정' : '제품 포케스트 입력'}
        modeLabel={editingRow ? `${editingRow.product_name} 수정 중` : '신규 입력'}
        submitLabel={editingRow ? '수정 저장' : '신규 저장'}
        fields={forecastFields}
        initialValues={editingRow ? toInitialValues(editingRow) : {
          brand_name: '하이프리',
          npd_stage: 'IDEA',
          forecast_months: FORECAST_MONTHS,
          platform_fee_rate: 6,
          ad_cost_rate: 10,
          operating_admin_rate: 15,
          logistics_cost_per_unit: 0,
        }}
        computeValues={computeForecastValues}
        onSubmit={async (values) => {
          if (editingRow) {
            await updateExecutiveRecord('product-forecasts', editingRow.id, values)
          } else {
            await createExecutiveRecord('product-forecasts', values)
          }
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

      <section className="mb-6 grid grid-cols-1 gap-6">
        <Panel title="월별 예상 매출 현황" right={<span className="text-xs font-black text-slate-400">향후 12개월</span>}>
          <ForecastRevenueChart months={forecastMonths} />
        </Panel>

        <Panel
          title="월별 예상 포케스트 및 액션플랜"
          right={<span className="text-xs font-black text-slate-400">온라인 판매 기준 최소 비용 예측</span>}
        >
          <MonthlyActionPlanTable plans={monthlyActionPlans} />
        </Panel>

        <Panel title="NPD 출시 달력" right={<span className="text-xs font-black text-slate-400">출시월 기준</span>}>
          <ForecastCalendar months={forecastMonths} unscheduledRows={unscheduledRows} />
        </Panel>
      </section>

      <Panel title="NPD 제품별 예상 손익" right={<span className="text-xs font-black text-slate-400">{filteredRows.length}개 제품</span>}>
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'product_name', label: '제품명', render: (row) => <span className="font-black text-white">{row.product_name}</span> },
            { key: 'brand_name', label: '브랜드' },
            { key: 'npd_stage', label: 'NPD 단계', render: (row) => stageLabels[row.npd_stage] || row.npd_stage },
            { key: 'launch_month', label: '출시월' },
            { key: 'forecast_months', label: '기간', render: () => count(FORECAST_MONTHS, '개월') },
            { key: 'expected_monthly_units', label: '기준 월 판매수량', render: (row) => count(row.expected_monthly_units, '개') },
            { key: 'expected_selling_price', label: '판매가', render: (row) => won(row.expected_selling_price) },
            { key: 'unit_production_cost', label: '원가', render: (row) => won(row.unit_production_cost) },
            { key: 'expected_sales', label: '예상 매출', render: (row) => won(row.expected_sales) },
            { key: 'expected_gross_profit', label: '매출이익', render: (row) => won(row.expected_gross_profit) },
            { key: 'expected_operating_profit', label: '영업이익', render: (row) => won(row.expected_operating_profit) },
            { key: 'expected_operating_margin_rate', label: '영업이익률', render: (row) => pct(row.expected_operating_margin_rate) },
            { key: 'forecast_status', label: '상태', render: (row) => <ForecastStatus row={row} /> },
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
                    if (!window.confirm('이 포케스트 데이터를 삭제할까요?')) return
                    await deleteExecutiveRecord('product-forecasts', row.id)
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
    </>
  )
}
