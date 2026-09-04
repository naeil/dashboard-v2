import { useCallback, useEffect, useState } from 'react'
import { getCashPosition, approvePaymentRequest, importOnlineSettlements } from '../../api/executiveApi'
import { PageHeader, KpiCard, Panel } from './ExecutiveComponents'
import { won } from './formatters'

/* ── 유틸 ── */
const num = (v) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0 }
const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}
const dayLabel = (v) => (v ? String(v).slice(5, 10).replace('-', '/') : '-')

/* 지출 상태 라벨 (현금흐름 status + 결의 status) */
function expenseStatus(row) {
  const rs = row.request_status
  const cs = row.status
  if (cs === 'DONE') return { label: '지급 완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (rs === 'CASH_APPLIED' || row.request_id) return { label: '승인·반영', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
  if (cs === 'SCHEDULED') return { label: '지급 예정', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: cs || '예정', cls: 'bg-slate-50 text-slate-600 border-slate-200' }
}
function depositStatus(row) {
  const confirmed = row.confidence_level === 'CONFIRMED' || row.status === 'DONE'
  if (row.status === 'DONE') return { label: '입금 완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (confirmed) return { label: '입금 확정', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
  return { label: '입금 예정', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
}
/* 입금 구분 (source_type / category) */
function depositSource(row) {
  const s = row.source_type
  if (s === 'ONLINE_SETTLEMENT' || (row.category || '').includes('온라인')) return '온라인 정산'
  if (s === 'PAYMENT_REQUEST') return '입금결의'
  if ((row.category || '').includes('컨설팅')) return '컨설팅'
  return row.category || '기타'
}

function Badge({ label, cls }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${cls}`}>{label}</span>
}

export default function CashPositionPage() {
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback((m) => {
    setLoading(true)
    getCashPosition(m)
      .then((res) => setData(res.data))
      .catch(() => setMessage('자금 현황을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(month) }, [load, month])

  const approve = async (id) => {
    setBusy(`approve-${id}`)
    setMessage('')
    try {
      await approvePaymentRequest(id)
      setMessage('결의를 승인했습니다. 현금흐름(지출)에 반영되었습니다.')
      load(month)
    } catch (e) {
      setMessage(e?.response?.data?.message || '승인에 실패했습니다.')
    } finally {
      setBusy('')
    }
  }

  const importSettlements = async () => {
    setBusy('import')
    setMessage('')
    try {
      const [y, m] = month.split('-').map(Number)
      const start = `${month}-01`
      const end = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`
      await importOnlineSettlements({ startDate: start, endDate: end })
      setMessage('온라인 정산 입금을 불러왔습니다.')
      load(month)
    } catch (e) {
      setMessage(e?.response?.data?.message || '정산 불러오기에 실패했습니다.')
    } finally {
      setBusy('')
    }
  }

  const s = data?.summary || {}
  const expenses = data?.expenses || []
  const deposits = data?.deposits || []
  const pending = data?.pendingApprovals || []
  const net = num(s.net)

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="자금 현황 (한눈에)"
        description="이번 달 나간 돈과 들어온 돈을 한 화면에서 — 지출결의 승인부터 입금까지 대시보드 하나로 관리합니다."
      />

      {/* 월 이동 + 액션 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}
              className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-2 text-sm font-black text-slate-800">{monthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}
              className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          <button type="button" onClick={() => setMonth(thisMonth())}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50">
            이번 달
          </button>
        </div>
        <button type="button" onClick={importSettlements} disabled={busy === 'import'}
          className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-black text-sky-700 hover:bg-sky-100 disabled:opacity-50">
          <span className="material-symbols-outlined text-[18px]">sync</span>
          {busy === 'import' ? '불러오는 중…' : '온라인 정산 입금 불러오기'}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold text-slate-600">{message}</div>
      )}

      {/* 요약 3종 */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="들어온 돈 (입금)" tone="emerald" icon="south_west"
          value={won(s.inflow)} change={0}
          helperText={`확정 ${won(s.confirmedInflow)} · 예정 포함`} />
        <KpiCard label="나간 돈 (지출)" tone="rose" icon="north_east"
          value={won(s.outflow)} change={0}
          helperText={`확정 ${won(s.confirmedOutflow)} · 예정 포함`} />
        <KpiCard label="순현금 (들어온 − 나간)" tone={net >= 0 ? 'sky' : 'rose'} icon="account_balance"
          value={won(net)} change={net}
          valueClassName={net >= 0 ? 'text-slate-950' : 'text-rose-600'}
          helperText={net >= 0 ? '이번 달 순유입' : '이번 달 순유출 — 주의'} />
      </div>

      {/* 승인 대기 결의 */}
      {pending.length > 0 && (
        <div className="mb-5">
          <Panel title={`승인 대기 지출결의 ${pending.length}건 · 합계 ${won(s.pendingApprovalAmount)}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-2 py-2 text-left">예정일</th>
                    <th className="px-2 py-2 text-left">내용</th>
                    <th className="px-2 py-2 text-left">거래처</th>
                    <th className="px-2 py-2 text-left">기안자</th>
                    <th className="px-2 py-2 text-right">금액</th>
                    <th className="px-2 py-2 text-center">증빙</th>
                    <th className="px-2 py-2 text-center">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.request_id} className="border-b border-slate-50 last:border-0">
                      <td className="px-2 py-2.5 text-[13px] text-slate-500">
                        {dayLabel(r.flow_date)}
                        {r.urgent && <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] font-black text-rose-600">긴급</span>}
                      </td>
                      <td className="px-2 py-2.5 text-[13px] font-bold text-slate-800">{r.purpose || r.category}</td>
                      <td className="px-2 py-2.5 text-[13px] text-slate-600">{r.counterparty || '-'}</td>
                      <td className="px-2 py-2.5 text-[13px] text-slate-500">{r.requester_name || '-'}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] font-black text-rose-600">{won(r.amount)}</td>
                      <td className="px-2 py-2.5 text-center">
                        {r.evidence_url
                          ? <a href={r.evidence_url} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-sky-600 hover:underline">보기</a>
                          : <span className="text-[12px] text-slate-300">-</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button type="button" onClick={() => approve(r.request_id)} disabled={busy === `approve-${r.request_id}`}
                          className="rounded-lg bg-sky-500 px-3 py-1 text-[12px] font-black text-white hover:bg-sky-600 disabled:opacity-50">
                          {busy === `approve-${r.request_id}` ? '처리 중…' : '승인'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* 지출 / 입금 2단 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 지출 */}
        <Panel title={`지출 · 나가는 돈 (${expenses.length})`}>
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : expenses.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">이 달에 나간 돈 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-2 py-2 text-left">일자</th>
                    <th className="px-2 py-2 text-left">내용</th>
                    <th className="px-2 py-2 text-left">거래처</th>
                    <th className="px-2 py-2 text-right">금액</th>
                    <th className="px-2 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((r) => {
                    const st = expenseStatus(r)
                    return (
                      <tr key={`e-${r.id}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-2 py-2.5 text-[13px] text-slate-500">{dayLabel(r.flow_date)}</td>
                        <td className="px-2 py-2.5 text-[13px] font-bold text-slate-800">{r.purpose || r.category}</td>
                        <td className="px-2 py-2.5 text-[13px] text-slate-600">{r.counterparty || '-'}</td>
                        <td className="px-2 py-2.5 text-right text-[13px] font-black text-rose-600">{won(r.amount)}</td>
                        <td className="px-2 py-2.5 text-center"><Badge {...st} /></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-100">
                    <td colSpan={3} className="px-2 py-2.5 text-[12px] font-black text-slate-400">지출 합계</td>
                    <td className="px-2 py-2.5 text-right text-[14px] font-black text-rose-600">{won(s.outflow)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>

        {/* 입금 */}
        <Panel title={`입금 · 들어오는 돈 (${deposits.length})`}>
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : deposits.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              이 달에 들어온 돈 내역이 없습니다. 위의 [온라인 정산 입금 불러오기]로 채워보세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-2 py-2 text-left">일자</th>
                    <th className="px-2 py-2 text-left">구분</th>
                    <th className="px-2 py-2 text-left">거래처</th>
                    <th className="px-2 py-2 text-right">금액</th>
                    <th className="px-2 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((r) => {
                    const st = depositStatus(r)
                    return (
                      <tr key={`d-${r.id}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-2 py-2.5 text-[13px] text-slate-500">{dayLabel(r.flow_date)}</td>
                        <td className="px-2 py-2.5 text-[13px] font-bold text-slate-700">{depositSource(r)}</td>
                        <td className="px-2 py-2.5 text-[13px] text-slate-600">{r.counterparty || '-'}</td>
                        <td className="px-2 py-2.5 text-right text-[13px] font-black text-emerald-600">{won(r.amount)}</td>
                        <td className="px-2 py-2.5 text-center"><Badge {...st} /></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-100">
                    <td colSpan={3} className="px-2 py-2.5 text-[12px] font-black text-slate-400">입금 합계</td>
                    <td className="px-2 py-2.5 text-right text-[14px] font-black text-emerald-600">{won(s.inflow)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
