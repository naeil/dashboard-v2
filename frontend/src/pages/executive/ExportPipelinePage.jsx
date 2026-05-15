import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveExportPipeline,
  getExecutiveExportSupplyPrices,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

const ALL = '__ALL__'
const PIPELINE_STAGES = ['협의중', '샘플 발송', '제안서 발송', '테스트 진행', '계약 진행', '발주 완료', '생산 중', '출고 완료']
const REVENUE_STAGES = new Set(['발주 완료', '생산 중', '출고 완료'])

const COUNTRY_INSIGHTS = {
  몽골: {
    traits: '한국 식품과 K-브랜드 수용도가 높고, 작은 MOQ로 총판 반응을 보기 좋은 시장입니다.',
    help: '가격 민감도가 명확해서 MOQ별 공급가 테스트를 빠르게 돌리기 좋습니다.',
    risks: '시장 규모가 크지 않아 과도한 초도 물량은 재고 회전 부담으로 이어질 수 있습니다.',
  },
  대만: {
    traits: '건강 간식과 기능성 식품 이해도가 높고, 패키지와 인증 신뢰도가 중요합니다.',
    help: '브랜드 스토리와 단백질 포지셔닝이 먹히면 반복 주문과 리테일 확장 가능성이 있습니다.',
    risks: '인증, 라벨링, 통관 조건이 까다로울 수 있어 선지출과 일정 지연을 봐야 합니다.',
  },
  홍콩: {
    traits: '테스트 마켓 성격이 강하고 빠른 샘플 검증과 소량 반응을 선호합니다.',
    help: '반응이 좋으면 중화권 확장 레퍼런스로 쓰기 좋고 프리미엄 가격 테스트도 가능합니다.',
    risks: '물류비와 유통 마진 압박이 커서 FOB 이후 현지 비용 흡수 여부를 확인해야 합니다.',
  },
  베트남: {
    traits: '성장성이 좋고 젊은 소비자층이 두껍지만 가격 민감도가 높은 시장입니다.',
    help: 'MOQ를 키웠을 때 매출 총량이 빠르게 커질 수 있어 생산 단가 절감 검토에 좋습니다.',
    risks: '공급가가 조금만 높아도 현지 판매가 경쟁력이 떨어질 수 있습니다.',
  },
}

const priceFields = [
  { name: 'country', label: '국가', required: true },
  { name: 'product_name', label: '제품명', required: true },
  { name: 'scenario_label', label: '조건', required: true, placeholder: 'MOQ 5,000 / 판관비 20%' },
  { name: 'moq', label: 'MOQ', type: 'number', required: true },
  { name: 'consumer_price', label: '소비자가', type: 'number' },
  { name: 'production_cost_ex_vat', label: '생산원가 VAT 제외', type: 'number' },
  { name: 'production_cost_inc_vat', label: '생산원가 VAT 포함', type: 'number' },
  { name: 'ad_cost', label: '광고비', type: 'number' },
  { name: 'sales_admin_cost', label: '판관비', type: 'number' },
  { name: 'logistics_cost', label: '물류비', type: 'number' },
  { name: 'domestic_admin_cost', label: '국내 판관비', type: 'number' },
  { name: 'operating_profit_per_unit', label: '개당 영업이익', type: 'number' },
  { name: 'export_supply_price_krw', label: '수출 공급가', type: 'number', required: true },
  { name: 'supply_price_usd', label: '공급가 USD', type: 'number' },
  { name: 'domestic_convenience_supply_price', label: '국내 편의점 공급가', type: 'number' },
  { name: 'zero_store_supply_price', label: '제로 스토어 공급가', type: 'number' },
  { name: 'expected_sales', label: '예상 매출', type: 'number', required: true },
  { name: 'total_production_cost', label: '총 생산 원가', type: 'number' },
  { name: 'operating_profit_total', label: '회사 이윤', type: 'number', required: true },
  { name: 'operating_profit_rate', label: '이익률', type: 'number' },
  { name: 'upfront_cost', label: '선지출금액', type: 'number' },
  { name: 'memo', label: '메모', wide: true },
]

const pipelineFields = [
  { name: 'country', label: '국가', required: true },
  { name: 'buyer_name', label: '바이어명', required: true },
  { name: 'stage', label: '진행 단계', type: 'select', required: true, options: PIPELINE_STAGES.map((value) => ({ value, label: value })) },
  { name: 'expected_moq', label: '예상 MOQ', type: 'number' },
  { name: 'expected_sales', label: '예상 매출', type: 'number', required: true },
  { name: 'expected_payment_date', label: '예상 입금일', type: 'date' },
  { name: 'certification_required', label: '인증 필요 여부', type: 'checkbox' },
  { name: 'current_status', label: '현재 상태', required: true, placeholder: 'OPEN / NORMAL / HIGH' },
  { name: 'next_action', label: '다음 액션' },
  { name: 'owner_name', label: '담당자' },
  { name: 'memo', label: '메모', wide: true },
]

const numberValue = (value) => Number(value || 0)
const formatMoq = (value) => `MOQ ${Number(value || 0).toLocaleString('ko-KR')}`
const toInitialValues = (row, fields) => fields.reduce((acc, field) => {
  acc[field.name] = row?.[field.name] ?? ''
  return acc
}, {})

function displayText(value) {
  const text = String(value ?? '')
  if (!text) return ''
  if (/^[\u00c0-\u00ff]+/.test(text)) {
    try {
      const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0)))
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      if (decoded && !decoded.includes('�')) return decoded
    } catch {
      return text
    }
  }
  return text
}

function normalizedStage(stage) {
  const value = displayText(stage)
  if (value === '리드 확보' || value === '협상 중') return '협의중'
  return PIPELINE_STAGES.includes(value) ? value : PIPELINE_STAGES[0]
}

function sumRows(rows, key) {
  return rows.reduce((total, row) => total + numberValue(row[key]), 0)
}

function StageChecklist({ row, selectedMoq, onStageChange, stageKey = 'stage', moqKey = 'expected_moq' }) {
  const currentIndex = Math.max(0, PIPELINE_STAGES.indexOf(normalizedStage(row[stageKey])))
  const moqMatched = selectedMoq !== ALL && Number(row[moqKey] || 0) === Number(selectedMoq)

  return (
    <div className="min-w-[620px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-white">수출 확정 체크리스트</p>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-100">
          발주 완료부터 매출 반영
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STAGES.map((stage, index) => {
          const checked = index <= currentIndex
          const revenue = REVENUE_STAGES.has(stage)
          return (
            <label
              key={stage}
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-[11px] font-black transition-colors ${
                checked
                  ? revenue
                    ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100'
                    : 'border-sky-400/40 bg-sky-400/15 text-sky-100'
                  : 'border-white/10 bg-slate-950/60 text-slate-500 hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onStageChange(row, stage)}
                className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-emerald-400"
              />
              <span>{stage}</span>
              {revenue && <span className="ml-1 text-[10px] opacity-80">매출</span>}
            </label>
          )
        })}
      </div>
      {moqMatched && (
        <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-100">
          선택 MOQ와 일치
        </span>
      )}
    </div>
  )
}

function ChecklistBand({ country, moq, pipelineRows }) {
  const confirmedRows = pipelineRows.filter((row) => REVENUE_STAGES.has(normalizedStage(row.stage)))
  const candidateSales = sumRows(pipelineRows, 'expected_sales')
  const confirmedSales = sumRows(confirmedRows, 'expected_sales')

  return (
    <div className="mb-4 rounded-lg border border-emerald-400/20 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-black text-emerald-100">{country} / {formatMoq(moq)} 수출 확정 체크리스트</p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            샘플 발송, 제안서 발송, 계약 진행은 후보 매출이고 발주 완료부터 확정 매출로 반영됩니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-md bg-slate-900 px-3 py-2">
            <p className="text-[11px] font-black text-slate-500">후보 매출</p>
            <p className="mt-1 text-sm font-black text-white">{won(candidateSales)}</p>
          </div>
          <div className="rounded-md bg-emerald-400/10 px-3 py-2">
            <p className="text-[11px] font-black text-emerald-100">확정 반영</p>
            <p className="mt-1 text-sm font-black text-white">{won(confirmedSales)}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {PIPELINE_STAGES.map((stage) => {
          const revenue = REVENUE_STAGES.has(stage)
          return (
            <label
              key={stage}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-black ${
                revenue
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100'
                  : 'border-sky-400/30 bg-sky-400/10 text-sky-100'
              }`}
            >
              <input
                type="checkbox"
                checked={revenue}
                readOnly
                className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-emerald-400"
              />
              <span>{stage}</span>
              {revenue && <span className="text-[10px] opacity-80">매출 반영</span>}
            </label>
          )
        })}
      </div>
      {pipelineRows.length === 0 && (
        <p className="mt-3 text-xs font-bold text-amber-100">
          이 국가/MOQ에 연결된 수출 파이프라인이 없습니다. 아래 파이프라인 입력에서 같은 국가와 예상 MOQ를 등록하면 이 블록에 매출 반영됩니다.
        </p>
      )}
    </div>
  )
}

function ExportAiCommentary({ context, messages, question, onQuestionChange, onAsk }) {
  const country = context.selectedCountry === ALL ? '전체 국가' : displayText(context.selectedCountry)
  const moq = context.selectedMoq === ALL ? '전체 MOQ' : formatMoq(context.selectedMoq)
  const insight = COUNTRY_INSIGHTS[country] || {
    traits: '선택 조건을 좁히면 국가별 리스크와 공급가 판단이 더 명확해집니다.',
    help: 'MOQ와 공급가를 함께 보면서 바이어 협상 기준선을 정할 수 있습니다.',
    risks: 'FOB 이후 현지 비용과 할인 요청이 기존 공급가를 압박할 수 있습니다.',
  }
  const best = context.bestRow

  return (
    <section className="mb-6 rounded-lg border border-sky-400/20 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <p className="text-sm font-black text-sky-100">AI 수출 코멘트</p>
      <p className="mt-2 text-xl font-black text-white">
        {country} / {moq} 기준 {best ? displayText(best.product_name) : '후보 없음'} 우선 검토
      </p>
      <p className="mt-2 text-sm font-bold text-slate-300">
        선택 조건 예상 매출 {won(context.summary.expectedSales)}, 회사 이윤 {won(context.summary.companyProfit)}, 평균 이익률 {pct(context.avgProfitRate)}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded-lg bg-slate-950/60 p-4">
          <p className="text-xs font-black text-slate-500">국가별 특징</p>
          <p className="mt-2 text-sm font-bold text-slate-200">{insight.traits}</p>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-4">
          <p className="text-xs font-black text-slate-500">도움이 되는 점</p>
          <p className="mt-2 text-sm font-bold text-emerald-100">{insight.help}</p>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-4">
          <p className="text-xs font-black text-slate-500">리스크</p>
          <p className="mt-2 text-sm font-bold text-amber-100">{insight.risks}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-50">
        FOB 조건에서는 선적 이후 운임, 보험, 현지 통관비가 바이어 비용으로 넘어가지만, 바이어가 이를 최종 판매가에 반영하지 못하면 기존 공급가 인하 압박으로 돌아올 수 있습니다.
      </div>
      <div className="mt-4 space-y-3">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-4xl rounded-lg px-4 py-3 text-sm font-bold ${message.role === 'user' ? 'ml-auto bg-sky-400 text-slate-950' : 'bg-slate-950/70 text-slate-200'}`}>
            {message.text}
          </div>
        ))}
      </div>
      <form className="mt-4 flex flex-col gap-2 md:flex-row" onSubmit={onAsk}>
        <input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="예: FOB 조건에서 가장 위험한 부분은 뭐야?"
          className="h-11 flex-1 rounded-lg border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-sky-400"
        />
        <button type="submit" className="h-11 rounded-lg bg-sky-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300">
          AI에게 물어보기
        </button>
      </form>
    </section>
  )
}

export default function ExportPipelinePage() {
  const [pipelineRows, setPipelineRows] = useState([])
  const [priceRows, setPriceRows] = useState([])
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [editingPrice, setEditingPrice] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(ALL)
  const [selectedMoq, setSelectedMoq] = useState(ALL)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiMessages, setAiMessages] = useState([])

  const load = async () => {
    const [pipelineResponse, priceResponse] = await Promise.all([
      getExecutiveExportPipeline(),
      getExecutiveExportSupplyPrices(),
    ])
    setPipelineRows(pipelineResponse.data || [])
    setPriceRows(priceResponse.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const countryOptions = useMemo(() => {
    return [...new Set(priceRows.map((row) => row.country).filter(Boolean))]
      .sort((a, b) => displayText(a).localeCompare(displayText(b), 'ko-KR'))
  }, [priceRows])

  const countryScopedPriceRows = useMemo(() => (
    selectedCountry === ALL ? priceRows : priceRows.filter((row) => row.country === selectedCountry)
  ), [priceRows, selectedCountry])

  const moqOptions = useMemo(() => {
    return [...new Set(countryScopedPriceRows.map((row) => Number(row.moq || 0)).filter(Boolean))].sort((a, b) => a - b)
  }, [countryScopedPriceRows])

  useEffect(() => {
    if (selectedMoq !== ALL && !moqOptions.includes(Number(selectedMoq))) setSelectedMoq(ALL)
  }, [moqOptions, selectedMoq])

  const filteredPriceRows = useMemo(() => {
    return countryScopedPriceRows.filter((row) => selectedMoq === ALL || Number(row.moq || 0) === Number(selectedMoq))
  }, [countryScopedPriceRows, selectedMoq])

  const filteredPipelineRows = useMemo(() => {
    return selectedCountry === ALL
      ? pipelineRows
      : pipelineRows.filter((row) => displayText(row.country) === displayText(selectedCountry))
  }, [pipelineRows, selectedCountry])

  const confirmedPipelineRows = useMemo(() => (
    filteredPipelineRows.filter((row) => REVENUE_STAGES.has(normalizedStage(row.stage)))
  ), [filteredPipelineRows])

  const confirmedPriceRows = useMemo(() => (
    filteredPriceRows.filter((row) => REVENUE_STAGES.has(normalizedStage(row.pipeline_stage)))
  ), [filteredPriceRows])

  const summary = useMemo(() => ({
    expectedSales: sumRows(filteredPriceRows, 'expected_sales'),
    productionCost: sumRows(filteredPriceRows, 'total_production_cost'),
    companyProfit: sumRows(filteredPriceRows, 'operating_profit_total'),
    avgProfitRate: filteredPriceRows.length ? filteredPriceRows.reduce((total, row) => total + numberValue(row.operating_profit_rate), 0) / filteredPriceRows.length : 0,
  }), [filteredPriceRows])

  const pipelineConfirmedSales = sumRows(confirmedPipelineRows, 'expected_sales')
  const pipelinePotentialSales = sumRows(filteredPipelineRows, 'expected_sales')
  const confirmedPriceSales = sumRows(confirmedPriceRows, 'expected_sales')
  const bestRow = filteredPriceRows.reduce((best, row) => {
    if (!best) return row
    return numberValue(row.operating_profit_total) > numberValue(best.operating_profit_total) ? row : best
  }, null)

  const priceGroups = useMemo(() => {
    const groups = new Map()
    filteredPriceRows.forEach((row) => {
      const country = displayText(row.country)
      const moq = Number(row.moq || 0)
      const key = `${country}-${moq}`
      if (!groups.has(key)) groups.set(key, { key, country, moq, rows: [] })
      groups.get(key).rows.push(row)
    })
    return [...groups.values()]
  }, [filteredPriceRows])

  const selectedFilterLabel = `${selectedCountry === ALL ? '전체 국가' : displayText(selectedCountry)} / ${selectedMoq === ALL ? '전체 MOQ' : formatMoq(selectedMoq)}`
  const aiContext = { selectedCountry, selectedMoq, filteredPriceRows, bestRow, summary, avgProfitRate: summary.avgProfitRate }

  const askAi = (event) => {
    event.preventDefault()
    const question = aiQuestion.trim()
    if (!question) return
    const answer = question.toLowerCase().includes('fob') || question.includes('리스크')
      ? 'FOB 조건의 핵심 리스크는 선적 이후 비용이 바이어에게 넘어가더라도, 현지 판매가에 반영되지 못하면 공급가 인하 요청으로 되돌아올 수 있다는 점입니다.'
      : `현재 조건에서는 ${bestRow ? displayText(bestRow.product_name) : '선택 조건'}을 먼저 보고, 공급가 표의 제품별 체크리스트에서 발주 완료 이상인 행만 확정 매출로 봐야 합니다.`
    setAiMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: answer }])
    setAiQuestion('')
  }

  const updatePipelineStage = async (row, stage) => {
    await updateExecutiveRecord('export-pipeline', row.id, { stage })
    await load()
  }

  const updateSupplyPriceStage = async (row, stage) => {
    await updateExecutiveRecord('export-supply-prices', row.id, { pipeline_stage: stage })
    await load()
  }

  const priceColumns = [
    { key: 'product_name', label: '제품명', render: (row) => displayText(row.product_name) },
    { key: 'scenario_label', label: '조건', render: (row) => displayText(row.scenario_label) },
    { key: 'moq', label: 'MOQ', render: (row) => count(row.moq, '개') },
    { key: 'pipeline_stage', label: '수출 확정 체크리스트', render: (row) => (
      <StageChecklist
        row={row}
        selectedMoq={selectedMoq}
        stageKey="pipeline_stage"
        moqKey="moq"
        onStageChange={updateSupplyPriceStage}
      />
    ) },
    { key: 'export_supply_price_krw', label: '수출 공급가', render: (row) => won(row.export_supply_price_krw) },
    { key: 'supply_price_usd', label: '공급가 USD', render: (row) => `$${Number(row.supply_price_usd || 0).toFixed(2)}` },
    { key: 'expected_sales', label: '예상 매출', render: (row) => won(row.expected_sales) },
    { key: 'total_production_cost', label: '생산 원가', render: (row) => won(row.total_production_cost) },
    { key: 'operating_profit_total', label: '회사 이윤', render: (row) => won(row.operating_profit_total) },
    { key: 'operating_profit_rate', label: '이익률', render: (row) => pct(row.operating_profit_rate) },
    { key: 'upfront_cost', label: '선지출', render: (row) => won(row.upfront_cost) },
    { key: 'actions', label: '관리', render: (row) => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setEditingPrice(row)
            setShowPriceForm(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="inline-flex h-8 items-center rounded-md border border-sky-400/30 bg-sky-400/10 px-3 text-xs font-black text-sky-100 transition-colors hover:bg-sky-400/20"
        >
          수정
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('이 수출 공급가 데이터를 삭제할까요?')) return
            await deleteExecutiveRecord('export-supply-prices', row.id)
            if (editingPrice?.id === row.id) {
              setEditingPrice(null)
              setShowPriceForm(false)
            }
            await load()
          }}
          className="inline-flex h-8 items-center rounded-md border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-black text-rose-100 transition-colors hover:bg-rose-400/20"
        >
          삭제
        </button>
      </div>
    ) },
  ]

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title="수출 파이프라인" description="국가와 MOQ별 공급가, 회사 이윤, 체크리스트 기반 확정 매출을 함께 봅니다." />
        <button
          type="button"
          onClick={() => {
            setEditingPrice(null)
            setShowPriceForm((prev) => !prev)
          }}
          className="mb-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300"
        >
          <span className="material-symbols-outlined text-base">{showPriceForm ? 'close' : 'add'}</span>
          {showPriceForm ? '공급가 입력 닫기' : '수출 공급가 추가'}
        </button>
      </div>

      {showPriceForm && (
        <RecordForm
          key={editingPrice?.id || 'new-export-price'}
          title={editingPrice ? '수출 공급가 수정' : '수출 공급가 입력'}
          fields={priceFields}
          initialValues={editingPrice ? toInitialValues(editingPrice, priceFields) : {}}
          onSubmit={async (values) => {
            if (editingPrice) await updateExecutiveRecord('export-supply-prices', editingPrice.id, values)
            else await createExecutiveRecord('export-supply-prices', values)
            await load()
            setEditingPrice(null)
            setShowPriceForm(false)
          }}
        />
      )}

      <section className="mb-6 rounded-lg border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black text-white">공급가 조회 기준</p>
            <p className="mt-1 text-xs font-bold text-slate-400">{selectedFilterLabel}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-400">국가</span>
              <select
                value={selectedCountry}
                onChange={(event) => {
                  setSelectedCountry(event.target.value)
                  setSelectedMoq(ALL)
                }}
                className="h-10 min-w-36 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
              >
                <option value={ALL}>전체</option>
                {countryOptions.map((country) => (
                  <option key={String(country)} value={country}>{displayText(country)}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-400">MOQ</span>
              <select
                value={selectedMoq}
                onChange={(event) => setSelectedMoq(event.target.value)}
                className="h-10 min-w-36 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
              >
                <option value={ALL}>전체</option>
                {moqOptions.map((moq) => (
                  <option key={moq} value={moq}>{formatMoq(moq)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="공급가 기준 예상 매출" value={won(summary.expectedSales)} tone="sky" icon="language" />
        <KpiCard label="총 생산 원가" value={won(summary.productionCost)} tone="amber" icon="factory" />
        <KpiCard label="회사 이윤" value={won(summary.companyProfit)} tone="emerald" icon="trending_up" />
        <KpiCard label="체크리스트 확정 예상 매출" value={won(confirmedPriceSales)} tone="emerald" icon="task_alt" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-slate-900/70 p-5">
          <p className="text-xs font-black text-slate-400">파이프라인 전체 후보 매출</p>
          <p className="mt-3 text-2xl font-black text-white">{won(pipelinePotentialSales)}</p>
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
          <p className="text-xs font-black text-emerald-100">확정 반영 매출</p>
          <p className="mt-3 text-2xl font-black text-white">{won(confirmedPriceSales)}</p>
        </div>
        <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
          <p className="text-xs font-black text-sky-100">매출 반영 기준</p>
          <p className="mt-3 text-sm font-black text-white">발주 완료 체크부터 대표 지표에 반영됩니다.</p>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-slate-900/70 p-5 xl:col-span-2">
          <p className="text-sm font-black text-white">이윤 기준 최우선 검토</p>
          {bestRow ? (
            <>
              <p className="mt-2 text-xl font-black text-white">
                {displayText(bestRow.country)} · {displayText(bestRow.product_name)} · {displayText(bestRow.scenario_label)}
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-100">
                예상 매출 {won(bestRow.expected_sales)} / 회사 이윤 {won(bestRow.operating_profit_total)} / 이익률 {pct(bestRow.operating_profit_rate)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm font-bold text-slate-500">선택 조건에 해당하는 공급가 데이터가 없습니다.</p>
          )}
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
          <p className="text-sm font-black text-emerald-100">평균 이익률</p>
          <p className="mt-3 text-3xl font-black text-white">{pct(summary.avgProfitRate)}</p>
          <p className="mt-2 text-xs font-bold text-emerald-100">선택 공급가 {filteredPriceRows.length}건 기준</p>
        </div>
      </section>

      <ExportAiCommentary
        context={aiContext}
        messages={aiMessages}
        question={aiQuestion}
        onQuestionChange={setAiQuestion}
        onAsk={askAi}
      />

      <Panel title="국가별 수출 공급가 및 회사 이윤" right={<span className="text-xs font-black text-slate-400">{selectedFilterLabel}</span>}>
        <div className="space-y-6">
          {priceGroups.map((group) => {
            return (
              <section key={group.key} className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-lg font-black text-white">{group.country} / {formatMoq(group.moq)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">이 조건의 체크리스트와 공급가를 함께 봅니다.</p>
                  </div>
                  <span className="w-fit rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-100">
                    공급가 {group.rows.length}건
                  </span>
                </div>
                <DataTable rows={group.rows} rowKey={(row) => row.id} columns={priceColumns} />
              </section>
            )
          })}
        </div>
      </Panel>

      <div className="mt-6">
        <RecordForm
          title="수출 파이프라인 입력"
          fields={pipelineFields}
          initialValues={{ stage: PIPELINE_STAGES[0], certification_required: false, current_status: 'OPEN' }}
          onSubmit={async (values) => {
            await createExecutiveRecord('export-pipeline', values)
            await load()
          }}
        />
      </div>

      <Panel title="수출 진행 현황" right={<span className="text-xs font-black text-slate-400">발주 완료 이상 {confirmedPipelineRows.length}건</span>}>
        <DataTable
          rows={filteredPipelineRows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'country', label: '국가', render: (row) => displayText(row.country) },
            { key: 'buyer_name', label: '바이어명', render: (row) => displayText(row.buyer_name) },
            { key: 'stage', label: '수출 확정 체크리스트', render: (row) => (
              <StageChecklist row={row} selectedMoq={selectedMoq} onStageChange={updatePipelineStage} />
            ) },
            { key: 'expected_moq', label: '예상 MOQ', render: (row) => count(row.expected_moq, '개') },
            { key: 'expected_sales', label: '예상 매출', render: (row) => won(row.expected_sales) },
            { key: 'expected_payment_date', label: '예상 입금일' },
            { key: 'certification_required', label: '인증 필요', render: (row) => (row.certification_required ? '필요' : '불필요') },
            { key: 'current_status', label: '현재 상태', render: (row) => <StatusBadge value={row.current_status} /> },
            { key: 'next_action', label: '다음 액션', render: (row) => displayText(row.next_action) },
            { key: 'owner_name', label: '담당자', render: (row) => displayText(row.owner_name) },
            { key: 'memo', label: '메모', render: (row) => displayText(row.memo) },
          ]}
        />
      </Panel>
    </>
  )
}
