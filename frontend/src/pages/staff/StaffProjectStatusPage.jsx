import { useEffect, useMemo, useState } from 'react'
import { createExecutiveRecord, deleteExecutiveRecord, getExecutiveWorkTasks, updateExecutiveRecord } from '../../api/executiveApi'
import { isTaskDelayed, taskProgress } from '../executive/workTaskUtils'

const DAY_MS = 24 * 60 * 60 * 1000

const statusOptions = [
  ['WAITING', '대기'],
  ['IN_PROGRESS', '진행중'],
  ['REVIEW', '검토요청'],
  ['BLOCKED', '막힘'],
  ['DELAYED', '지연'],
  ['DONE', '완료'],
]

const priorityOptions = [
  ['LOW', '낮음'],
  ['MEDIUM', '보통'],
  ['HIGH', '높음'],
  ['URGENT', '긴급'],
]

const emptyTask = {
  project_name: '',
  task_name: '',
  assignee_name: '',
  department: '',
  work_category: '프로젝트',
  priority: 'MEDIUM',
  status: 'WAITING',
  progress_rate: 0,
  start_date: '',
  due_date: '',
  today_work: '',
  next_action: '',
  blocker_text: '',
}

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-950 outline-none focus:border-slate-900'
const textareaClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-slate-900'

function toDate(value = new Date()) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  return new Date(`${String(value).slice(0, 10)}T00:00:00`)
}

function dateText(date = new Date()) {
  return toDate(date).toISOString().slice(0, 10)
}

function addDays(date, days) {
  const next = toDate(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date) {
  const next = toDate(date)
  const day = next.getDay()
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day))
  return next
}

function startOfMonth(date) {
  const next = toDate(date)
  next.setDate(1)
  return next
}

function monthGrid(date) {
  const first = startOfMonth(date)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat('ko-KR', options).format(toDate(date))
}

function statusLabel(status) {
  return statusOptions.find(([value]) => value === status)?.[1] || status
}

function taskColor(task) {
  if (task.status === 'DONE') return 'bg-emerald-500'
  if (isTaskDelayed(task) || task.status === 'BLOCKED' || task.status === 'DELAYED') return 'bg-rose-500'
  if (task.status === 'REVIEW') return 'bg-amber-500'
  return 'bg-orange-500'
}

function taskDot(task) {
  if (task.status === 'DONE') return 'bg-emerald-500'
  if (isTaskDelayed(task) || task.status === 'BLOCKED' || task.status === 'DELAYED') return 'bg-rose-500'
  if (task.status === 'REVIEW') return 'bg-amber-500'
  return 'bg-blue-500'
}

function taskRange(task) {
  const start = toDate(task.start_date || task.due_date || new Date())
  const end = toDate(task.due_date || task.start_date || new Date())
  return end < start ? [end, start] : [start, end]
}

function overlaps(task, start, end) {
  const [taskStart, taskEnd] = taskRange(task)
  return taskStart <= end && taskEnd >= start
}

function containsDate(task, date) {
  const target = toDate(date)
  const [start, end] = taskRange(task)
  return start <= target && end >= target
}

function rangePosition(task, days) {
  const [start, end] = taskRange(task)
  const first = days[0]
  const last = days[days.length - 1]
  if (end < first || start > last) return null
  const visibleStart = Math.max(0, Math.round((start - first) / DAY_MS))
  const visibleEnd = Math.min(days.length - 1, Math.round((end - first) / DAY_MS))
  return {
    left: `${(visibleStart / days.length) * 100}%`,
    width: `${((visibleEnd - visibleStart + 1) / days.length) * 100}%`,
  }
}

export default function StaffProjectStatusPage({ username, displayName, department }) {
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('week')
  const [cursorDate, setCursorDate] = useState(toDate())
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    ...emptyTask,
    assignee_name: username || '',
    department: department || '',
    start_date: dateText(),
    due_date: dateText(),
  })
  const [loading, setLoading] = useState(false)

  const ownerLabel = displayName || username || '실무진'

  const load = async () => {
    setLoading(true)
    try {
      const response = await getExecutiveWorkTasks()
      setTasks(response.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const projects = useMemo(() => {
    const names = Array.from(new Set(tasks.map((task) => task.project_name || '프로젝트 미지정')))
    return ['ALL', ...names.sort((a, b) => a.localeCompare(b))]
  }, [tasks])

  const visibleTasks = useMemo(() => (
    projectFilter === 'ALL' ? tasks : tasks.filter((task) => (task.project_name || '프로젝트 미지정') === projectFilter)
  ), [projectFilter, tasks])

  const stats = useMemo(() => ({
    active: visibleTasks.filter((task) => task.status !== 'DONE').length,
    risk: visibleTasks.filter((task) => isTaskDelayed(task) || ['BLOCKED', 'DELAYED'].includes(task.status)).length,
    done: visibleTasks.filter((task) => task.status === 'DONE').length,
  }), [visibleTasks])

  const dayTasks = useMemo(() => visibleTasks.filter((task) => containsDate(task, cursorDate)), [visibleTasks, cursorDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursorDate), index)), [cursorDate])
  const weekTasks = useMemo(() => visibleTasks.filter((task) => overlaps(task, weekDays[0], weekDays[6])), [visibleTasks, weekDays])
  const monthDays = useMemo(() => monthGrid(cursorDate), [cursorDate])

  const groupedList = useMemo(() => {
    const map = new Map()
    visibleTasks.forEach((task) => {
      const key = task.project_name || '프로젝트 미지정'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(task)
    })
    return Array.from(map.entries())
  }, [visibleTasks])

  const moveCursor = (amount) => {
    if (view === 'month') {
      const next = toDate(cursorDate)
      next.setMonth(next.getMonth() + amount)
      setCursorDate(next)
      return
    }
    setCursorDate(addDays(cursorDate, view === 'week' ? amount * 7 : amount))
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const openCreate = (date = cursorDate) => {
    setEditingId(null)
    setForm({
      ...emptyTask,
      assignee_name: username || '',
      department: department || '',
      start_date: dateText(date),
      due_date: dateText(date),
    })
    setShowEditor(true)
  }

  const openEdit = (task) => {
    setEditingId(task.id)
    setForm({
      project_name: task.project_name || '',
      task_name: task.task_name || '',
      assignee_name: task.assignee_name || username || '',
      department: task.department || department || '',
      work_category: task.work_category || '프로젝트',
      priority: task.priority || 'MEDIUM',
      status: task.status || 'WAITING',
      progress_rate: taskProgress(task),
      start_date: dateText(task.start_date || task.due_date || cursorDate),
      due_date: dateText(task.due_date || task.start_date || cursorDate),
      today_work: task.today_work || '',
      next_action: task.next_action || '',
      blocker_text: task.blocker_text || '',
    })
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingId(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      progress_rate: Number(form.progress_rate || 0),
      completed_date: form.status === 'DONE' ? dateText() : null,
    }

    if (editingId) await updateExecutiveRecord('work-tasks', editingId, payload)
    else await createExecutiveRecord('work-tasks', payload)

    closeEditor()
    await load()
  }

  const removeTask = async () => {
    if (!editingId) return
    await deleteExecutiveRecord('work-tasks', editingId)
    closeEditor()
    await load()
  }

  const rangeTitle = view === 'month'
    ? formatDate(cursorDate, { year: 'numeric', month: '2-digit' }).replace('. ', '.').replace('.', '')
    : view === 'week'
      ? `${dateText(weekDays[0]).replaceAll('-', '.')} ~ ${dateText(weekDays[6]).replaceAll('-', '.')}`
      : dateText(cursorDate).replaceAll('-', '.')

  return (
    <main className="min-h-[calc(100vh-80px)] bg-white">
      <div className="grid min-h-[calc(100vh-80px)] grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-white px-6 py-7">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-black text-slate-950">캘린더</h1>
            <span className="material-symbols-outlined text-slate-500">more_vert</span>
          </div>

          <button
            type="button"
            onClick={() => openCreate(cursorDate)}
            className="mb-8 h-12 w-full rounded-lg border border-slate-900 bg-white text-sm font-black text-slate-950 hover:bg-slate-50"
          >
            일정등록
          </button>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-950">내 캘린더</h2>
              <span className="material-symbols-outlined text-sm text-slate-400">edit</span>
            </div>
            <div className="space-y-3 text-sm font-bold text-slate-700">
              <label className="flex items-center justify-between">
                <span className="flex items-center gap-2"><input type="checkbox" checked readOnly /> 프로젝트</span>
                <span className="h-3 w-3 rounded-full bg-orange-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="flex items-center gap-2"><input type="checkbox" checked readOnly /> 내 일정</span>
                <span className="h-3 w-3 rounded-full bg-blue-500" />
              </label>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-black text-slate-950">프로젝트</h2>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-bold text-slate-700">
              {projects.map((project) => <option key={project} value={project}>{project === 'ALL' ? '전체' : project}</option>)}
            </select>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between text-sm font-black text-slate-700">
              <span>진행 업무</span>
              <strong>{stats.active}건</strong>
            </div>
            <div className="flex items-center justify-between text-sm font-black text-rose-600">
              <span>지연 / 위험</span>
              <strong>{stats.risk}건</strong>
            </div>
            <div className="flex items-center justify-between text-sm font-black text-emerald-600">
              <span>완료</span>
              <strong>{stats.done}건</strong>
            </div>
          </section>

          <p className="mt-10 text-xs font-bold leading-5 text-slate-400">{ownerLabel} / 프로젝트 현황</p>
        </aside>

        <section className="overflow-hidden px-8 py-7">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">일정목록</h2>
              <p className="mt-2 text-sm font-bold text-slate-500">프로젝트 일정과 마감일을 캘린더에서 바로 확인합니다.</p>
            </div>
            <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-50">
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
              새로고침
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              {[
                ['day', '일간'],
                ['week', '주간'],
                ['month', '월간'],
                ['list', '목록'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={`h-9 rounded-full border px-4 text-sm font-black ${view === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button type="button" onClick={() => moveCursor(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <p className="min-w-64 text-center text-2xl font-black text-slate-950">{rangeTitle}</p>
              <button type="button" onClick={() => moveCursor(1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
              <button type="button" onClick={() => setCursorDate(toDate())} className="h-9 px-2 text-sm font-black text-slate-600">오늘</button>
            </div>
          </div>

          {view === 'day' && (
            <CalendarFrame days={[cursorDate]} rows={dayTasks} onCreate={openCreate} onEdit={openEdit} />
          )}

          {view === 'week' && (
            <CalendarFrame days={weekDays} rows={weekTasks} onCreate={openCreate} onEdit={openEdit} />
          )}

          {view === 'month' && (
            <MonthView days={monthDays} cursorDate={cursorDate} rows={visibleTasks} onCreate={openCreate} onEdit={openEdit} />
          )}

          {view === 'list' && (
            <ListView grouped={groupedList} onEdit={openEdit} />
          )}
        </section>
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/20">
          <form onSubmit={submit} className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">{editingId ? '일정 수정' : '일정 등록'}</h2>
              <button type="button" onClick={closeEditor} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <Field label="프로젝트명">
              <input value={form.project_name} onChange={(event) => setField('project_name', event.target.value)} required className={inputClass} />
            </Field>
            <Field label="일정 제목">
              <input value={form.task_name} onChange={(event) => setField('task_name', event.target.value)} required className={inputClass} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="시작일">
                <input type="date" value={form.start_date} onChange={(event) => setField('start_date', event.target.value)} className={inputClass} />
              </Field>
              <Field label="마감일">
                <input type="date" value={form.due_date} onChange={(event) => setField('due_date', event.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="상태">
                <select value={form.status} onChange={(event) => setField('status', event.target.value)} className={inputClass}>
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="우선순위">
                <select value={form.priority} onChange={(event) => setField('priority', event.target.value)} className={inputClass}>
                  {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>

            <Field label={`진행률 ${form.progress_rate}%`}>
              <input type="range" min="0" max="100" value={form.progress_rate} onChange={(event) => setField('progress_rate', event.target.value)} className="w-full accent-slate-900" />
            </Field>

            <Field label="업무 내용">
              <textarea value={form.today_work} onChange={(event) => setField('today_work', event.target.value)} rows="4" className={textareaClass} />
            </Field>
            <Field label="다음 액션">
              <textarea value={form.next_action} onChange={(event) => setField('next_action', event.target.value)} rows="3" className={textareaClass} />
            </Field>
            <Field label="막힌 이슈">
              <textarea value={form.blocker_text} onChange={(event) => setField('blocker_text', event.target.value)} rows="3" className={textareaClass} />
            </Field>

            <div className="mt-6 flex gap-2">
              {editingId && (
                <button type="button" onClick={removeTask} className="h-11 rounded-lg border border-rose-200 px-4 text-sm font-black text-rose-600 hover:bg-rose-50">
                  삭제
                </button>
              )}
              <button type="submit" className="h-11 flex-1 rounded-lg bg-slate-900 text-sm font-black text-white hover:bg-slate-800">
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-xs font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function CalendarFrame({ days, rows, onCreate, onEdit }) {
  const hourRows = ['08', '09', '10', '11', '오후 12', '01', '02', '03', '04', '05', '06', '07']
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-slate-200">
        <div className="px-4 py-3 text-sm font-bold text-slate-700">시간</div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const isToday = dateText(day) === dateText()
            return (
              <button key={dateText(day)} type="button" onClick={() => onCreate(day)} className="border-l border-slate-200 px-4 py-3 text-center text-sm font-bold hover:bg-slate-50">
                <span className={isToday ? 'rounded-full bg-slate-900 px-3 py-1 text-white' : ''}>
                  {formatDate(day, { month: '2-digit', day: '2-digit', weekday: 'short' })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid min-h-36 grid-cols-[72px_minmax(0,1fr)] border-b border-slate-200">
        <div className="px-4 py-4 text-sm font-bold text-slate-700">종일일정</div>
        <div className="relative px-3 py-3">
          <div className="absolute inset-y-0 left-0 right-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day) => <div key={dateText(day)} className="border-l border-slate-100" />)}
          </div>
          <div className="relative space-y-2">
            {rows.map((task) => {
              const style = rangePosition(task, days)
              if (!style) return null
              return (
                <button key={task.id} type="button" onClick={() => onEdit(task)} className={`relative flex h-6 items-center rounded-sm px-3 text-left text-xs font-black text-white ${taskColor(task)}`} style={style}>
                  <span className="truncate">{task.task_name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)]">
        <div className="divide-y divide-slate-100">
          {hourRows.map((hour) => <div key={hour} className="h-16 px-4 py-2 text-right text-xs font-bold text-slate-700">{hour}</div>)}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => (
            <button key={dateText(day)} type="button" onClick={() => onCreate(day)} className="border-l border-slate-100">
              <div className="h-full divide-y divide-slate-100">
                {hourRows.map((hour) => <div key={hour} className="h-16" />)}
              </div>
            </button>
          ))}
          <div className="pointer-events-none absolute left-0 right-0 top-[226px] border-t border-slate-900">
            <span className="absolute -left-1 -top-1.5 h-2 w-2 rounded-full bg-slate-900" />
          </div>
        </div>
      </div>
    </section>
  )
}

function MonthView({ days, cursorDate, rows, onCreate, onEdit }) {
  const month = cursorDate.getMonth()
  const weekLabels = ['일', '월', '화', '수', '목', '금', '토']
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {weekLabels.map((label, index) => <div key={label} className={`px-4 py-3 text-sm font-bold ${index === 0 ? 'text-rose-500' : 'text-slate-700'}`}>{label}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const text = dateText(day)
          const dayTasks = rows.filter((task) => containsDate(task, day)).slice(0, 4)
          const isToday = text === dateText()
          const isOtherMonth = day.getMonth() !== month
          return (
            <div key={text} className="min-h-28 border-b border-r border-slate-100 p-3">
              <button type="button" onClick={() => onCreate(day)} className={`mb-2 text-sm font-bold ${isOtherMonth ? 'text-slate-300' : 'text-slate-800'} ${isToday ? 'rounded-full bg-slate-900 px-2 py-0.5 text-white' : ''}`}>
                {day.getDate()}
              </button>
              <div className="space-y-1">
                {dayTasks.map((task) => (
                  <button key={`${task.id}-${text}`} type="button" onClick={() => onEdit(task)} className={`block h-5 w-full truncate rounded-sm px-2 text-left text-[11px] font-black text-white ${taskColor(task)}`}>
                    {task.task_name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ListView({ grouped, onEdit }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[120px_1fr_160px_160px] border-b border-slate-900 px-4 py-3 text-sm font-bold text-slate-700">
        <span>상태</span>
        <span>제목</span>
        <span>시작일</span>
        <span>마감일</span>
      </div>
      {grouped.map(([project, tasks]) => (
        <div key={project}>
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black text-slate-950">{project}</div>
          {tasks.map((task) => (
            <button key={task.id} type="button" onClick={() => onEdit(task)} className="grid w-full grid-cols-[120px_1fr_160px_160px] border-b border-slate-100 px-4 py-4 text-left text-sm hover:bg-slate-50">
              <span className="flex items-center gap-2 font-bold text-slate-600"><span className={`h-3 w-3 rounded-full ${taskDot(task)}`} />{statusLabel(task.status)}</span>
              <span className="font-black text-slate-950">{task.task_name}</span>
              <span className="font-bold text-slate-500">{String(task.start_date || '-').slice(0, 10)}</span>
              <span className="font-bold text-slate-500">{String(task.due_date || '-').slice(0, 10)}</span>
            </button>
          ))}
        </div>
      ))}
    </section>
  )
}
