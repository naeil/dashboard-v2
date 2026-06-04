import { useEffect, useMemo, useState } from 'react'
import { getExecutiveCustomerDatabase, syncPlayAutoCustomerDatabase } from '../../api/executiveApi'
import { KpiCard, PageHeader, Panel } from './ExecutiveComponents'

const numberValue = (value) => Number(value || 0)
const count = (value, suffix = '') => `${Math.round(numberValue(value)).toLocaleString('ko-KR')}${suffix}`
const won = (value) => `${Math.round(numberValue(value)).toLocaleString('ko-KR')}원`

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const statusClass = {
  '재주문 지연': 'border-rose-200 bg-rose-50 text-rose-700',
  '재주문 임박': 'border-amber-200 bg-amber-50 text-amber-700',
  관찰: 'border-sky-200 bg-sky-50 text-sky-700',
  신규: 'border-slate-200 bg-slate-50 text-slate-600',
}

function StatusBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass[value] || statusClass['관찰']}`}>
      {value || '관찰'}
    </span>
  )
}

export default function CustomerDatabasePage({ role = 'EXECUTIVE' }) {
  const [dashboard, setDashboard] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('attention')

  const canAccess = role === 'EXECUTIVE' || role === 'MANAGER'
  const summary = dashboard.summary || {}
  const rows = dashboard.rows || []

  const load = async () => {
    const response = await getExecutiveCustomerDatabase()
    setDashboard(response.data || { summary: {}, rows: [] })
  }

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!canAccess) {
        setLoading(false)
        return
      }
      try {
        const response = await getExecutiveCustomerDatabase()
        if (active) {
          setDashboard(response.data || { summary: {}, rows: [] })
          setMessage('')
        }
      } catch (error) {
        if (active) setMessage(error?.response?.data?.message || '고객 DB를 불러오지 못했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }
    refresh()
    return () => {
      active = false
    }
  }, [canAccess])

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const searched = normalized
      ? rows.filter((row) => (
        [row.customer_name, row.customer_htel, row.customer_email, row.ordered_products]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      ))
      : rows

    return [...searched].sort((a, b) => {
      if (sortMode === 'amount') return numberValue(b.total_purchase_amount) - numberValue(a.total_purchase_amount)
      if (sortMode === 'orders') return numberValue(b.order_count) - numberValue(a.order_count)
      if (sortMode === 'recent') return new Date(b.last_order_at || 0) - new Date(a.last_order_at || 0)
      const weight = { '재주문 지연': 0, '재주문 임박': 1, 관찰: 2, 신규: 3 }
      return (weight[a.reorder_status] ?? 2) - (weight[b.reorder_status] ?? 2)
    })
  }, [query, rows, sortMode])

  const handleSync = async () => {
    if (!canAccess || syncing) return
    setSyncing(true)
    setMessage('PlayAuto에서 고객 주문 데이터를 수집하는 중입니다.')
    try {
      const response = await syncPlayAutoCustomerDatabase()
      setDashboard(response.data || { summary: {}, rows: [] })
      setMessage(response.data?.message || 'PlayAuto 고객 주문 데이터 수집이 완료되었습니다.')
    } catch (error) {
      setMessage(error?.response?.data?.message || 'PlayAuto 고객 주문 데이터 수집에 실패했습니다. 연동 설정을 확인해주세요.')
      await load().catch(() => {})
    } finally {
      setSyncing(false)
    }
  }

  if (!canAccess) {
    return (
      <Panel title="접근 권한 없음">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">
          고객 정보(DB)는 관리자와 임원만 볼 수 있습니다.
        </div>
      </Panel>
    )
  }

  return (
    <>
      <PageHeader
        title="고객 정보(DB)"
        description="PlayAuto 주문 이력을 고객별로 묶어 재구매 가능성과 재주문 시기를 확인합니다. 관리자 운영 전용 일급비밀 데이터입니다."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="총 고객" value={count(summary.total_customers, '명')} helperText="PlayAuto 주문 고객" icon="contacts" />
        <KpiCard label="재구매 고객" value={count(summary.repeat_customers, '명')} helperText="2회 이상 주문" tone="emerald" icon="repeat" />
        <KpiCard label="재주문 관리" value={count(summary.reorder_attention_count, '명')} helperText="지연 또는 7일 내 도래" tone="amber" icon="notifications_active" />
        <KpiCard label="총 주문" value={count(summary.total_orders, '건')} helperText="고객 DB 연결 주문" icon="receipt_long" />
        <KpiCard label="누적 결제액" value={won(summary.total_purchase_amount)} helperText="취소 금액 차감 기준" tone="sky" icon="payments" />
      </section>

      <Panel
        title="PlayAuto 고객 주문 데이터"
        right={(
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-black text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <span className="material-symbols-outlined text-lg">{syncing ? 'sync' : 'cloud_sync'}</span>
            {syncing ? '수집 중' : 'PlayAuto 고객 데이터 수집'}
          </button>
        )}
      >
        {message && (
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
            {message}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative block w-full max-w-lg">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="고객명, 휴대폰, 주문 상품 검색"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500">정렬</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
            >
              <option value="attention">재주문 관리 우선</option>
              <option value="amount">구매 금액 높은 순</option>
              <option value="orders">주문 횟수 높은 순</option>
              <option value="recent">최근 주문 순</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                {['상태', '고객명', '휴대폰', '주문한 상품', '수량', '재구매 이력', '누적 결제액', '마지막 주문', '재주문 시기'].map((label) => (
                  <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                    고객 DB를 불러오는 중입니다.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                    표시할 고객 주문 데이터가 없습니다. PlayAuto 수집을 먼저 실행해주세요.
                  </td>
                </tr>
              ) : filteredRows.map((row) => (
                <tr key={row.customer_id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3"><StatusBadge value={row.reorder_status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-slate-950">{row.customer_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">{row.customer_htel || '-'}</td>
                  <td className="min-w-[360px] px-4 py-3 text-sm font-bold text-slate-700">{row.ordered_products || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-sky-700">{count(row.total_quantity, '건')}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">
                    {count(row.order_count, '회')}
                    {numberValue(row.avg_reorder_days) > 0 && (
                      <span className="ml-2 text-xs text-slate-400">평균 {row.avg_reorder_days}일</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-black text-slate-950">{won(row.total_purchase_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">{formatDate(row.last_order_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">{formatDate(row.estimated_reorder_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
