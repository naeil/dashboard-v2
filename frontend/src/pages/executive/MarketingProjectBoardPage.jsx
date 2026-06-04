import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveWorkTasks,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { EmptyState, PageHeader, Panel } from './ExecutiveComponents'
import { count } from './formatters'
import {
  isTaskDelayed,
  marketingProjectStatuses,
  taskPriorityClass,
  taskPriorityLabels,
  taskProgress,
  taskStatusLabels,
} from './workTaskUtils'

const priorityOptions = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
const categoryOptions = ['온라인 프로모션', '오프라인 프로모션', '브랜드 캠페인', '콘텐츠 제작', '광고 운영', '인플루언서', '행사/제휴']

const emptyForm = (ownerName, department) => ({
  project_name: '',
  task_name: '',
  assignee_name: ownerName || '',
  department: department || '마케팅팀',
  work_category: '온라인 프로모션',
  priority: 'HIGH',
  status: 'CONTRACT',
  progress_rate: 0,
  start_date: '',
  due_date: '',
  today_work: '',
  blocker_text: '',
  next_action: '',
  request_text: '',
  source_type: 'MARKETING_PROJECT',
})

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function ProgressBar({ value, tone = 'sky' }) {
  const color = tone === 'rose' ? 'bg-rose-500' : tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-sky-500'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, Math.min(100, Number(value || 0)))}%` }} />
    </div>
  )
}

function isMarketingProject(task) {
  const category = String(task.work_category || '')
  const department = String(task.department || '')
  return task.source_type === 'MARKETING_PROJECT'
    || category.includes('프로모션')
    || category.includes('마케팅')
    || department.includes('마케팅')
}

function priorityRank(priority) {
  return { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[priority] || 0
}

function defaultProgressForStatus(status) {
  const index = marketingProjectStatuses.indexOf(status)
  if (index < 0) return 0
  return Math.round((index / (marketingProjectStatuses.length - 1)) * 100)
}

function ProjectCard({ task, onEdit, onDelete, onMove }) {
  const delayed = isTaskDelayed(task)
  const progress = taskProgress(task)
  const currentIndex = marketingProjectStatuses.indexOf(task.status)
  const nextStatus = marketingProjectStatuses[currentIndex + 1]

  return (
    <article className={`rounded-lg border bg-white p-4 shadow-sm ${delayed ? 'border-rose-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{task.project_name || '프로젝트명 없음'}</p>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{task.task_name || '세부 업무 없음'}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${taskPriorityClass(task.priority)}`}>
          {taskPriorityLabels[task.priority] || task.priority}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
          <span>{task.assignee_name || '담당자 미정'}</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} tone={delayed ? 'rose' : progress >= 90 ? 'emerald' : 'sky'} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">
        <p className="rounded-md bg-slate-50 px-2 py-1.5">시작 {task.start_date || '미정'}</p>
        <p className={`rounded-md px-2 py-1.5 ${delayed ? 'bg-rose-50 text-rose-600' : 'bg-slate-50'}`}>마감 {task.due_date || '미정'}</p>
      </div>

      {(task.blocker_text || task.next_action) && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
          {task.blocker_text && <p className="text-rose-600">막힘: {task.blocker_text}</p>}
          {task.next_action && <p className="mt-1">다음: {task.next_action}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {nextStatus && (
          <button type="button" onClick={() => onMove(task, nextStatus)} className="h-8 rounded-md bg-sky-500 px-3 text-xs font-black text-white hover:bg-sky-600">
            {taskStatusLabels[nextStatus]}로 이동
          </button>
        )}
        <button type="button" onClick={() => onEdit(task)} className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
          수정
        </button>
        <button type="button" onClick={() => onDelete(task)} className="h-8 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-600 hover:bg-rose-100">
          삭제
        </button>
      </div>
    </article>
  )
}

export default function MarketingProjectBoardPage({ username = 'admin', displayName, department }) {
  const ownerName = displayName || username
  const [tasks, setTasks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(() => emptyForm(ownerName, department))
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [message, setMessage] = useState('')

  const load = async () => {
    const response = await getExecutiveWorkTasks()
    setTasks(response.data || [])
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const marketingTasks = useMemo(() => tasks.filter(isMarketingProject), [tasks])
  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return marketingTasks
      .filter((task) => priorityFilter === 'ALL' || task.priority === priorityFilter)
      .filter((task) => {
        if (!normalized) return true
        return [task.project_name, task.task_name, task.assignee_name, task.work_category]
          .some((value) => String(value || '').toLowerCase().includes(normalized))
      })
      .sort((a, b) => {
        const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority)
        if (priorityDiff !== 0) return priorityDiff
        return new Date(a.due_date || '2999-12-31') - new Date(b.due_date || '2999-12-31')
      })
  }, [marketingTasks, priorityFilter, query])

  const grouped = useMemo(() => {
    const map = new Map(marketingProjectStatuses.map((status) => [status, []]))
    filteredTasks.forEach((task) => {
      const status = marketingProjectStatuses.includes(task.status) ? task.status : 'PREPARING'
      map.get(status).push(task)
    })
    return map
  }, [filteredTasks])

  const delayedCount = marketingTasks.filter(isTaskDelayed).length
  const activeCount = marketingTasks.filter((task) => task.status !== 'DONE').length
  const doneCount = marketingTasks.filter((task) => task.status === 'DONE').length
  const avgProgress = activeCount
    ? Math.round(marketingTasks.filter((task) => task.status !== 'DONE').reduce((sum, task) => sum + taskProgress(task), 0) / activeCount)
    : 100

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const resetNew = () => {
    setSelectedId(null)
    setForm(emptyForm(ownerName, department))
    setMessage('')
  }

  const selectTask = (task) => {
    setSelectedId(task.id)
    setMessage('')
    setForm({
      ...emptyForm(ownerName, department),
      project_name: task.project_name || '',
      task_name: task.task_name || '',
      assignee_name: task.assignee_name || ownerName,
      department: task.department || department || '마케팅팀',
      work_category: task.work_category || '온라인 프로모션',
      priority: task.priority || 'HIGH',
      status: marketingProjectStatuses.includes(task.status) ? task.status : 'PREPARING',
      progress_rate: task.progress_rate ?? defaultProgressForStatus(task.status),
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      today_work: task.today_work || '',
      blocker_text: task.blocker_text || '',
      next_action: task.next_action || '',
      request_text: task.request_text || '',
      source_type: 'MARKETING_PROJECT',
    })
  }

  const save = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      project_name: form.project_name.trim(),
      task_name: form.task_name.trim(),
      assignee_name: form.assignee_name || ownerName,
      department: form.department || department || '마케팅팀',
      source_type: 'MARKETING_PROJECT',
      approval_required: ['REVIEW_1', 'REVIEW_2', 'REVIEW_3'].includes(form.status),
      completed_date: form.status === 'DONE' ? new Date().toISOString().slice(0, 10) : null,
    }

    if (selectedId) {
      await updateExecutiveRecord('work-tasks', selectedId, payload)
      setMessage('프로젝트가 수정되었습니다.')
    } else {
      await createExecutiveRecord('work-tasks', payload)
      setMessage('마케팅 프로젝트가 등록되었습니다.')
    }
    await load()
  }

  const moveTask = async (task, status) => {
    await updateExecutiveRecord('work-tasks', task.id, {
      status,
      progress_rate: defaultProgressForStatus(status),
      approval_required: ['REVIEW_1', 'REVIEW_2', 'REVIEW_3'].includes(status),
      completed_date: status === 'DONE' ? new Date().toISOString().slice(0, 10) : null,
    })
    await load()
  }

  const removeTask = async (task) => {
    const ok = window.confirm(`"${task.project_name || task.task_name}" 프로젝트를 삭제할까요?`)
    if (!ok) return
    await deleteExecutiveRecord('work-tasks', task.id)
    if (selectedId === task.id) resetNew()
    await load()
  }

  return (
    <>
      <PageHeader
        title="마케팅 프로젝트 보드"
        description="온라인/오프라인 프로모션을 계약, 준비, 점검, 실행, 검토, 완료 단계로 관리합니다."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">전체 프로젝트</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(marketingTasks.length, '건')}</p>
        </article>
        <article className="rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">진행 프로젝트</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(activeCount, '건')}</p>
        </article>
        <article className="rounded-lg border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">지연/주의</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(delayedCount, '건')}</p>
        </article>
        <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">평균 진행률</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{avgProgress}%</p>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <Panel title={selectedId ? '프로젝트 수정' : '새 프로젝트 등록'} right={message ? <span className="text-xs font-black text-emerald-600">{message}</span> : null}>
          <form onSubmit={save} className="space-y-4">
            <Field label="프로젝트명">
              <input required value={form.project_name} onChange={(e) => setValue('project_name', e.target.value)} placeholder="예: 하이프리 오프라인 프로모션" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
            </Field>
            <Field label="핵심 업무">
              <input required value={form.task_name} onChange={(e) => setValue('task_name', e.target.value)} placeholder="예: 매장 계약서 확인 및 행사 동선 점검" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="담당자">
                <input value={form.assignee_name} onChange={(e) => setValue('assignee_name', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              </Field>
              <Field label="구분">
                <select value={form.work_category} onChange={(e) => setValue('work_category', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="상태">
                <select value={form.status} onChange={(e) => {
                  setValue('status', e.target.value)
                  setValue('progress_rate', defaultProgressForStatus(e.target.value))
                }} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                  {marketingProjectStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
                </select>
              </Field>
              <Field label="우선순위">
                <select value={form.priority} onChange={(e) => setValue('priority', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                  {priorityOptions.map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작일">
                <input type="date" value={form.start_date || ''} onChange={(e) => setValue('start_date', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              </Field>
              <Field label="마감일">
                <input type="date" value={form.due_date || ''} onChange={(e) => setValue('due_date', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              </Field>
            </div>
            <Field label={`진행률 ${form.progress_rate}%`}>
              <input type="range" min="0" max="100" step="5" value={form.progress_rate} onChange={(e) => setValue('progress_rate', Number(e.target.value))} className="w-full accent-sky-500" />
            </Field>
            <Field label="오늘 진행 내용">
              <textarea rows="3" value={form.today_work} onChange={(e) => setValue('today_work', e.target.value)} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-sky-400" />
            </Field>
            <Field label="막힘 이슈">
              <textarea rows="3" value={form.blocker_text} onChange={(e) => setValue('blocker_text', e.target.value)} placeholder="계약 지연, 소재 미승인, 예산 미확정 등" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-sky-400" />
            </Field>
            <Field label="다음 액션">
              <textarea rows="3" value={form.next_action} onChange={(e) => setValue('next_action', e.target.value)} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-sky-400" />
            </Field>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetNew} className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">새 프로젝트</button>
              <button type="submit" className="h-11 rounded-lg bg-sky-500 px-6 text-sm font-black text-white hover:bg-sky-600">{selectedId ? '수정 저장' : '등록'}</button>
            </div>
          </form>
        </Panel>

        <Panel
          title="프로젝트 우선순위"
          right={(
            <div className="flex flex-wrap items-center gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트, 업무, 담당자 검색" className="h-10 w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-sky-400">
                <option value="ALL">전체 우선순위</option>
                {priorityOptions.map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
              </select>
            </div>
          )}
        >
          {filteredTasks.length === 0 ? (
            <EmptyState message="등록된 마케팅 프로젝트가 없습니다." />
          ) : (
            <div className="space-y-3">
              {filteredTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <button type="button" onClick={() => selectTask(task)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-black text-slate-950">{task.project_name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{task.task_name} · {task.assignee_name || '담당자 미정'} · {task.due_date || '마감일 미정'}</p>
                  </button>
                  <div className="w-40 shrink-0">
                    <ProgressBar value={taskProgress(task)} tone={isTaskDelayed(task) ? 'rose' : 'sky'} />
                  </div>
                  <span className="shrink-0 text-sm font-black text-slate-700">{taskProgress(task)}%</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="overflow-x-auto pb-4">
        <div className="grid min-w-[1400px] grid-cols-8 gap-4">
          {marketingProjectStatuses.map((status) => {
            const rows = grouped.get(status) || []
            return (
              <section key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-900">{taskStatusLabels[status]}</h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">{rows.length}</span>
                </div>
                <div className="space-y-3">
                  {rows.map((task) => (
                    <ProjectCard key={task.id} task={task} onEdit={selectTask} onDelete={removeTask} onMove={moveTask} />
                  ))}
                  {rows.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white py-8 text-center text-xs font-bold text-slate-400">
                      대기 중인 프로젝트 없음
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </>
  )
}
