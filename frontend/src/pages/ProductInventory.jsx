import { useEffect, useMemo, useState } from 'react'
import { getBrands, getProductInventory } from '../api/salesApi'

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('ko-KR')
}

function formatDateTime(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function SummaryCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-3 break-keep text-[10px] font-bold leading-snug tracking-[0.1em] text-slate-400 sm:text-[11px] lg:text-xs">
        {label}
      </p>
      <p className="overflow-hidden text-[clamp(2.1rem,2.6vw,3rem)] font-black leading-none tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  )
}

export default function ProductInventory({ isExpanded }) {
  const [companyId] = useState(1)
  const [selectedBrand, setSelectedBrand] = useState('ALL')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)
  const [brands, setBrands] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await getBrands(companyId)
        setBrands(response.data || [])
      } catch (error) {
        console.error('Brand API error:', error)
        setBrands([])
      }
    }

    fetchBrands()
  }, [companyId])

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const brandId = selectedBrand === 'ALL' ? null : Number(selectedBrand)
        const response = await getProductInventory(companyId, brandId, selectedMonth)
        setItems(response.data || [])
      } catch (error) {
        console.error('Inventory API error:', error)
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [companyId, selectedBrand, selectedMonth])

  const summary = useMemo(() => {
    const totalProducts = items.length
    const totalStock = items.reduce((sum, item) => sum + Number(item.realStock ?? 0), 0)
    const totalSafeStock = items.reduce((sum, item) => sum + Number(item.safeStock ?? 0), 0)
    const totalMonthlyOutbound = items.reduce((sum, item) => sum + Number(item.monthlyOutboundCount ?? 0), 0)
    const brandCount = new Set(
      items
        .filter((item) => item.brandName && item.brandName !== '미분류')
        .map((item) => item.brandId)
    ).size

    return { totalProducts, totalStock, totalSafeStock, totalMonthlyOutbound, brandCount }
  }, [items])

  return (
    <main
      className={`min-h-screen bg-slate-50 p-8 transition-all duration-300 ${
        isExpanded ? 'ml-64' : 'ml-20'
      }`}
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">재고 및 출고량</h1>
          <p className="mt-3 text-slate-500">
            브랜드별 상품 재고와 월 기준 출고량을 한눈에 확인하는 상품 관리 화면입니다.
          </p>
        </div>

        <div className="inline-block rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-6 text-left lg:flex-row lg:items-start">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                브랜드 필터
              </label>
              <div className="min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-primary">
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full cursor-pointer border-none bg-transparent py-2 pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">전체 브랜드</option>
                  {brands.map((brand) => (
                    <option key={brand.brandId} value={brand.brandId}>
                      {brand.brandName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                출고 기준 월
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-5">
        <SummaryCard label="등록 상품 수" value={formatNumber(summary.totalProducts)} />
        <SummaryCard label="총 실재고" value={formatNumber(summary.totalStock)} />
        <SummaryCard label="총 안전재고" value={formatNumber(summary.totalSafeStock)} />
        <SummaryCard label={`${selectedMonth} 월 출고량`} value={formatNumber(summary.totalMonthlyOutbound)} />
        <SummaryCard label="브랜드 수" value={formatNumber(summary.brandCount)} />
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-8 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">브랜드별 재고 및 월 출고량</h2>
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            {selectedMonth} 월 기준 집계
          </div>
        </div>

        {loading ? (
          <div className="px-8 py-16 text-center text-slate-500">재고 및 출고량 데이터를 불러오는 중입니다.</div>
        ) : items.length === 0 ? (
          <div className="px-8 py-16 text-center text-slate-500">표시할 상품이 없습니다.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="min-w-[1080px] w-full table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-[12%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    브랜드
                  </th>
                  <th className="w-[24%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    상품명
                  </th>
                  <th className="w-[16%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    SKU
                  </th>
                  <th className="w-[12%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    PROD NO
                  </th>
                  <th className="w-[10%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    실재고
                  </th>
                  <th className="w-[10%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    안전재고
                  </th>
                  <th className="w-[10%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    {selectedMonth} 월 출고량
                  </th>
                  <th className="w-[18%] px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 lg:px-6 lg:text-xs">
                    마지막 상품 수정일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.productId} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-3 py-4 text-center sm:px-4 lg:px-6">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 sm:px-3 sm:text-sm">
                        {item.brandName}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-semibold text-slate-900 sm:px-4 sm:text-sm lg:px-6">
                      <div className="line-clamp-2 break-keep">{item.productName}</div>
                    </td>
                    <td className="px-3 py-4 text-center font-mono text-[11px] text-slate-500 sm:px-4 sm:text-xs lg:px-6 lg:text-sm">
                      <div className="break-all">{item.skuCd || '-'}</div>
                    </td>
                    <td className="px-3 py-4 text-center font-mono text-[11px] text-slate-500 sm:px-4 sm:text-xs lg:px-6 lg:text-sm">
                      {item.prodNo ?? '-'}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-black text-slate-900 sm:px-4 sm:text-base lg:px-6">
                      {formatNumber(item.realStock)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-black text-slate-900 sm:px-4 sm:text-base lg:px-6">
                      {formatNumber(item.safeStock)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-black text-slate-900 sm:px-4 sm:text-base lg:px-6">
                      {formatNumber(item.monthlyOutboundCount)}
                    </td>
                    <td className="px-3 py-4 text-center text-xs text-slate-500 sm:px-4 sm:text-sm lg:px-6">
                      {formatDateTime(item.mdate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
