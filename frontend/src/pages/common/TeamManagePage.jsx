import { useCallback, useEffect, useState } from 'react'
import { authApi as api } from '../../api/authApi'
import { getStaffWorkReports } from '../../api/staffApi'

const DOW_LABEL = ['월', '화', '수', '목', '금']

const fmtDate = (v) => String(v || '').slice(0, 10)
const fmtDateTime = (v) => {
  if (!v) return ''
  try { return new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return String(v) }
}
const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/* ─────────────── 보고 카드 + 코멘트 ─────────────── */

function ReportItem({ report, onClose }) {
  const [comments, setComments] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const loadComments = useCallback(() => {
    api.get(`/team/reports/${report.id}/comments`).then((res) => setComments(res.data || [])).catch(() => setComments([]))
  }, [report.id])
  useEffect(() => { loadComments() }, [loadComments])

  const send = async () => {
    if (!input.trim() || busy) return
    setBusy(true)
    try {
      const res = await api.post(`/team/reports/${report.id}/comments`, { content: input.trim() })
      if (res.data?.success) { setInput(''); loadComments() }
      else window.alert(res.data?.message || '코멘트 등록 실패')
    } catch (e) {
      window.alert(e?.response?.data?.message || '코멘트 등록 실패')
    } finally {
      setBusy(false)
    }
  }

  const removeComment = async (id) => {
    try {
      const res = await api.delete(`/team/comments/${id}`)
      if (!res.data?.success) window.alert(res.data?.message || '삭제 실패')
      loadComments()
    } catch { loadComments() }
  }

  const section = (label, value) => value ? (
    <div className="mt-1.5">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className="whitespace-pre-wrap text-[13px] leading-5 text-slate-700">{value}</p>
    </div>
  ) : null

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-black text-slate-800">[{fmtDate(report.report_date)}] {report.title}</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      {section('완료 · 진행', report.completed_work)}
      {section('다음 액션', report.planned_work)}
      {section('막힌 이슈', report.blockers)}

      <div className="mt-3 border-t border-slate-200 pt-2">
        <p className="text-[11px] font-black text-slate-500">피드백 {comments.length > 0 && `(${comments.length})`}</p>
        <div className="mt-1.5 space-y-1.5">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-sky-600">{c.author_name || c.author_username}
                  <span className="ml-1.5 font-bold text-slate-300">{fmtDateTime(c.created_at)}</span></p>
                <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-slate-700">{c.content}</p>
              </div>
              <button type="button" onClick={() => removeComment(c.id)} className="shrink-0 text-slate-300 hover:text-rose-400">
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
            placeholder="피드백 남기기 — 팀원에게 바로 보입니다"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none" />
          <button type="button" onClick={send} disabled={busy || !input.trim()}
            className="h-9 shrink-0 rounded-lg bg-sky-500 px-3 text-[12px] font-black text-white hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400">
            등록
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── 팀원 카드 ─────────────── */

function MemberCard({ member, weekStart, reports }) {
  const [openReportId, setOpenReportId] = useState(null)
  const myReports = reports.filter((r) => String(r.username || '').toLowerCase() === String(member.username).toLowerCase()).slice(0, 5)
  const delayed = Number(member.delayedTasks || 0)

  return (
    <div className={`rounded-xl border bg-white p-4 ${member.todaySubmitted ? 'border-slate-200' : 'border-amber-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
            {String(member.display_name || '?').slice(0, 1)}
          </span>
          <div>
            <p className="text-[14px] font-black text-slate-900">
              {member.display_name}
              {member.role === 'MANAGER' && <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-600">팀장</span>}
              {member.isSelf && <span className="ml-1.5 text-[10px] font-bold text-slate-400">(나)</span>}
            </p>
            <p className="text-[11px] font-bold text-slate-400">{member.department}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-slate-400">진행중 {member.openTasks}건</p>
          {delayed > 0
            ? <p className="text-[11px] font-black text-rose-500">지연 {delayed}건</p>
            : <p className="text-[11px] font-bold text-emerald-500">지연 없음</p>}
        </div>
      </div>

      {/* 이번 주 제출 도트 (월~금) */}
      <div className="mt-3 flex items-center gap-1.5">
        {DOW_LABEL.map((label, i) => {
          const date = addDays(weekStart, i)
          const done = (member.weekDates || []).includes(date)
          const today = new Date().toISOString().slice(0, 10) === date
          const future = date > new Date().toISOString().slice(0, 10)
          return (
            <div key={label} title={`${date} ${done ? '제출' : future ? '' : '미제출'}`}
              className={`flex h-8 flex-1 flex-col items-center justify-center rounded-lg text-[10px] font-black ${
                done ? 'bg-sky-500 text-white'
                  : future ? 'bg-slate-50 text-slate-300'
                    : today ? 'border border-amber-300 bg-amber-50 text-amber-600'
                      : 'bg-slate-100 text-slate-400'}`}>
              {label}
            </div>
          )
        })}
      </div>
      {!member.todaySubmitted && (
        <p className="mt-1.5 text-[11px] font-black text-amber-600">오늘 보고 미제출</p>
      )}

      {/* 최근 보고 */}
      <div className="mt-3 space-y-1">
        {myReports.length === 0 && <p className="text-[12px] font-bold text-slate-300">최근 일일보고 없음</p>}
        {myReports.map((r) => (
          <div key={r.id}>
            <button type="button" onClick={() => setOpenReportId(openReportId === r.id ? null : r.id)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-bold hover:bg-slate-50 ${openReportId === r.id ? 'bg-slate-50 text-slate-900' : 'text-slate-600'}`}>
              <span className="truncate">[{fmtDate(r.report_date).slice(5)}] {r.title}</span>
              <span className="material-symbols-outlined shrink-0 text-[16px] text-slate-300">
                {openReportId === r.id ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {openReportId === r.id && <ReportItem report={r} onClose={() => setOpenReportId(null)} />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────── 메인 페이지 ─────────────── */

export default function TeamManagePage({ role = 'EMPLOYEE' }) {
  const [overview, setOverview] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      api.get('/team/overview').then((res) => setOverview(res.data)),
      getStaffWorkReports({ reportType: 'DAILY' }).then((res) => setReports(res.data || [])),
    ]).catch((e) => {
      setError(e?.response?.data?.message || '팀 현황을 불러오지 못했습니다.')
    }).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  if (role === 'EMPLOYEE') {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">
          팀 관리는 팀장(MANAGER) 이상만 사용할 수 있습니다.
        </div>
      </div>
    )
  }

  const members = overview?.members || []
  const byDept = members.reduce((acc, m) => {
    const key = m.department || '미지정'
    ;(acc[key] = acc[key] || []).push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-slate-900">팀 관리</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            {overview?.department ? `${overview.department} 팀` : '전체 부서'} · 부서 기준 자동 구성 — 보고 제출 현황, 업무 부하, 피드백을 한 화면에서 관리합니다.
          </p>
        </div>
        <button type="button" onClick={load}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-black text-slate-500 hover:bg-slate-50">
          <span className="material-symbols-outlined text-[16px]">refresh</span> 새로고침
        </button>
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-500">{error}</div>}

      {overview && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-black text-slate-600">
            팀원 {members.length}명
          </span>
          <span className={`rounded-lg px-3 py-1.5 text-[12px] font-black ${overview.noReportToday > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            오늘 보고 미제출 {overview.noReportToday}명
          </span>
          <span className={`rounded-lg px-3 py-1.5 text-[12px] font-black ${Number(overview.membersWithDelay) > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
            지연 업무 보유 {overview.membersWithDelay}명
          </span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-500">
            {fmtDate(overview.weekStart).slice(5)} ~ {fmtDate(overview.weekEnd).slice(5)}
          </span>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm font-bold text-slate-400">불러오는 중…</p>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center text-sm text-slate-400">
          표시할 팀원이 없습니다. 계정 관리에서 팀원의 부서를 설정해 주세요.
        </div>
      ) : (
        Object.entries(byDept).map(([dept, deptMembers]) => (
          <div key={dept}>
            {Object.keys(byDept).length > 1 && (
              <p className="mb-2 mt-1 text-[13px] font-black text-slate-500">{dept} <span className="font-bold text-slate-300">({deptMembers.length}명)</span></p>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {deptMembers.map((m) => (
                <MemberCard key={m.username} member={m} weekStart={overview.weekStart} reports={reports} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
