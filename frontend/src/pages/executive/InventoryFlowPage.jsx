import { useEffect, useMemo, useRef, useState } from 'react'
import { getInventoryFlow } from '../../api/inventoryApi'

const count = (v) => Number(v || 0).toLocaleString('ko-KR')
const shortDate = (v) => {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v || '')
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const PERIODS = [
  { key: 7, label: '최근 7일' },
  { key: 30, label: '최근 30일' },
  { key: 90, label: '최근 90일' },
]

function SummaryCard({ icon, label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="material-symbols-outlined text-[20px] text-blue-500">{icon}</span>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
    </div>
  )
}

export default function InventoryFlowPage() {
  const [days, setDays] = useState(30)
  const [search, setSearch] = useState('')
  const [data, setData] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setLoading(true)
      getInventoryFlow({ days, ...(search ? { search } : {}) })
        .then((res) => setData(res || { summary: {}, rows: [] }))
        .catch(() => setData({ summary: {}, rows: [] }))
        .finally(() => setLoading(false))
    }, search ? 300 : 0)
    return () => clearTimeout(timer.current)
  }, [days, search])

  const rows = data.rows || []
  const summary = data.summary || {}
  const netChange = Number(summary.total_in || 0) - Number(summary.total_out || 0)

  const byDate = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      const key = String(row.flow_date).slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    })
    return [...map.entries()]
  }, [rows])

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">입출고 관리</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            출고(PlayAuto·정산시트) + 입고(정산시트) 일별 이력 · 30분마다 자동 동기화
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setDays(p.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-black ${days === p.key ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제품명 검색"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard icon="input" label={`기간 총 입고`} value={count(summary.total_in)} tone="text-emerald-600" />
        <SummaryCard icon="output" label={`기간 총 출고`} value={count(summary.total_out)} tone="text-blue-600" />
        <SummaryCard icon="swap_vert" label="순증감 (입고 − 출고)" value={(netChange >= 0 ? '+' : '') + count(netChange)}
          tone={netChange >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
        <SummaryCard icon="inventory_2" label="출고 발생 제품 수" value={count(summary.active_products)} />
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : !byDate.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center text-sm text-slate-400">
          선택 기간에 입출고 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {byDate.map(([date, dayRows]) => {
            const dayIn = dayRows.reduce((s, r) => s + Number(r.in_count || 0), 0)
            const dayOut = dayRows.reduce((s, r) => s + Number(r.out_count || 0), 0)
            return (
              <div key={date} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
                  <p className="text-[13px] font-black text-slate-800">{date} <span className="text-slate-400">({shortDate(date)})</span></p>
                  <p className="text-[12px] font-bold">
                    {dayIn > 0 && <span className="mr-3 text-emerald-600">입고 +{count(dayIn)}</span>}
                    {dayOut > 0 && <span className="text-blue-600">출고 −{count(dayOut)}</span>}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                        <th className="px-3 py-1.5 text-left">제품</th>
                        <th className="px-3 py-1.5 text-left">브랜드</th>
                        <th className="px-3 py-1.5 text-right">입고</th>
                        <th className="px-3 py-1.5 text-right">출고</th>
                        <th className="px-3 py-1.5 text-left">창고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((row, idx) => (
                        <tr key={`${row.product_id}-${idx}`} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                          <td className="max-w-[420px] truncate px-3 py-1.5 text-[13px] font-bold text-slate-800">{row.product_name}</td>
                          <td className="px-3 py-1.5 text-[12px] text-slate-500">{row.brand_name || '-'}</td>
                          <td className="px-3 py-1.5 text-right text-[13px] font-black text-emerald-600">{Number(row.in_count) > 0 ? '+' + count(row.in_count) : ''}</td>
                          <td className="px-3 py-1.5 text-right text-[13px] font-black text-blue-600">{Number(row.out_count) > 0 ? '−' + count(row.out_count) : ''}</td>
                          <td className="px-3 py-1.5 text-[12px] text-slate-400">{row.warehouse || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
