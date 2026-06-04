import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveProductProfits,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

const BRAND_CATEGORIES = ['하이프리', '국민한상']
const PROFIT_TYPES = ['전체', 'SKU 마스터', '온라인 판매']

const productFields = [
  { name: 'product_name', label: '제품명', required: true },
  { name: 'sku', label: 'SKU', required: true },
  { name: 'category', label: '카테고리', type: 'select', required: true, options: BRAND_CATEGORIES.map((value) => ({ value, label: value })) },
  { name: 'package_composition', label: '구성' },
  { name: 'bundle_quantity', label: '상품 구성 수량', type: 'number' },
  { name: 'total_weight_g', label: '총중량(g)', type: 'number' },
  { name: 'production_cost', label: '제품 원가', type: 'number', required: true },
  { name: 'export_cost_ex_vat', label: '수출 원가(VAT 제외)', type: 'number' },
  { name: 'export_supply_price_5000', label: '수출 공급가 MOQ 5,000', type: 'number' },
  { name: 'export_supply_price_10000', label: '수출 공급가 MOQ 10,000', type: 'number' },
  { name: 'export_supply_price_20000', label: '수출 공급가 MOQ 20,000', type: 'number' },
  { name: 'consumer_price', label: '소비자가', type: 'number' },
  { name: 'discount_amount', label: '할인가', type: 'number' },
  { name: 'final_discount_price', label: '최종 할인가', type: 'number' },
  { name: 'unit_selling_price', label: '개당 판매가', type: 'number' },
  { name: 'customer_shipping_fee', label: '소비자 운반비', type: 'number' },
  { name: 'gross_sales', label: '매출합계', type: 'number' },
  { name: 'marketing_cost', label: '마케팅비용', type: 'number' },
  { name: 'ad_cost', label: '광고비용', type: 'number' },
  { name: 'operating_admin_cost', label: '운영판관비', type: 'number' },
  { name: 'platform_fee', label: '채널수수료', type: 'number' },
  { name: 'storage_cost', label: '보관비', type: 'number' },
  { name: 'logistics_cost', label: '실제 운반비', type: 'number' },
  { name: 'total_admin_cost', label: '판관비합계', type: 'number', readOnly: true },
  { name: 'gross_profit', label: '매출이익', type: 'number', readOnly: true },
  { name: 'gross_profit_rate', label: '매출이익률', type: 'number', readOnly: true },
  { name: 'expected_net_profit', label: '영업이익', type: 'number', readOnly: true },
  { name: 'margin_rate', label: '영업이익률', type: 'number', readOnly: true },
  { name: 'stock_quantity', label: '재고 수량', type: 'number' },
  { name: 'safe_stock', label: '안전재고', type: 'number' },
  { name: 'daily_production_moq', label: '1일 생산 MOQ', type: 'number' },
  { name: 'carton_quantity', label: '카톤 수량' },
  { name: 'pallet_quantity', label: '파레트 수량', type: 'number' },
  { name: 'manufacture_date', label: '제조일자', type: 'date' },
  { name: 'expiry_check_date', label: '유통기한 확인날짜', type: 'date' },
  { name: 'expiry_date', label: '유통기한', type: 'date' },
  { name: 'supplied_materials', label: '사급원료', wide: true },
  { name: 'issue_text', label: '이슈', wide: true },
  { name: 'note', label: '비고', wide: true },
]

const numberValue = (value) => Number(value || 0)
const roundValue = (value) => Math.round(Number(value || 0) * 100) / 100

const toInitialValues = (row) => productFields.reduce((acc, field) => {
  acc[field.name] = row?.[field.name] ?? ''
  return acc
}, {})

function rowType(row) {
  return String(row.sku || '').startsWith('DK-ONLINE-') ? '온라인 판매' : 'SKU 마스터'
}

function costBasis(row) {
  const exportCost = numberValue(row.export_cost_ex_vat)
  return exportCost > 0 ? exportCost * 5000 : numberValue(row.production_cost)
}

function adminCost(row) {
  return (
    numberValue(row.total_admin_cost)
    || numberValue(row.marketing_cost)
      + numberValue(row.ad_cost)
      + numberValue(row.operating_admin_cost)
      + numberValue(row.platform_fee)
      + numberValue(row.storage_cost)
      + numberValue(row.logistics_cost)
  )
}

function computeProductProfitValues(values) {
  const grossSales = numberValue(values.gross_sales)
  const productionCost = costBasis(values)
  const totalAdminCost = adminCost(values)
  const grossProfit = grossSales - productionCost
  const operatingProfit = grossProfit - totalAdminCost
  const grossProfitRate = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0
  const operatingProfitRate = grossSales > 0 ? (operatingProfit / grossSales) * 100 : 0

  return {
    ...values,
    total_admin_cost: roundValue(totalAdminCost),
    gross_profit: roundValue(grossProfit),
    gross_profit_rate: roundValue(grossProfitRate),
    expected_net_profit: roundValue(operatingProfit),
    margin_rate: roundValue(operatingProfitRate),
  }
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-black transition-colors ${
        active
          ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
          : 'border-white/10 bg-slate-900/70 text-slate-400 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

function CategoryTabs({ selectedCategory, setSelectedCategory, rows }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {BRAND_CATEGORIES.map((category) => (
        <TabButton
          key={category}
          active={selectedCategory === category}
          onClick={() => setSelectedCategory(category)}
        >
          {category}
          <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px]">
            {rows.filter((row) => row.category === category).length}
          </span>
        </TabButton>
      ))}
    </div>
  )
}

function TypeTabs({ selectedType, setSelectedType, rows }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {PROFIT_TYPES.map((type) => (
        <TabButton
          key={type}
          active={selectedType === type}
          onClick={() => setSelectedType(type)}
        >
          {type}
          <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px]">
            {type === '전체' ? rows.length : rows.filter((row) => rowType(row) === type).length}
          </span>
        </TabButton>
      ))}
    </div>
  )
}

function ProfitState({ row }) {
  const margin = numberValue(row.margin_rate)
  if (margin < 0) return <StatusBadge value="HIGH" />
  if (margin < 10) return <StatusBadge value="LOW_MARGIN" />
  if (margin < 20) return <StatusBadge value="WATCH" />
  return <StatusBadge value="NORMAL" />
}

function FormulaGuide() {
  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-xs font-bold text-sky-100">
      <p>새 기준: 매출이익 = 매출합계 - 원가기준, 영업이익 = 매출이익 - 판관비합계</p>
      <p className="mt-1 text-slate-300">SKU 마스터는 수출 원가가 있으면 `수출 원가 x 5,000개`를 원가기준으로 보고, 온라인 판매 데이터는 엑셀의 상품별 생산원가를 사용합니다.</p>
    </div>
  )
}

export default function ProductProfitPage() {
  const [rows, setRows] = useState([])
  const [editingRow, setEditingRow] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('하이프리')
  const [selectedType, setSelectedType] = useState('전체')
  const [showForm, setShowForm] = useState(false)

  const load = () => getExecutiveProductProfits().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const categoryRows = useMemo(() => (
    rows.filter((row) => row.category === selectedCategory)
  ), [rows, selectedCategory])

  const filteredRows = useMemo(() => (
    categoryRows
      .filter((row) => selectedType === '전체' || rowType(row) === selectedType)
      .map((row) => computeProductProfitValues(row))
      .sort((a, b) => numberValue(b.expected_net_profit) - numberValue(a.expected_net_profit))
  ), [categoryRows, selectedType])

  const summary = useMemo(() => {
    const grossSales = filteredRows.reduce((total, row) => total + numberValue(row.gross_sales), 0)
    const productionCost = filteredRows.reduce((total, row) => total + costBasis(row), 0)
    const totalAdminCost = filteredRows.reduce((total, row) => total + adminCost(row), 0)
    const grossProfit = filteredRows.reduce((total, row) => total + numberValue(row.gross_profit), 0)
    const operatingProfit = filteredRows.reduce((total, row) => total + numberValue(row.expected_net_profit), 0)
    const operatingMargin = grossSales > 0 ? (operatingProfit / grossSales) * 100 : 0
    const lowMarginCount = filteredRows.filter((row) => numberValue(row.margin_rate) < 10).length

    return { grossSales, productionCost, totalAdminCost, grossProfit, operatingProfit, operatingMargin, lowMarginCount }
  }, [filteredRows])

  const handleEdit = (row) => {
    setEditingRow(row)
    setSelectedCategory(row.category || '하이프리')
    setSelectedType(rowType(row))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeForm = () => {
    setEditingRow(null)
    setShowForm(false)
  }

  const profitColumns = [
    { key: 'basis', label: '기준', render: (row) => rowType(row) },
    { key: 'product_name', label: '제품명', render: (row) => <span className="font-black text-white">{row.product_name}</span> },
    { key: 'package_composition', label: '구성', render: (row) => row.package_composition || count(row.bundle_quantity, '개') },
    { key: 'gross_sales', label: '매출합계', render: (row) => won(row.gross_sales) },
    { key: 'cost_basis', label: '원가기준', render: (row) => won(costBasis(row)) },
    { key: 'total_admin_cost', label: '판관비합계', render: (row) => won(adminCost(row)) },
    { key: 'gross_profit', label: '매출이익', render: (row) => won(row.gross_profit) },
    { key: 'gross_profit_rate', label: '매출이익률', render: (row) => pct(row.gross_profit_rate) },
    { key: 'expected_net_profit', label: '영업이익', render: (row) => (
      <span className={numberValue(row.expected_net_profit) >= 0 ? 'font-black text-emerald-200' : 'font-black text-rose-200'}>
        {won(row.expected_net_profit)}
      </span>
    ) },
    { key: 'margin_rate', label: '영업이익률', render: (row) => pct(row.margin_rate) },
    { key: 'profit_state', label: '상태', render: (row) => <ProfitState row={row} /> },
    { key: 'actions', label: '관리', render: (row) => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleEdit(row)}
          className="inline-flex h-8 items-center rounded-md border border-sky-400/30 bg-sky-400/10 px-3 text-xs font-black text-sky-100 transition-colors hover:bg-sky-400/20"
        >
          수정
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('이 제품 손익 데이터를 삭제할까요?')) return
            await deleteExecutiveRecord('product-profits', row.id)
            if (editingRow?.id === row.id) closeForm()
            await load()
          }}
          className="inline-flex h-8 items-center rounded-md border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-black text-rose-100 transition-colors hover:bg-rose-400/20"
        >
          삭제
        </button>
      </div>
    ) },
  ]

  const detailColumns = [
    { key: 'sku', label: 'SKU' },
    { key: 'product_name', label: '제품명', render: (row) => <span className="font-black text-white">{row.product_name}</span> },
    { key: 'consumer_price', label: '소비자가', render: (row) => won(row.consumer_price) },
    { key: 'final_discount_price', label: '최종가', render: (row) => won(row.final_discount_price || row.selling_price) },
    { key: 'unit_selling_price', label: '개당가', render: (row) => won(row.unit_selling_price || row.supply_price) },
    { key: 'production_cost', label: '제품 원가', render: (row) => won(row.production_cost) },
    { key: 'export_cost_ex_vat', label: '수출 원가', render: (row) => won(row.export_cost_ex_vat) },
    { key: 'export_supply_price_5000', label: 'MOQ 5천 공급가', render: (row) => won(row.export_supply_price_5000) },
    { key: 'export_supply_price_10000', label: 'MOQ 1만 공급가', render: (row) => won(row.export_supply_price_10000) },
    { key: 'export_supply_price_20000', label: 'MOQ 2만 공급가', render: (row) => won(row.export_supply_price_20000) },
    { key: 'stock_quantity', label: '재고', render: (row) => count(row.stock_quantity, '개') },
    { key: 'safe_stock', label: '안전재고', render: (row) => count(row.safe_stock || 3000, '개') },
    { key: 'expiry_date', label: '유통기한' },
    { key: 'issue_text', label: '이슈' },
  ]

  return (
    <>
      <PageHeader
        title="제품 손익"
        description="기존 엑셀 데이터를 제품별 손익 기준으로 재정리했습니다. 매출합계, 원가기준, 판관비합계, 매출이익, 영업이익을 한 화면에서 비교합니다."
      />

      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <CategoryTabs selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} rows={rows} />
          <TypeTabs selectedType={selectedType} setSelectedType={setSelectedType} rows={categoryRows} />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRow(null)
            setShowForm((prev) => !prev)
          }}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300"
        >
          {showForm ? '입력 닫기' : '제품 데이터 추가'}
        </button>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="매출합계" value={won(summary.grossSales)} tone="sky" icon="storefront" />
        <KpiCard label="원가기준" value={won(summary.productionCost)} tone="amber" icon="factory" />
        <KpiCard label="판관비합계" value={won(summary.totalAdminCost)} tone="amber" icon="receipt_long" />
        <KpiCard label="매출이익" value={won(summary.grossProfit)} tone="emerald" icon="payments" />
        <KpiCard label="영업이익" value={won(summary.operatingProfit)} tone={summary.operatingProfit >= 0 ? 'emerald' : 'rose'} icon="trending_up" />
        <KpiCard label="영업이익률" value={pct(summary.operatingMargin)} tone={summary.lowMarginCount ? 'amber' : 'emerald'} badge={summary.lowMarginCount ? 'WATCH' : 'NORMAL'} icon="percent" />
      </section>

      <div className="mb-6">
        <FormulaGuide />
      </div>

      {showForm && (
        <div className="mb-6">
          <RecordForm
            key={editingRow?.id || `new-product-profit-${selectedCategory}`}
            title={editingRow ? '제품 손익 데이터 수정' : '제품 손익 데이터 입력'}
            fields={productFields}
            initialValues={editingRow ? toInitialValues(editingRow) : { category: selectedCategory, safe_stock: 3000 }}
            computeValues={computeProductProfitValues}
            onSubmit={async (values) => {
              if (editingRow) await updateExecutiveRecord('product-profits', editingRow.id, values)
              else await createExecutiveRecord('product-profits', values)
              await load()
              setEditingRow(null)
              setShowForm(false)
              setSelectedCategory(values.category || selectedCategory)
            }}
          />
          {editingRow && (
            <button
              type="button"
              onClick={closeForm}
              className="mt-3 inline-flex h-10 items-center rounded-lg border border-white/10 bg-slate-900 px-4 text-sm font-black text-slate-200 transition-colors hover:bg-white/5"
            >
              수정 취소
            </button>
          )}
        </div>
      )}

      <div className="space-y-6">
        <Panel
          title={`${selectedCategory} 손익 기준표`}
          right={<span className="text-xs font-black text-slate-400">{selectedType} / {filteredRows.length}개 제품</span>}
        >
          <DataTable
            rows={filteredRows}
            rowKey={(row) => row.id}
            columns={profitColumns}
            defaultSort="netProfitDesc"
            sortOptions={[
              { id: 'netProfitDesc', label: '순익 높은 순', key: 'expected_net_profit' },
              { id: 'netProfitAsc', label: '순익 낮은 순', key: 'expected_net_profit', direction: 'asc' },
              { id: 'marginDesc', label: '영업이익률 높은 순', key: 'margin_rate' },
              { id: 'marginAsc', label: '영업이익률 낮은 순', key: 'margin_rate', direction: 'asc' },
              { id: 'salesDesc', label: '매출 높은 순', key: 'gross_sales' },
              { id: 'costDesc', label: '원가 높은 순', value: (row) => costBasis(row) },
              { id: 'stockDesc', label: '재고 많은 순', key: 'stock_quantity' },
            ]}
          />
        </Panel>

        <Panel
          title="상세 원가 및 수출 기준"
          right={<span className="text-xs font-black text-slate-400">원가 수정 시 손익 자동 재계산</span>}
        >
          <DataTable
            rows={filteredRows}
            rowKey={(row) => `detail-${row.id}`}
            columns={detailColumns}
            defaultSort="stockDesc"
            sortOptions={[
              { id: 'stockDesc', label: '재고 많은 순', key: 'stock_quantity' },
              { id: 'stockAsc', label: '재고 적은 순', key: 'stock_quantity', direction: 'asc' },
              { id: 'priceDesc', label: '판매가 높은 순', value: (row) => row.final_discount_price || row.selling_price || row.consumer_price },
              { id: 'costDesc', label: '원가 높은 순', key: 'production_cost' },
              { id: 'expiryAsc', label: '유통기한 임박 순', key: 'expiry_date', type: 'date', direction: 'asc' },
            ]}
          />
        </Panel>
      </div>
    </>
  )
}
