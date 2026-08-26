import { useCallback, useEffect, useMemo, useState } from 'react'
import { getControlTowerOverview, saveReorderLeadDays } from '../../api/controlTowerApi'

const comma = (v) => Math.round(Number(v) || 0).toLocaleString('ko-KR')

const STATUS_LABEL = {
  DELAYED: '지연', BLOCKED: '막힘', REVIEW: '검토', IN_PROGRESS: '진행중', WAITING: '대기',
}
const STATUS_CLS = {
  DELAYED: 'bg-rose-100 text-rose-700', BLOCKED: 'bg-orange-100 text-orange-700',
  REVIEW: 'bg-indigo-100 text-indigo-600', IN_PROGRESS: 'bg-blue-100 text-blue-600',
  WAITING: 'bg-slate-100 text-slate-500',
}
const REORDER_LABEL = {
  OUT: '품절', ORDER_NOW: '지금 발주', ORDER_SOON: '발주 임박', OK: '여유', STALE: '움직임 없음',
}
const REORDER_CLS = {
  OUT: 'bg-rose-500 text-white', ORDER_NOW: 'bg-rose-100 text-rose-700',
  ORDER_SOON: 'bg-amber-100 text-amber-700', OK: 'bg-emerald-50 text-emerald-600',
  STALE: 'bg-slate-100 text-slate-400',
}

function Dday({ value }) {
  if (value == null) return <span className="text-[11px] text-slate-300">미정</span>
  const n = Number(value)
  const cls = n < 0 ? 'bg-rose-500 text-white' : n <= 3 ? 'bg-rose-100 text-rose-700' : n <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-black ${cls}`}>{n < 0 ? `D+${-n}` : n === 0 ? 'D-DAY' : `D-${n}`}</span>
}

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-black text-slate-600">{pct}%</span>
    </div>
  )
}

function LeadDaysCell({ row, onSaved }) {
  const [value, setValue] = useState(row.lead_days)
  const [dirty, setDirty] = useState(false)
  const save = async () => {
    if (!dirty) return
    await saveReorderLeadDays(row.product_id, Number(value) || 14).catch(() => {})
    setDirty(false)
    onSaved()
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        className="h-7 w-14 rounded-lg border border-slate-200 bg-white px-1.5 text-right text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
        value={value}
        onChange={(e) => { setValue(e.target.value.replace(/[^0-9]/g, '')); setDirty(true) }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
      />
      <span className="text-[11px] text-slate-400">일</span>
    </span>
  )
}

export default function ControlTowerPage() {
  const [data, setData] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all') // all | delayed | week
  const [personFilter, setPersonFilter] = useState('')
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showAllReorder, setShowAllReorder] = useState(false)

  const load = useCallback(() => {
    getControlTowerOverview().then(setData).catch(() => setData({ projects: [], tasks: [], people: [], reorder: [] }))
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const tasks = useMemo(() => data?.tasks || [], [data])
  const projects = data?.projects || []
  const people = data?.people || []
  const reorder = useMemo(() => data?.reorder || [], [data])

  const delayedCount = tasks.filter((t) => t.status === 'DELAYED' || t.status === 'BLOCKED' || (t.dday != null && t.dday < 0)).length
  const weekCount = tasks.filter((t) => t.dday != null && t.dday >= 0 && t.dday <= 7).length
  const reorderNeed = reorder.filter((r) => r.reorder_status === 'OUT' || r.reorder_status === 'ORDER_NOW').length

  const filteredTasks = useMemo(() => {
    let list = tasks
    if (taskFilter === 'delayed') list = list.filter((t) => t.status === 'DELAYED' || t.status === 'BLOCKED' || (t.dday != null && t.dday < 0))
    if (taskFilter === 'week') list = list.filter((t) => t.dday != null && t.dday >= 0 && t.dday <= 7)
    if (personFilter) list = list.filter((t) => t.assignee_name === personFilter)
    return list
  }, [tasks, taskFilter, personFilter])

  const visibleTasks = showAllTasks ? filteredTasks : filteredTasks.slice(0, 15)
  const urgentReorder = useMemo(() => reorder.filter((r) => r.reorder_status !== 'STALE'), [reorder])
  const visibleReorder = showAllReorder ? urgentReorder : urgentReorder.slice(0, 10)
  const assigneeNames = useMemo(() => [...new Set(tasks.map((t) => t.assignee_name).filter(Boolean))].sort(), [tasks])

  if (data == null) return <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">종합 상황판</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">프로젝트 진행 · 업무 마감일 · 재발주 시점 — 매일 아침 이 화면 하나로</p>
        </div>
        <button type="button" onClick={load} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">새로고침</button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">진행중 업무</p>
          <p className="mt-1 text-xl font-black text-slate-900">{tasks.length}건</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">지연 · 막힘</p>
          <p className={`mt-1 text-xl font-black ${delayedCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{delayedCount}건</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">7일 내 마감</p>
          <p className={`mt-1 text-xl font-black ${weekCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{weekCount}건</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">재발주 필요</p>
          <p className={`mt-1 text-xl font-black ${reorderNeed > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{reorderNeed}개</p>
        </div>
      </div>

      {/* 업무 마감일 체크 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-slate-800">업무 마감일 체크 <span className="text-[11px] font-bold text-slate-400">마감 임박 순</span></p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[['all', '전체'], ['delayed', '지연만'], ['week', '이번 주']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTaskFilter(k)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-black ${taskFilter === k ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-500'}`}>
                {label}
              </button>
            ))}
            <select className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] font-bold text-slate-600 focus:outline-none"
              value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
              <option value="">담당자 전체</option>
              {assigneeNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {filteredTasks.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">해당 조건의 업무가 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="px-2 py-2 text-left">마감</th><th className="px-2 py-2 text-left">업무</th>
                <th className="px-2 py-2 text-left">프로젝트</th><th className="px-2 py-2 text-left">담당</th>
                <th className="px-2 py-2 text-left">상태</th><th className="px-2 py-2 text-left">진행률</th>
              </tr></thead>
              <tbody>
                {visibleTasks.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-b-0">
                    <td className="px-2 py-1.5 whitespace-nowrap"><Dday value={t.dday} />{t.due_date && <span className="ml-1.5 text-[11px] text-slate-400">{String(t.due_date).slice(5)}</span>}</td>
                    <td className="px-2 py-1.5 text-[13px] font-bold text-slate-800">{t.task_name}
                      {t.blocker_text && <span className="ml-1.5 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">막힘</span>}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-slate-500">{t.project_name}</td>
                    <td className="px-2 py-1.5 text-[12px] font-bold text-slate-600">{t.assignee_name}</td>
                    <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-black ${STATUS_CLS[t.status] || 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[t.status] || t.status}</span></td>
                    <td className="px-2 py-1.5"><ProgressBar value={t.progress_rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTasks.length > 15 && (
              <button type="button" onClick={() => setShowAllTasks((v) => !v)} className="mt-2 text-[12px] font-bold text-blue-500">
                {showAllTasks ? '접기' : `전체 ${filteredTasks.length}건 보기`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 프로젝트 현황 + 재발주 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-800">프로젝트 현황 <span className="text-[11px] font-bold text-slate-400">진행중 {projects.length}개</span></p>
          {projects.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">진행중 프로젝트가 없습니다.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {projects.map((p) => (
                <div key={p.project_name} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-black text-slate-800">{p.project_name}
                      {Number(p.delayed_tasks) > 0 && <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-600">지연 {p.delayed_tasks}</span>}
                    </p>
                    <ProgressBar value={p.avg_progress} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    진행 {p.open_tasks}건 · 완료 {p.done_tasks}건
                    {p.nearest_due && <> · 다음 마감 <span className="font-bold text-slate-700">{String(p.nearest_due).slice(5)}</span></>}
                    {p.assignees && <> · {p.assignees}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-800">재발주 시점 <span className="text-[11px] font-bold text-slate-400">발주 데드라인 = 소진일 − 리드타임</span></p>
          {urgentReorder.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">출고 흐름이 있는 상품이 없습니다.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="px-2 py-2 text-left">상품</th><th className="px-2 py-2 text-right">재고</th>
                  <th className="px-2 py-2 text-right">일 소진</th><th className="px-2 py-2 text-right">소진</th>
                  <th className="px-2 py-2 text-right">리드타임</th><th className="px-2 py-2 text-left">발주 기한</th>
                </tr></thead>
                <tbody>
                  {visibleReorder.map((r) => (
                    <tr key={r.product_id} className="border-b border-slate-50 last:border-b-0">
                      <td className="max-w-[220px] truncate px-2 py-1.5 text-[13px] font-bold text-slate-800" title={r.product_name}>{r.product_name}</td>
                      <td className="px-2 py-1.5 text-right text-[13px] font-black text-slate-900">{comma(r.real_stock)}</td>
                      <td className="px-2 py-1.5 text-right text-[12px] text-slate-500">{r.daily_burn}</td>
                      <td className="px-2 py-1.5 text-right text-[12px] text-slate-600">{r.days_left == null ? '-' : `D-${r.days_left}`}</td>
                      <td className="px-2 py-1.5 text-right"><LeadDaysCell row={r} onSaved={load} /></td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-black ${REORDER_CLS[r.reorder_status]}`}>{REORDER_LABEL[r.reorder_status]}</span>
                        {r.order_deadline && <span className="ml-1.5 text-[11px] text-slate-500">{String(r.order_deadline).slice(5)}까지</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {urgentReorder.length > 10 && (
                <button type="button" onClick={() => setShowAllReorder((v) => !v)} className="mt-2 text-[12px] font-bold text-blue-500">
                  {showAllReorder ? '접기' : `전체 ${urgentReorder.length}개 보기`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 개인별 현황 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-800">개인별 업무 현황</p>
        {people.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">진행중 업무가 없습니다.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {people.map((p) => (
              <button key={p.assignee_name} type="button"
                onClick={() => { setPersonFilter(p.assignee_name === personFilter ? '' : p.assignee_name); setTaskFilter('all') }}
                className={`rounded-lg border p-3 text-left ${personFilter === p.assignee_name ? 'border-blue-400 bg-blue-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <p className="text-[13px] font-black text-slate-800">{p.assignee_name}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  진행 <span className="font-black text-slate-700">{p.open_tasks}</span>건
                  {Number(p.delayed_tasks) > 0 && <> · <span className="font-black text-rose-600">지연 {p.delayed_tasks}</span></>}
                  {Number(p.due_soon) > 0 && <> · <span className="font-black text-amber-600">임박 {p.due_soon}</span></>}
                </p>
                {p.next_due && <p className="mt-0.5 text-[11px] text-slate-400">다음 마감 {String(p.next_due).slice(5)}</p>}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">이름을 누르면 위 마감일 표가 그 사람 업무만 보여줍니다.</p>
      </div>
    </div>
  )
}
