import { useEffect, useMemo, useState } from 'react'
import { getStaffAdminAttendance } from '../../api/staffApi'

const monthText = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

function localDate(value) {
  return String(value || '').slice(0, 10)
}

function timeText(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function statusBadge(row) {
  if (row.clock_out_at) return ['퇴근 완료', 'bg-emerald-100 text-emerald-700']
  if (row.clock_in_at) return ['근무중', 'bg-sky-100 text-sky-700']
  return ['기록 없음', 'bg-slate-100 text-slate-600']
}

function deviceBadge(device) {
  if (device === 'MO') return ['MO', 'bg-violet-100 text-violet-700']
  if (device === 'PC') return ['PC', 'bg-sky-100 text-sky-700']
  return ['-', 'bg-slate-100 text-slate-500']
}

export default function AttendanceAdminPage() {
  const [month, setMonth] = useState(monthText())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    return getStaffAdminAttendance({ month: `${month}-01` })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('출퇴근 기록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [month])

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => [
      row.username,
      row.display_name,
      row.clock_in_ip,
      row.clock_out_ip,
      row.clock_in_ip_location,
      row.clock_out_ip_location,
      row.clock_in_device,
      row.clock_out_device,
      row.work_date,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }, [rows, query])

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">System Audit</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">직원 출퇴근 기록</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              대표 관리자 전용 화면입니다. 출근/퇴근 시간, 접속 IP, IP 기반 위치를 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700">
              <span className="material-symbols-outlined text-base text-sky-600">calendar_month</span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="bg-transparent text-sm font-black text-slate-800 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
              새로고침
            </button>
          </div>
        </div>
        {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">월별 출퇴근 로그</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">IP 위치는 공인 IP 기준으로 조회되며, 사내망 IP는 사내/로컬 네트워크로 표시됩니다.</p>
          </div>
          <label className="relative block w-full max-w-md">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="직원명, 아이디, IP, 위치 검색"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                {['일자', '직원', '상태', '출근', '출근기기', '출근 IP / 위치', '퇴근', '퇴근기기', '퇴근 IP / 위치'].map((header) => (
                  <th key={header} className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const [label, cls] = statusBadge(row)
                const [clockInDevice, clockInDeviceCls] = deviceBadge(row.clock_in_device)
                const [clockOutDevice, clockOutDeviceCls] = deviceBadge(row.clock_out_device)
                return (
                  <tr key={row.id} className="hover:bg-sky-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">{localDate(row.work_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-sm font-black text-slate-900">{row.display_name || row.username}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-400">{row.username}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${cls}`}>{label}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">{timeText(row.clock_in_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${clockInDeviceCls}`}>{clockInDevice}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">
                      <p>{row.clock_in_ip || '-'}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{row.clock_in_ip_location || '-'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">{timeText(row.clock_out_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${clockOutDeviceCls}`}>{clockOutDevice}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">
                      <p>{row.clock_out_ip || '-'}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{row.clock_out_ip_location || '-'}</p>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                    표시할 출퇴근 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
