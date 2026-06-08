import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProductSales, getShopSales, getSummary } from '../../api/salesApi'
import { getStaffAttendance } from '../../api/staffApi'
import MailWidget from '../executive/MailWidget'

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function won(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`
}

function count(value, unit = '건') {
  return `${Number(value || 0).toLocaleString('ko-KR')}${unit}`
}

function progressColor(rate) {
  if (rate >= 80) return 'bg-green-500'
  if (rate >= 50) return 'bg-blue-500'
  if (rate >= 30) return 'bg-yellow-400'
  return 'bg-red-400'
}

function statusLabel(status) {
  return { IN_PROGRESS: '진행중', DELAYED: '지연', DONE: '완료' }[status] || status
}

function statusBadge(status) {
  return {
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    DELAYED: 'bg-red-100 text-red-700',
    DONE: 'bg-green-100 text-green-700',
  }[status] || 'bg-slate-100 text-slate-600'
}

function dateKey(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function localDateText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function timeLabel(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const staffTasks = [
  { id: 1, title: '오늘 매출 현황 확인', owner: '채널 운영', progress: 85, status: 'IN_PROGRESS' },
  { id: 2, title: '제품 원가 수정 요청 검토', owner: '상품 관리', progress: 55, status: 'IN_PROGRESS' },
  { id: 3, title: '다우오피스 메일 회신', owner: '업무 지원', progress: 25, status: 'DELAYED' },
]

export default function StaffDashboardPage({ isExpanded = false, mobile = false }) {
  const today = useMemo(() => new Date(), [])
  const [companyId] = useState(1)
  const [startDate] = useState(startOfMonth(today))
  const [endDate] = useState(endOfMonth(today))
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [shops, setShops] = useState([])
  const [attendanceRows, setAttendanceRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, productRes, shopRes, attendanceRes] = await Promise.all([
        getSummary(companyId, startDate, endDate),
        getProductSales(companyId, startDate, endDate),
        getShopSales(companyId, startDate, endDate),
        getStaffAttendance({ month: localDateText(startDate) }),
      ])
      setSummary(summaryRes.data || {})
      setProducts(Array.isArray(productRes.data) ? productRes.data : [])
      setShops(Array.isArray(shopRes.data) ? shopRes.data : [])
      setAttendanceRows(Array.isArray(attendanceRes.data) ? attendanceRes.data : [])
    } catch (err) {
      console.error('Staff dashboard API error:', err)
      setError('대시보드 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [companyId, startDate, endDate])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const topProductRevenue = products.reduce((sum, item) => sum + Number(item.totalNetRevenue || 0), 0)
  const topShopRevenue = shops.reduce((sum, item) => sum + Number(item.totalNetRevenue || 0), 0)
  const attendanceByDate = useMemo(() => {
    const map = new Map()
    attendanceRows.forEach((row) => map.set(dateKey(row.work_date), row))
    return map
  }, [attendanceRows])
  const calendarDays = useMemo(() => {
    const firstOffset = startDate.getDay()
    const days = []
    for (let i = 0; i < firstOffset; i += 1) days.push(null)
    for (let day = 1; day <= endDate.getDate(); day += 1) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), day)
      const key = localDateText(d)
      days.push({ day, key, record: attendanceByDate.get(key) })
    }
    return days
  }, [startDate, endDate, attendanceByDate])

  return (
    <main className={`min-h-screen bg-slate-50 transition-all duration-300 ${mobile ? 'p-0' : `p-6 ${isExpanded ? 'ml-64' : 'ml-20'}`}`}>
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black text-slate-500">
              {startDate.toISOString().slice(0, 10)} ~ {endDate.toISOString().slice(0, 10)}
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">직원 업무 대시보드</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">오늘 처리할 업무, 매출 흐름, 다우오피스 메일을 한 화면에서 확인합니다.</p>
          </div>
          <button
            type="button"
            onClick={fetchAll}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
            새로고침
          </button>
        </div>
        {error && <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">{error}</p>}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">총 매출</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{summary ? won(summary.totalGrossAmount) : '-'}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">월 기준 집계</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">순매출</p>
          <p className="mt-3 text-2xl font-black text-blue-700">{summary ? won(summary.totalNetRevenue) : '-'}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">할인/취소 반영</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">판매 상품</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(products.length, '개')}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{won(topProductRevenue)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">판매 채널</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(shops.length, '개')}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{won(topShopRevenue)}</p>
        </article>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">출퇴근 달력</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              업무 홈에서 찍은 출근/퇴근 시간이 월별로 저장됩니다.
            </p>
          </div>
          <p className="text-sm font-black text-slate-700">
            {startDate.getFullYear()}년 {startDate.getMonth() + 1}월
          </p>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-sm">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <div key={day} className="bg-slate-50 px-3 py-2 text-center text-xs font-black text-slate-500">
              {day}
            </div>
          ))}
          {calendarDays.map((item, index) => {
            if (!item) {
              return <div key={`empty-${index}`} className="min-h-[98px] border-t border-slate-100 bg-slate-50/50" />
            }
            const done = Boolean(item.record?.clock_out_at)
            const started = Boolean(item.record?.clock_in_at)
            return (
              <div key={item.key} className="min-h-[98px] border-t border-slate-100 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">{item.day}</span>
                  {started && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                      {done ? '완료' : '근무중'}
                    </span>
                  )}
                </div>
                {started ? (
                  <div className="mt-3 space-y-1 text-[11px] font-bold text-slate-600">
                    <p>출근 {timeLabel(item.record.clock_in_at)}</p>
                    <p>퇴근 {timeLabel(item.record.clock_out_at)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] font-bold text-slate-300">기록 없음</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-black text-slate-950">상품별 매출</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-black text-slate-500">제품명 / PlayAuto ID</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500">총 매출</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500">할인</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500">순매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.slice(0, 8).map((product, index) => (
                  <tr key={product.productId || `${product.productName}-${index}`} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="max-w-[420px] truncate text-sm font-black text-slate-800">{product.productName || '제품명 미등록'}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{product.externalProductId || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-700">{won(product.totalGrossAmount)}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-rose-600">-{won(product.totalDiscountAmount)}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-blue-700">{won(product.totalNetRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">마켓별 실적</h2>
          <div className="mt-5 space-y-4">
            {shops.slice(0, 5).map((shop, index) => {
              const rate = topShopRevenue ? Math.round((Number(shop.totalNetRevenue || 0) / topShopRevenue) * 100) : 0
              return (
                <article key={shop.shopId || `${shop.shopName}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{shop.shopName || shop.shopCode || '채널명 미등록'}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{shop.shopCode || '-'}</p>
                    </div>
                    <p className="text-sm font-black text-slate-950">{won(shop.totalNetRevenue)}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${progressColor(rate)}`} style={{ width: `${Math.max(4, Math.min(100, rate))}%` }} />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">내 업무 진행</h2>
          <div className="mt-5 space-y-3">
            {staffTasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{task.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{task.owner}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusBadge(task.status)}`}>{statusLabel(task.status)}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${progressColor(task.progress)}`} style={{ width: `${task.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <MailWidget />
      </section>
    </main>
  )
}
