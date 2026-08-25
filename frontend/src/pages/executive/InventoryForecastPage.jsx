import { useEffect, useRef, useState } from 'react'
import { getInventoryForecast } from '../../api/inventoryApi'

const count = (v) => Number(v || 0).toLocaleString('ko-KR')
const num1 = (v) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 })

const STATUS_META = {
  OUT: { label: '품절', badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' },
  URGENT: { label: '7일 내 소진', badge: 'bg-rose-50 text-rose-500', dot: 'bg-rose-500' },
  WARN: { label: '21일 내 소진', badge: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400' },
  OK: { label: '정상', badge: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  STALE: { label: '출고 없음', badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
}

const FILTERS = [
  { key: '', label: '전체' },
  { key: 'OUT', label: '품절' },
  { key: 'URGENT', label: '긴급' },
  { key: 'WARN', label: '주의' },
  { key: 'OK', label: '정상' },
  { key: 'STALE', label: '출고 없음' },
]

function depleteDate(daysLeft) {
  if (daysLeft == null) return null
  const d = new Date()
  d.setDate(d.getDate() + Number(daysLeft))
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function SummaryCard({ label, value, tone, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${active ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
    </button>
  )
}

export default function InventoryForecastPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [data, setData] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setLoading(true)
      getInventoryForecast(search ? { search } : {})
        .then((res) => setData(res || { summary: {}, rows: [] }))
        .catch(() => setData({ summary: {}, rows: [] }))
        .finally(() => setLoading(false))
    }, search ? 300 : 0)
    return () => clearTimeout(timer.current)
  }, [search])

  const summary = data.summary || {}
  const rows = (data.rows || []).filter((r) => !statusFilter || r.status === statusFilter)

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">재고 예측</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            현재고 ÷ 일평균 출고 속도(최근 7일·30일 중 빠른 쪽) = 소진 예상일 · 30분마다 자동 갱신
          </p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제품명 검색"
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="품절 (출고 중인데 재고 0)" value={count(summary.outOfStock)} tone="text-rose-600"
          active={statusFilter === 'OUT'} onClick={() => setStatusFilter(statusFilter === 'OUT' ? '' : 'OUT')} />
        <SummaryCard label="7일 내 소진 예상" value={count(summary.urgent)} tone="text-rose-500"
          active={statusFilter === 'URGENT'} onClick={() => setStatusFilter(statusFilter === 'URGENT' ? '' : 'URGENT')} />
        <SummaryCard label="21일 내 소진 예상" value={count(summary.warning)} tone="text-amber-600"
          active={statusFilter === 'WARN'} onClick={() => setStatusFilter(statusFilter === 'WARN' ? '' : 'WARN')} />
        <SummaryCard label="정상" value={count(summary.ok)} tone="text-emerald-600"
          active={statusFilter === 'OK'} onClick={() => setStatusFilter(statusFilter === 'OK' ? '' : 'OK')} />
        <SummaryCard label="최근 출고 없음" value={count(summary.stale)} tone="text-slate-500"
          active={statusFilter === 'STALE'} onClick={() => setStatusFilter(statusFilter === 'STALE' ? '' : 'STALE')} />
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="px-3 py-2.5 text-left">제품</th>
                <th className="px-3 py-2.5 text-left">브랜드</th>
                <th className="px-3 py-2.5 text-right">현재고</th>
                <th className="px-3 py-2.5 text-right">7일 출고</th>
                <th className="px-3 py-2.5 text-right">30일 출고</th>
                <th className="px-3 py-2.5 text-right">일평균 소진</th>
                <th className="px-3 py-2.5 text-right">소진 예상</th>
                <th className="px-3 py-2.5 text-left">최근 입고</th>
                <th className="px-3 py-2.5 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = STATUS_META[row.status] || STATUS_META.STALE
                const daysLeft = row.days_left == null ? null : Number(row.days_left)
                return (
                  <tr key={row.product_id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                    <td className="max-w-[380px] truncate px-3 py-2 text-[13px] font-bold text-slate-800">{row.product_name}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">{row.brand_name || '-'}</td>
                    <td className={`px-3 py-2 text-right text-[13px] font-black ${Number(row.real_stock) <= 0 ? 'text-rose-500' : 'text-slate-900'}`}>{count(row.real_stock)}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-slate-600">{count(row.out_7d)}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-slate-600">{count(row.out_30d)}</td>
                    <td className="px-3 py-2 text-right text-[13px] font-bold text-slate-700">{Number(row.daily_burn) > 0 ? num1(row.daily_burn) + '/일' : '-'}</td>
                    <td className="px-3 py-2 text-right">
                      {daysLeft != null ? (
                        <span className={`text-[13px] font-black ${daysLeft <= 7 ? 'text-rose-500' : daysLeft <= 21 ? 'text-amber-600' : 'text-slate-800'}`}>
                          D-{count(daysLeft)} <span className="text-[11px] font-bold text-slate-400">({depleteDate(daysLeft)})</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">
                      {row.last_in_date ? String(row.last_in_date).slice(5, 10).replace('-', '.') : '-'}
                      {Number(row.in_30d) > 0 && <span className="ml-1 text-emerald-600">+{count(row.in_30d)}</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-black ${meta.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan="9" className="py-12 text-center text-sm text-slate-400">조건에 맞는 제품이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        · 출고 속도는 PlayAuto 수집분 + 정산시트 출고 기록을 합산한 일평균입니다. 재고 수량은 PlayAuto 실재고 기준.
      </p>
    </div>
  )
}
