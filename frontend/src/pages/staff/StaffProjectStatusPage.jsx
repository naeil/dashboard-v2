import { useEffect, useMemo, useRef, useState } from 'react'
import { getUsers } from '../../api/authApi'
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
  request_text: '',
  review_comment: '',
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

function priorityLabel(priority) {
  return priorityOptions.find(([value]) => value === priority)?.[1] || priority
}

function statusPillClass(status) {
  if (status === 'DONE') return 'bg-emerald-100 text-emerald-700'
  if (status === 'BLOCKED' || status === 'DELAYED') return 'bg-rose-100 text-rose-700'
  if (status === 'REVIEW') return 'bg-amber-100 text-amber-700'
  if (status === 'IN_PROGRESS') return 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200'
  return 'bg-blue-100 text-blue-700'
}

function priorityPillClass(priority) {
  if (priority === 'URGENT') return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
  if (priority === 'HIGH') return 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
  if (priority === 'MEDIUM') return 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200'
  return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
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

function mentionTargets(text = '') {
  return Array.from(String(text).matchAll(/@([^\s,.:;()[\]{}]+)/g)).map((match) => normalizeMentionKey(match[1])).filter(Boolean)
}

function normalizeMentionKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(대표님|팀장님|매니저님|님|씨|대표|팀장|매니저)$/g, '')
}

function isMentioned(task, names = []) {
  const haystack = [task.request_text, task.review_comment, task.next_action, task.blocker_text].join('\n')
  const mentions = mentionTargets(haystack)
  const keys = names.map(normalizeMentionKey).filter(Boolean)
  return keys.some((key) => mentions.some((mention) => mention === key || mention.startsWith(key)))
}

export default function StaffProjectStatusPage({ username, displayName, department }) {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [view, setView] = useState('list')
  const [cursorDate, setCursorDate] = useState(toDate())
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [employeeFilter, setEmployeeFilter] = useState('ALL')
  const [showProjectCalendar, setShowProjectCalendar] = useState(true)
  const [showMyCalendar, setShowMyCalendar] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
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
      const [taskResponse, userResponse] = await Promise.all([getExecutiveWorkTasks(), getUsers()])
      setTasks(taskResponse.data || [])
      setUsers(userResponse.data || [])
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

  const projectNameOptions = useMemo(() => (
    Array.from(new Set(tasks.map((task) => task.project_name).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  ), [tasks])

  const employeeNames = useMemo(() => (
    Array.from(new Set([
      ...users.map((user) => user.display_name || user.displayName || user.username).filter(Boolean),
      ...tasks.map((task) => task.assignee_name || '담당자 미지정').filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b))
  ), [tasks, users])

  const myMentionKeys = useMemo(() => (
    [username, displayName].filter(Boolean).map((value) => String(value).trim())
  ), [displayName, username])

  const projectSummaries = useMemo(() => (
    projectNameOptions.map((project) => {
      const projectTasks = tasks.filter((task) => task.project_name === project)
      const active = projectTasks.filter((task) => task.status !== 'DONE').length
      const dueDates = projectTasks.map((task) => task.due_date).filter(Boolean).sort()
      return {
        name: project,
        total: projectTasks.length,
        active,
        dueDate: dueDates[0] || null,
      }
    })
  ), [projectNameOptions, tasks])

  const filteredProjectSummaries = useMemo(() => {
    const keyword = projectSearch.trim().toLowerCase()
    if (!keyword) return projectSummaries
    return projectSummaries.filter((project) => project.name.toLowerCase().includes(keyword))
  }, [projectSearch, projectSummaries])

  const relatedTasks = useMemo(() => (
    tasks
      .filter((task) => form.project_name && task.project_name === form.project_name && task.id !== editingId)
      .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
      .slice(0, 6)
  ), [editingId, form.project_name, tasks])

  const calendarTasks = useMemo(() => {
    const ownerKeys = [username, displayName].filter(Boolean).map((value) => String(value).trim().toLowerCase())
    return tasks.filter((task) => {
      const assignee = String(task.assignee_name || '').trim().toLowerCase()
      const isMine = ownerKeys.length > 0 && ownerKeys.includes(assignee)
      if (!showProjectCalendar && !showMyCalendar) return false
      if (showProjectCalendar && showMyCalendar) return true
      if (showMyCalendar) return isMine
      return !isMine
    })
  }, [displayName, showMyCalendar, showProjectCalendar, tasks, username])

  const visibleTasks = useMemo(() => (
    calendarTasks.filter((task) => {
      const projectMatches = projectFilter === 'ALL' || (task.project_name || '프로젝트 미지정') === projectFilter
      const employeeMatches = employeeFilter === 'ALL' || (task.assignee_name || '담당자 미지정') === employeeFilter
      return projectMatches && employeeMatches
    })
  ), [calendarTasks, employeeFilter, projectFilter])

  const mentionNotifications = useMemo(() => (
    tasks
      .filter((task) => isMentioned(task, myMentionKeys))
      .sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')))
      .slice(0, 8)
  ), [myMentionKeys, tasks])

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
      const key = task.assignee_name || '담당자 미지정'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(task)
    })
    return Array.from(map.entries())
      .filter(([, rows]) => rows.length > 0)
      .map(([assignee, rows]) => [
        assignee,
        rows.sort((a, b) => {
          const statusA = statusOptions.findIndex(([value]) => value === (a.status || 'WAITING'))
          const statusB = statusOptions.findIndex(([value]) => value === (b.status || 'WAITING'))
          if (statusA !== statusB) return statusA - statusB
          return String(a.due_date || '').localeCompare(String(b.due_date || ''))
        }),
      ])
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

  const selectProject = (projectName) => {
    setField('project_name', projectName)
    setProjectSearch('')
    setProjectPickerOpen(false)
  }

  const openCreate = (date = cursorDate) => {
    setEditingId(null)
    setProjectSearch('')
    setProjectPickerOpen(false)
    setForm({
      ...emptyTask,
      project_name: projectFilter === 'ALL' ? '' : projectFilter,
      assignee_name: username || '',
      department: department || '',
      start_date: dateText(date),
      due_date: dateText(date),
    })
    setShowEditor(true)
  }

  const openNextActionAsTask = () => {
    if (!form.next_action.trim()) return
    const nextDate = dateText(addDays(form.due_date || cursorDate, 1))
    setEditingId(null)
    setForm({
      ...emptyTask,
      project_name: form.project_name,
      task_name: form.next_action.trim(),
      assignee_name: form.assignee_name || username || '',
      department: form.department || department || '',
      start_date: nextDate,
      due_date: nextDate,
      today_work: form.next_action.trim(),
      source_type: 'RELATED_TASK',
      source_key: editingId ? `WORK_TASK:${editingId}:NEXT_ACTION:${Date.now()}` : null,
    })
    setShowEditor(true)
  }

  const openEdit = (task) => {
    setEditingId(task.id)
    setProjectSearch('')
    setProjectPickerOpen(false)
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
      request_text: task.request_text || '',
      review_comment: task.review_comment || '',
    })
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingId(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.project_name.trim()) {
      alert('프로젝트를 선택하거나 새 프로젝트를 만들어주세요.')
      setProjectPickerOpen(true)
      return
    }
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

  const removeTaskFromList = async (task) => {
    const ok = window.confirm(`"${task.task_name}" 일정을 삭제할까요?`)
    if (!ok) return
    await deleteExecutiveRecord('work-tasks', task.id)
    if (editingId === task.id) closeEditor()
    await load()
  }

  const updateTaskStatus = async (task, status) => {
    await updateExecutiveRecord('work-tasks', task.id, {
      ...task,
      status,
      progress_rate: Number(task.progress_rate || taskProgress(task) || 0),
      completed_date: status === 'DONE' ? dateText() : null,
    })
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
            <h1 className="text-2xl font-black tracking-tight text-slate-950">캘린더</h1>
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
              <label className="flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={showProjectCalendar} onChange={(event) => setShowProjectCalendar(event.target.checked)} />
                  프로젝트
                </span>
                <span className="h-3 w-3 rounded-full bg-orange-500" />
              </label>
              <label className="flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={showMyCalendar} onChange={(event) => setShowMyCalendar(event.target.checked)} />
                  내 일정
                </span>
                <span className="h-3 w-3 rounded-full bg-blue-500" />
              </label>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-black text-slate-950">직원</h2>
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="mb-3 h-10 w-full rounded border border-slate-300 px-3 text-sm font-bold text-slate-700">
              <option value="ALL">전체 직원</option>
              {employeeNames.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
            </select>
            <h2 className="mb-3 text-sm font-black text-slate-500">프로젝트</h2>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-bold text-slate-700">
              {projects.map((project) => <option key={project} value={project}>{project === 'ALL' ? '전체' : project}</option>)}
            </select>
          </section>

          <section className="mb-8 rounded-xl border border-sky-100 bg-sky-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-sky-900">담당자 알림</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-sky-700">{mentionNotifications.length}건</span>
            </div>
            <div className="space-y-2">
              {mentionNotifications.slice(0, 3).map((task) => (
                <button key={task.id} type="button" onClick={() => openEdit(task)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 shadow-sm hover:bg-sky-100">
                  <span className="block truncate font-black text-slate-950">@멘션 · {task.task_name}</span>
                  <span className="mt-0.5 block truncate text-slate-500">{task.request_text || task.review_comment || task.next_action || task.blocker_text}</span>
                </button>
              ))}
              {mentionNotifications.length === 0 && (
                <p className="text-xs font-bold text-sky-700">나를 태그한 요청이 없습니다.</p>
              )}
            </div>
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
            <ListView grouped={groupedList} onEdit={openEdit} onDelete={removeTaskFromList} onStatusChange={updateTaskStatus} onCreate={openCreate} />
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

            <ProjectRelationPicker
              value={form.project_name}
              open={projectPickerOpen}
              search={projectSearch}
              projects={filteredProjectSummaries}
              onToggle={() => setProjectPickerOpen((prev) => !prev)}
              onSearch={setProjectSearch}
              onSelect={selectProject}
            />
            {relatedTasks.length > 0 && (
              <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-sky-700">같은 프로젝트의 기존 일정</p>
                  <span className="text-[11px] font-black text-slate-400">{relatedTasks.length}건</span>
                </div>
                <div className="space-y-2">
                  {relatedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openEdit(task)}
                      className="flex w-full items-center justify-between gap-3 rounded border border-sky-100 bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-black text-slate-950">{task.task_name}</span>
                        <span className="mt-0.5 block text-slate-500">{String(task.start_date || '-').slice(0, 10)} ~ {String(task.due_date || '-').slice(0, 10)}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-500">{statusLabel(task.status)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="일정 제목">
              <input value={form.task_name} onChange={(event) => setField('task_name', event.target.value)} required className={inputClass} />
            </Field>

            <Field label="담당자">
              <input
                value={form.assignee_name}
                onChange={(event) => setField('assignee_name', event.target.value)}
                placeholder="담당 직원 이름"
                className={inputClass}
              />
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
              {form.project_name.trim() && form.next_action.trim() && (
                <button
                  type="button"
                  onClick={openNextActionAsTask}
                  className="mt-2 inline-flex h-9 items-center gap-2 rounded border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 hover:border-sky-300 hover:bg-sky-100"
                >
                  <span className="material-symbols-outlined text-sm">add_task</span>
                  다음 액션으로 새 일정 만들기
                </button>
              )}
            </Field>
            <Field label="막힌 이슈">
              <textarea value={form.blocker_text} onChange={(event) => setField('blocker_text', event.target.value)} rows="3" className={textareaClass} />
            </Field>
            <Field label="요청 / 도움 요청">
              <MentionTextarea
                value={form.request_text}
                onChange={(value) => setField('request_text', value)}
                users={users}
                rows="3"
                placeholder="@이재연 자료 확인 요청"
              />
            </Field>
            <Field label="관리자 피드백 / 개선 사항">
              <MentionTextarea
                value={form.review_comment}
                onChange={(value) => setField('review_comment', value)}
                users={users}
                rows="3"
                placeholder="@담당자 피드백을 입력하면 해당 직원 알림에 표시됩니다."
              />
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

function MentionTextarea({ value, onChange, users = [], rows = 3, placeholder }) {
  const inputRef = useRef(null)
  const [cursor, setCursor] = useState(0)

  const mention = useMemo(() => {
    const beforeCursor = String(value || '').slice(0, cursor)
    const match = beforeCursor.match(/@([^\s@]*)$/)
    if (!match) return null
    return {
      query: match[1].toLowerCase(),
      start: cursor - match[0].length,
      end: cursor,
    }
  }, [cursor, value])

  const options = useMemo(() => {
    if (!mention) return []
    const seen = new Set()
    return users
      .map((user) => ({
        name: user.display_name || user.displayName || user.username,
        username: user.username,
        department: user.department,
        role: user.role,
      }))
      .filter((user) => {
        if (!user.name || seen.has(user.name)) return false
        seen.add(user.name)
        const searchable = `${user.name} ${user.username || ''}`.toLowerCase()
        return !mention.query || searchable.includes(mention.query)
      })
      .slice(0, 6)
  }, [mention, users])

  const rememberCursor = () => {
    const nextCursor = inputRef.current?.selectionStart ?? 0
    setCursor(nextCursor)
  }

  const insertMention = (user) => {
    if (!mention) return
    const label = user.name || user.username
    const before = String(value || '').slice(0, mention.start)
    const after = String(value || '').slice(mention.end)
    const next = `${before}@${label} ${after}`
    const nextCursor = before.length + label.length + 2
    onChange(next)
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCursor, nextCursor)
      setCursor(nextCursor)
    }, 0)
  }

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setCursor(event.target.selectionStart)
        }}
        onClick={rememberCursor}
        onKeyUp={rememberCursor}
        onSelect={rememberCursor}
        rows={rows}
        placeholder={placeholder}
        className={textareaClass}
      />
      {options.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-40 mt-1 overflow-hidden rounded-lg border border-sky-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-black text-slate-400">@담당자 선택</p>
          {options.map((user) => (
            <button
              key={`${user.username || user.name}-${user.name}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertMention(user)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-sky-50"
            >
              <span>
                <span className="block font-black text-slate-950">@{user.name}</span>
                <span className="mt-0.5 block text-slate-400">{[user.department, user.username].filter(Boolean).join(' / ') || '직원 계정'}</span>
              </span>
              <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black text-sky-700">태그</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {users.slice(0, 5).map((user) => {
          const name = user.display_name || user.displayName || user.username
          if (!name) return null
          return (
            <button
              key={`quick-${user.id || user.username || name}`}
              type="button"
              onClick={() => {
                const separator = value && !String(value).endsWith(' ') ? ' ' : ''
                onChange(`${value || ''}${separator}@${name} `)
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              @{name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProjectRelationPicker({ value, open, search, projects, onToggle, onSearch, onSelect }) {
  const trimmedSearch = search.trim()
  const canCreate = trimmedSearch && !projects.some((project) => project.name === trimmedSearch)

  return (
    <div className="mb-4">
      <span className="mb-1 block text-xs font-black text-slate-500">프로젝트</span>
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-black text-slate-950 outline-none hover:border-slate-400"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-base text-slate-400">target</span>
          <span className="truncate">{value || '프로젝트 선택'}</span>
        </span>
        <span className="material-symbols-outlined text-base text-slate-400">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-2 flex items-center gap-2 rounded border border-slate-200 px-3">
            <span className="material-symbols-outlined text-sm text-slate-400">search</span>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="프로젝트 검색"
              className="h-10 min-w-0 flex-1 text-sm font-bold text-slate-950 outline-none"
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.name}
                type="button"
                onClick={() => onSelect(project.name)}
                className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-slate-50 ${value === project.name ? 'bg-sky-50 text-sky-700' : 'text-slate-700'}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-black">{project.name}</span>
                  <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                    진행 {project.active}건 · 전체 {project.total}건{project.dueDate ? ` · 다음 마감 ${String(project.dueDate).slice(0, 10)}` : ''}
                  </span>
                </span>
                {value === project.name && <span className="material-symbols-outlined text-base">check</span>}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => onSelect(trimmedSearch)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-black text-sky-700 hover:bg-sky-50"
              >
                <span className="material-symbols-outlined text-base">add</span>
                새 프로젝트 만들기: {trimmedSearch}
              </button>
            )}
            {projects.length === 0 && !canCreate && (
              <p className="px-3 py-4 text-center text-xs font-bold text-slate-400">선택할 프로젝트가 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
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

function ListView({ grouped, onEdit, onDelete, onStatusChange, onCreate }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(220px,1.5fr)_130px_120px_180px_120px_120px_minmax(180px,1fr)_112px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
        <span>업무명</span>
        <span>상태</span>
        <span>소유자</span>
        <span>날짜</span>
        <span>우선순위</span>
        <span>진행률</span>
        <span>선행 작업</span>
        <span>관리</span>
      </div>
      {grouped.map(([assignee, tasks]) => (
        <div key={assignee}>
          <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-700">{assignee}</span>
            <span className="text-xs font-black text-slate-400">{tasks.length}</span>
          </div>
          {tasks.map((task) => (
            <div key={task.id} className="grid grid-cols-[minmax(220px,1.5fr)_130px_120px_180px_120px_120px_minmax(180px,1fr)_112px] items-center border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50">
              <button type="button" onClick={() => onEdit(task)} className="min-w-0 text-left font-black text-slate-950">
                <span className="block truncate">{task.task_name}</span>
                <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-400">{task.project_name || '프로젝트 미지정'}</span>
              </button>
              <select
                value={task.status || 'WAITING'}
                onChange={(event) => onStatusChange(task, event.target.value)}
                className={`h-8 w-28 rounded-full border-0 px-3 text-xs font-black shadow-sm outline-none transition hover:brightness-95 ${statusPillClass(task.status || 'WAITING')}`}
              >
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" onClick={() => onEdit(task)} className="truncate text-left font-bold text-slate-600">{task.assignee_name || '-'}</button>
              <button type="button" onClick={() => onEdit(task)} className="truncate text-left font-bold text-slate-600">
                {String(task.start_date || '-').slice(0, 10)} → {String(task.due_date || '-').slice(0, 10)}
              </button>
              <button type="button" onClick={() => onEdit(task)} className="text-left">
                <span className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-black ${priorityPillClass(task.priority || 'MEDIUM')}`}>
                  {priorityLabel(task.priority || 'MEDIUM')}
                </span>
              </button>
              <button type="button" onClick={() => onEdit(task)} className="flex items-center gap-2 text-left font-bold text-slate-700">
                <span className="w-12 font-black text-blue-700">{Number(task.progress_rate || taskProgress(task) || 0).toFixed(0)}%</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-blue-50 ring-1 ring-blue-100">
                  <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Number(task.progress_rate || taskProgress(task) || 0))}%` }} />
                </span>
              </button>
              <button type="button" onClick={() => onEdit(task)} className="min-w-0 text-left font-bold text-slate-600">
                <span className="block truncate">{task.next_action || '-'}</span>
                {task.request_text && <span className="mt-1 block truncate text-[11px] font-black text-sky-600">요청: {task.request_text}</span>}
                {task.review_comment && <span className="mt-1 block truncate text-[11px] font-black text-amber-600">피드백: {task.review_comment}</span>}
                {task.blocker_text && <span className="mt-1 block truncate text-[11px] font-black text-rose-600">막힘: {task.blocker_text}</span>}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                  title="수정"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(task)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                  title="삭제"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onCreate()} className="flex h-10 w-full items-center gap-2 border-b border-slate-100 px-4 text-left text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <span className="material-symbols-outlined text-base">add</span>
            새 업무
          </button>
        </div>
      ))}
      {grouped.length === 0 && <p className="p-8 text-center text-sm font-bold text-slate-400">표시할 업무가 없습니다.</p>}
    </section>
  )
}
