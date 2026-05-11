import { useState, useEffect, useCallback } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import {
  getSummary, getProductSales, getShopSales
} from '../api/salesApi'

const KW = (n) => '₩' + Math.round(Number(n ?? 0)).toLocaleString('ko-KR')

export default function Dashboard({ isExpanded }) {
  const today = new Date()
  const [companyId] = useState(1)
  const [startDate, setStartDate] = useState(startOfMonth(today))
  const [endDate, setEndDate] = useState(endOfMonth(today))

  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, productRes, shopRes] = await Promise.all([
        getSummary(companyId, startDate, endDate),
        getProductSales(companyId, startDate, endDate),
        getShopSales(companyId, startDate, endDate),
      ])
      setSummary(sumRes.data)
      setProducts(productRes.data)
      setShops(shopRes.data)
    } catch (err) {
      console.error('API error:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId, startDate, endDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fmt = (d) => d.toISOString().slice(0, 10)

  return (
    <>
      <main className={`p-8 min-h-screen transition-all duration-300 ${isExpanded ? 'ml-64' : 'ml-20'}`}>
        <section className="grid grid-cols-12 gap-6 mb-10">
          <div className="col-span-12">
            <h1 className="text-3xl font-black tracking-tight text-primary mb-2">Overview</h1>
            <p className="text-on-surface-variant text-sm">오늘의 주요 성과 지표입니다.</p>
          </div>

          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="tonal-gradient rounded-xl p-8 text-white shadow-lg flex flex-col justify-center min-h-[220px]">
              <div className="mb-4">
                <span className="text-xs font-bold text-on-primary-container tracking-widest uppercase">총 합계 매출</span>
                <h3 className="text-5xl font-black mt-4 tracking-tighter leading-tight">
                  {summary ? KW(summary.totalGrossAmount) : '₩0'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded text-xs font-bold">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  <span>12.5%</span>
                </div>
                <span className="text-xs font-medium text-on-primary-container">전월 대비 추정치</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border-none flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-primary-fixed rounded-lg text-primary">
                    <span className="material-symbols-outlined text-lg">payments</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-on-surface-variant">순 매출 (Net Revenue)</p>
                  <h4 className="text-lg font-bold text-on-surface">{summary ? KW(summary.totalNetRevenue) : '₩0'}</h4>
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border-none flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-error-container rounded-lg text-error">
                    <span className="material-symbols-outlined text-lg">percent</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-on-surface-variant">할인 총액 (Discount)</p>
                  <h4 className="text-lg font-bold text-on-surface">{summary ? KW(summary.totalDiscountAmount) : '₩0'}</h4>
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border-none flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
                    <span className="material-symbols-outlined text-lg">cancel</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-on-surface-variant">주문 취소 (Cancellation)</p>
                  <h4 className="text-lg font-bold text-on-surface">{summary ? KW(summary.totalCancelAmount || 0) : '₩0'}</h4>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl p-6 shadow-sm border-none flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <span className="material-symbols-outlined">inventory</span>
                </div>
                <p className="text-xs font-bold text-on-surface">현재 판매 상품 현황</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto inventory-scroll pr-1">
              <div className="space-y-4">
                {products && products.slice(0,10).map((p, i) => (
                   <div key={p.productId || i} className="flex justify-between items-center group">
                      <span className="text-xs font-medium text-on-surface-variant group-hover:text-on-surface transition-colors truncate w-3/4">{p.productName}</span>
                      <span className="text-xs font-bold text-on-surface">{KW(p.totalNetRevenue)}</span>
                   </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-6 mb-10">
          <section className="col-span-12 lg:col-span-8">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border-none h-full">
              <div className="p-6 flex justify-between items-center bg-surface-container-low/30 border-b border-surface-container-low">
                <h3 className="font-bold text-lg tracking-tight">제품별 총 매출 (Product Performance)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low/20">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">제품명 / PlayAuto ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">총 매출</th>
                      <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">할인</th>
                      <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">순 매출</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {products && products.slice(0,5).map(p => (
                       <tr key={p.productId} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-on-surface">{p.productName}</span>
                            <span className="text-xs text-on-surface-variant">{p.externalProductId || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-medium text-on-surface text-right">{KW(p.totalGrossAmount)}</td>
                        <td className="px-6 py-5 text-sm font-medium text-error text-right">-{KW(p.totalDiscountAmount)}</td>
                        <td className="px-6 py-5 text-sm font-bold text-primary text-right">{KW(p.totalNetRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl p-6 shadow-sm border-none flex flex-col">
             <h3 className="font-bold text-lg tracking-tight mb-6">마켓플레이스별 실적</h3>
             <div className="space-y-6">
                {shops && shops.slice(0,3).map((s, i) => {
                  const colors = [
                    { bg: "bg-blue-600", fill: "bg-blue-600", w: "85%" },
                    { bg: "bg-green-600", fill: "bg-green-600", w: "60%" },
                    { bg: "bg-amber-500", fill: "bg-amber-500", w: "45%" }
                  ];
                  const c = colors[i % colors.length];
                  return (
                    <div key={s.shopId} className="bg-surface-container-low/50 p-5 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center text-white text-[10px] font-bold uppercase`}>
                            {(s.shopCode || 'NA').slice(0, 4)}
                          </div>
                          <span className="text-sm font-bold">{s.shopName}</span>
                        </div>
                        <span className="text-sm font-extrabold">{KW(s.totalNetRevenue)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className={`h-full ${c.fill}`} style={{ width: c.w }}></div>
                      </div>
                    </div>
                  )
                })}
             </div>
          </section>
        </div>
      </main>
    </>
  )
}
