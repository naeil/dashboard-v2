import { useEffect, useMemo, useState } from 'react'
import { getExecutiveProductProfits, syncPlayAutoProductMovements, updateExecutiveRecord } from '../../api/executiveApi'
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
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState('')

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

  const syncInventory = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncMessage('PlayAuto API에서 최신 재고를 가져오는 중입니다.')
    try {
      const response = await syncPlayAutoProductMovements()
      await load()
      const syncedAt = response.data?.summary?.last_synced_at || new Date().toISOString()
      setLastSyncedAt(syncedAt)
      setSyncMessage('최신 재고 데이터가 반영되었습니다.')
    } catch (error) {
      setSyncMessage(error?.response?.data?.message || 'PlayAuto 재고 업데이트에 실패했습니다. 연동 설정을 확인해주세요.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <PageHeader title="재고 관리" description="하이프리와 국민한상 카테고리별 재고 평가 금액, 안전재고 미달, 과다 재고를 확인합니다." />

      <CategoryTabs selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} rows={rows} />

      <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Realtime Inventory API</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">재고 관리 API 실시간 업데이트</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              PlayAuto의 제품 재고와 출고 스냅샷을 다시 수집한 뒤, 이 화면의 현재 재고와 재고 위험 값을 갱신합니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-white px-3 py-1 text-slate-600">제품 {count(rows.length, '개')}</span>
              <span className="rounded-full bg-white px-3 py-1 text-amber-700">부족 {count(lowStock, '개')}</span>
              <span className="rounded-full bg-white px-3 py-1 text-rose-700">과다 {count(overStock, '개')}</span>
              {lastSyncedAt && <span className="rounded-full bg-white px-3 py-1 text-sky-700">최근 업데이트 {new Date(lastSyncedAt).toLocaleString('ko-KR')}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={syncInventory}
            disabled={syncing}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>{syncing ? 'sync' : 'cloud_sync'}</span>
            {syncing ? '업데이트 중' : 'API 실시간 업데이트'}
          </button>
        </div>
        {syncMessage && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-700">
            {syncMessage}
          </div>
        )}
      </section>

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
          defaultSort="stockDesc"
          sortOptions={[
            { id: 'stockDesc', label: '재고 많은 순', key: 'stock_quantity' },
            { id: 'stockAsc', label: '재고 적은 순', key: 'stock_quantity', direction: 'asc' },
            { id: 'valueDesc', label: '재고 평가금액 높은 순', value: (row) => Number(row.production_cost || 0) * Number(row.stock_quantity || 0) },
            { id: 'safeGapAsc', label: '안전재고 부족 순', value: (row) => Number(row.stock_quantity || 0) - Number(row.safe_stock || 3000), direction: 'asc' },
            { id: 'expiryAsc', label: '유통기한 임박 순', key: 'expiry_date', type: 'date', direction: 'asc' },
          ]}
        />
      </Panel>
    </>
  )
}
