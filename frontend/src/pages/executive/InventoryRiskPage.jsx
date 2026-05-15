import { useEffect, useMemo, useState } from 'react'
import { getExecutiveProductProfits, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import { count, won } from './formatters'

const BRAND_CATEGORIES = ['하이프리', '국민한상']

function CategoryTabs({ selectedCategory, setSelectedCategory, rows }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {BRAND_CATEGORIES.map((category) => {
        const active = selectedCategory === category
        const countByCategory = rows.filter((row) => row.category === category).length
        return (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-black transition-colors ${
              active
                ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
                : 'border-white/10 bg-slate-900/70 text-slate-400 hover:bg-white/5'
            }`}
          >
            {category}
            <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px]">{countByCategory}</span>
          </button>
        )
      })}
    </div>
  )
}

function QuickStockEditor({ rows, selectedProduct, setSelectedProduct, stockValue, setStockValue, onSave, saving, message }) {
  return (
    <section className="mb-6 rounded-lg border border-sky-400/20 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">간편 재고 입력</h2>
          <p className="mt-1 text-xs font-bold text-slate-400">제품명을 클릭하면 현재 재고가 자동 입력됩니다. 재고 수량만 바꿔 저장하세요.</p>
        </div>
        {message && <span className="text-xs font-black text-sky-100">{message}</span>}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {rows.map((row) => {
          const active = selectedProduct?.id === row.id
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelectedProduct(row)
                setStockValue(String(row.stock_quantity ?? 0))
              }}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100'
                  : 'border-white/10 bg-slate-950/70 text-slate-300 hover:bg-white/5'
              }`}
            >
              <p className="max-w-[220px] truncate text-xs font-black">{row.product_name}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                현재 {count(row.stock_quantity, '개')} / 안전 {count(row.safe_stock || 3000, '개')}
              </p>
            </button>
          )
        })}
      </div>

      <form className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_180px_140px]" onSubmit={onSave}>
        <div className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2">
          <p className="text-[11px] font-bold text-slate-500">선택 제품</p>
          <p className="mt-1 truncate text-sm font-black text-white">{selectedProduct?.product_name || '제품을 선택하세요'}</p>
        </div>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-400">재고 수량</span>
          <input
            type="number"
            min="0"
            value={stockValue}
            onChange={(event) => setStockValue(event.target.value)}
            className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
            placeholder="0"
            required
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!selectedProduct || saving}
            className="h-10 w-full rounded-lg bg-sky-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {saving ? '저장 중...' : '재고 저장'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default function InventoryRiskPage() {
  const [rows, setRows] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('하이프리')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [stockValue, setStockValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => getExecutiveProductProfits().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const filteredRows = useMemo(() => (
    rows.filter((row) => row.category === selectedCategory)
  ), [rows, selectedCategory])

  useEffect(() => {
    setSelectedProduct(null)
    setStockValue('')
    setMessage('')
  }, [selectedCategory])

  const inventoryValue = filteredRows.reduce((sum, row) => sum + Number(row.production_cost || 0) * Number(row.stock_quantity || 0), 0)
  const lowStock = filteredRows.filter((row) => row.status === 'LOW_STOCK').length
  const overStock = filteredRows.filter((row) => row.status === 'OVER_STOCK').length

  const saveStock = async (event) => {
    event.preventDefault()
    if (!selectedProduct) return

    setSaving(true)
    setMessage('')
    try {
      await updateExecutiveRecord('product-profits', selectedProduct.id, { stock_quantity: stockValue })
      await load()
      setSelectedProduct((prev) => prev ? { ...prev, stock_quantity: Number(stockValue || 0) } : prev)
      setMessage('재고가 저장되었습니다.')
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '재고 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="재고 관리" description="하이프리와 국민한상 카테고리별 재고 평가 금액, 안전재고 미달, 과다 재고를 확인합니다." />

      <CategoryTabs selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} rows={rows} />

      <QuickStockEditor
        rows={filteredRows}
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        stockValue={stockValue}
        setStockValue={setStockValue}
        onSave={saveStock}
        saving={saving}
        message={message}
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label={`${selectedCategory} 재고 평가 금액`} value={won(inventoryValue)} icon="inventory_2" />
        <KpiCard label="재고 부족 상품" value={count(lowStock, '개')} badge={lowStock ? 'WATCH' : 'NORMAL'} tone="amber" icon="production_quantity_limits" />
        <KpiCard label="재고 과다 상품" value={count(overStock, '개')} badge={overStock ? 'WATCH' : 'NORMAL'} tone="rose" icon="warehouse" />
      </section>

      <Panel title={`${selectedCategory} 제품별 재고 위험`} right={<span className="text-xs font-black text-slate-400">{filteredRows.length}개 구성</span>}>
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'category', label: '카테고리' },
            { key: 'product_name', label: '제품명', render: (row) => (
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(row)
                  setStockValue(String(row.stock_quantity ?? 0))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="text-left font-black text-sky-100 underline-offset-4 hover:underline"
              >
                {row.product_name}
              </button>
            ) },
            { key: 'sku', label: 'SKU' },
            { key: 'package_composition', label: '구성' },
            { key: 'bundle_quantity', label: '상품구성', render: (row) => count(row.bundle_quantity, '개') },
            { key: 'stock_quantity', label: '현재 재고', render: (row) => count(row.stock_quantity, '개') },
            { key: 'safe_stock', label: '안전재고', render: (row) => count(row.safe_stock || 3000, '개') },
            { key: 'inventory_value', label: '재고 평가액', render: (row) => won(Number(row.production_cost || 0) * Number(row.stock_quantity || 0)) },
            { key: 'daily_production_moq', label: '1일 생산 MOQ', render: (row) => row.daily_production_moq ? count(row.daily_production_moq, '개') : '-' },
            { key: 'carton_quantity', label: '카톤수량' },
            { key: 'pallet_quantity', label: '파레트수량', render: (row) => row.pallet_quantity ?? '-' },
            { key: 'manufacture_date', label: '제조일자' },
            { key: 'expiry_check_date', label: '유통기한 확인날짜' },
            { key: 'expiry_date', label: '유통기한' },
            { key: 'supplied_materials', label: '사급원료' },
            { key: 'issue_text', label: '이슈' },
            { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
          ]}
        />
      </Panel>
    </>
  )
}
