import { useEffect, useMemo, useState } from 'react'
import { getExecutiveProductProfits, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, KpiCard, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import { count } from './formatters'

const BRAND_CATEGORIES = ['하이프리', '국민한상']

const numberValue = (value) => Number(value || 0)

function CategoryTabs({ selectedCategory, setSelectedCategory, rows }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {BRAND_CATEGORIES.map((category) => {
        const active = selectedCategory === category
        const categoryCount = rows.filter((row) => row.category === category).length
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
            <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px]">{categoryCount}</span>
          </button>
        )
      })}
    </div>
  )
}

function productionStatus(row) {
  const moq = numberValue(row.daily_production_moq)
  const stock = numberValue(row.stock_quantity)
  const safeStock = numberValue(row.safe_stock || 3000)
  if (!moq) return '생산 기준 미설정'
  if (stock < safeStock) return '생산 필요'
  if (stock > safeStock * 2) return '생산 보류'
  return '정상'
}

function statusBadgeValue(status) {
  if (status === '생산 필요') return 'WATCH'
  if (status === '생산 보류') return 'OVER_STOCK'
  if (status === '생산 기준 미설정') return 'LOW_STOCK'
  return 'NORMAL'
}

function QuickProductionEditor({ row, setRow, values, setValues, onSave, saving, message }) {
  const update = (key, value) => setValues((prev) => ({ ...prev, [key]: value }))

  return (
    <section className="mb-6 rounded-lg border border-sky-400/20 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">생산 정보 빠른 수정</h2>
          <p className="mt-1 text-xs font-bold text-slate-400">제품을 선택한 뒤 1일 생산 MOQ, 카톤/파레트, 제조일자와 이슈를 바로 저장합니다.</p>
        </div>
        {message && <span className="text-xs font-black text-sky-100">{message}</span>}
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
        <p className="text-[11px] font-bold text-slate-500">선택 제품</p>
        <p className="mt-1 truncate text-base font-black text-white">{row?.product_name || '아래 표에서 제품을 선택하세요'}</p>
      </div>

      <form className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6" onSubmit={onSave}>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-400">1일 생산 MOQ</span>
          <input type="number" min="0" value={values.daily_production_moq} onChange={(event) => update('daily_production_moq', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-400">카톤 수량</span>
          <input value={values.carton_quantity} onChange={(event) => update('carton_quantity', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-400">파레트 수량</span>
          <input type="number" min="0" value={values.pallet_quantity} onChange={(event) => update('pallet_quantity', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-400">제조일자</span>
          <input type="date" value={values.manufacture_date} onChange={(event) => update('manufacture_date', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-400">유통기한</span>
          <input type="date" value={values.expiry_date} onChange={(event) => update('expiry_date', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={!row || saving} className="h-10 w-full rounded-lg bg-sky-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
            {saving ? '저장 중...' : '생산정보 저장'}
          </button>
        </div>
        <label className="lg:col-span-3">
          <span className="mb-1 block text-xs font-bold text-slate-400">사급원료</span>
          <input value={values.supplied_materials} onChange={(event) => update('supplied_materials', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
        <label className="lg:col-span-3">
          <span className="mb-1 block text-xs font-bold text-slate-400">생산 이슈</span>
          <input value={values.issue_text} onChange={(event) => update('issue_text', event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
        </label>
      </form>
    </section>
  )
}

export default function ProductionManagementPage() {
  const [rows, setRows] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('하이프리')
  const [selectedRow, setSelectedRow] = useState(null)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => getExecutiveProductProfits().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  const filteredRows = useMemo(() => rows.filter((row) => row.category === selectedCategory), [rows, selectedCategory])
  const plannedRows = filteredRows.filter((row) => numberValue(row.daily_production_moq) > 0)
  const dailyCapacity = plannedRows.reduce((sum, row) => sum + numberValue(row.daily_production_moq), 0)
  const needProduction = filteredRows.filter((row) => productionStatus(row) === '생산 필요').length
  const missingStandard = filteredRows.filter((row) => productionStatus(row) === '생산 기준 미설정').length

  const selectRow = (row) => {
    setSelectedRow(row)
    setValues({
      daily_production_moq: row.daily_production_moq ?? '',
      carton_quantity: row.carton_quantity ?? '',
      pallet_quantity: row.pallet_quantity ?? '',
      manufacture_date: row.manufacture_date ?? '',
      expiry_date: row.expiry_date ?? '',
      supplied_materials: row.supplied_materials ?? '',
      issue_text: row.issue_text ?? '',
    })
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    setSelectedRow(null)
    setValues({})
    setMessage('')
  }, [selectedCategory])

  const saveProduction = async (event) => {
    event.preventDefault()
    if (!selectedRow) return
    setSaving(true)
    setMessage('')
    try {
      await updateExecutiveRecord('product-profits', selectedRow.id, values)
      await load()
      setSelectedRow((prev) => prev ? { ...prev, ...values } : prev)
      setMessage('생산 정보가 저장되었습니다.')
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '생산 정보 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="생산 관리" description="제품별 생산 MOQ, 포장 단위, 제조/유통기한과 생산 이슈를 한 화면에서 관리합니다." />

      <CategoryTabs selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} rows={rows} />

      <QuickProductionEditor row={selectedRow} setRow={setSelectedRow} values={values} setValues={setValues} onSave={saveProduction} saving={saving} message={message} />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label={`${selectedCategory} 생산 품목`} value={count(filteredRows.length, '개')} icon="precision_manufacturing" helperText="제품 마스터 기준" />
        <KpiCard label="1일 생산 가능량" value={count(dailyCapacity, '개')} icon="factory" tone="emerald" helperText="MOQ 입력 품목 합계" />
        <KpiCard label="생산 필요 품목" value={count(needProduction, '개')} icon="priority_high" tone="amber" helperText="현재 재고 < 안전재고" />
        <KpiCard label="기준 미설정" value={count(missingStandard, '개')} icon="rule_settings" tone="rose" helperText="1일 생산 MOQ 미입력" />
      </section>

      <Panel title={`${selectedCategory} 생산 운영표`} right={<span className="text-xs font-black text-slate-400">{filteredRows.length}개 제품</span>}>
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'product_name', label: '제품명', render: (row) => (
              <button type="button" onClick={() => selectRow(row)} className="text-left font-black text-sky-100 underline-offset-4 hover:underline">
                {row.product_name}
              </button>
            ) },
            { key: 'sku', label: 'SKU' },
            { key: 'package_composition', label: '구성' },
            { key: 'daily_production_moq', label: '1일 생산 MOQ', render: (row) => row.daily_production_moq ? count(row.daily_production_moq, '개') : '-' },
            { key: 'stock_quantity', label: '현재 재고', render: (row) => count(row.stock_quantity, '개') },
            { key: 'safe_stock', label: '안전재고', render: (row) => count(row.safe_stock || 3000, '개') },
            { key: 'carton_quantity', label: '카톤 수량', render: (row) => row.carton_quantity || '-' },
            { key: 'pallet_quantity', label: '파레트 수량', render: (row) => row.pallet_quantity ?? '-' },
            { key: 'manufacture_date', label: '제조일자', render: (row) => row.manufacture_date || '-' },
            { key: 'expiry_date', label: '유통기한', render: (row) => row.expiry_date || '-' },
            { key: 'supplied_materials', label: '사급원료', render: (row) => row.supplied_materials || '-' },
            { key: 'issue_text', label: '생산 이슈', render: (row) => row.issue_text || '-' },
            { key: 'production_status', label: '생산 상태', render: (row) => <StatusBadge value={statusBadgeValue(productionStatus(row))} /> },
          ]}
        />
      </Panel>
    </>
  )
}
