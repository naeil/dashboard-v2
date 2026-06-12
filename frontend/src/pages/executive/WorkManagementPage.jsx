import { useEffect, useMemo, useState } from 'react'
import { getExecutiveWorkTasks, updateExecutiveRecord } from '../../api/executiveApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'
import { count } from './formatters'
import { isTaskDelayed, taskPriorityClass, taskPriorityLabels, taskProgress, taskStatusClass, taskStatusLabels } from './workTaskUtils'

function Kpi({ label, value, tone = 'sky' }) {
  const toneMap = {
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  }
  return (
    <article className={`rounded-lg border p-5 shadow-sm ${toneMap[tone] || toneMap.sky}`}>
      <p className="text-xs font-black opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
    </article>
  )
}

function ProgressBar({ value, tone = 'sky' }) {
  const color = tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-400' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-sky-500'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

function StatusPill({ status }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${taskStatusClass(status)}`}>{taskStatusLabels[status] || status}</span>
}

function PriorityPill({ priority }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${taskPriorityClass(priority)}`}>{taskPriorityLabels[priority] || priority}</span>
}

export default function WorkManagementPage() {
  const [tasks, setTasks] = useState([])
  const [selectedAssignee, setSelectedAssignee] = useState('전체')
  const [feedbackDrafts, setFeedbackDrafts] = useState({})
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  const load = () => getExecutiveWorkTasks().then((res) => {
    setTasks(res.data || [])
    setLastSyncedAt(new Date())
  })

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const assignees = useMemo(() => {
    const names = tasks.map((task) => task.assignee_name).filter(Boolean)
    return ['전체', ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))]
  }, [tasks])

  const filteredTasks = useMemo(() => (
    selectedAssignee === '전체' ? tasks : tasks.filter((task) => task.assignee_name === selectedAssignee)
  ), [tasks, selectedAssignee])

  const activeTasks = filteredTasks.filter((task) => task.status !== 'DONE')
  const delayedTasks = filteredTasks.filter((task) => isTaskDelayed(task))
  const blockedTasks = filteredTasks.filter((task) => task.status === 'BLOCKED')
  const reviewTasks = filteredTasks.filter((task) => task.status === 'REVIEW' || task.approval_required)
  const feedbackTasks = filteredTasks.filter((task) => task.review_comment)
  const avgProgress = activeTasks.length
    ? Math.round(activeTasks.reduce((sum, task) => sum + taskProgress(task), 0) / activeTasks.length)
    : 100

  const assigneeSummary = useMemo(() => {
    const grouped = new Map()
    tasks.forEach((task) => {
      const name = task.assignee_name || '미지정'
      const current = grouped.get(name) || { assignee: name, total: 0, active: 0, delayed: 0, blocked: 0, review: 0, done: 0, progressSum: 0 }
      current.total += 1
      current.progressSum += taskProgress(task)
      if (task.status === 'DONE') current.done += 1
      else current.active += 1
      if (isTaskDelayed(task)) current.delayed += 1
      if (task.status === 'BLOCKED') current.blocked += 1
      if (task.status === 'REVIEW' || task.approval_required) current.review += 1
      grouped.set(name, current)
    })
    return Array.from(grouped.values())
      .map((row) => ({ ...row, avgProgress: row.total ? Math.round(row.progressSum / row.total) : 0 }))
      .sort((a, b) => b.delayed - a.delayed || b.blocked - a.blocked || b.active - a.active)
  }, [tasks])

  const projectSummary = useMemo(() => {
    const grouped = new Map()
    tasks.forEach((task) => {
      const project = task.project_name || '미지정 프로젝트'
      const current = grouped.get(project) || { project_name: project, total: 0, active: 0, delayed: 0, done: 0, progressSum: 0 }
      current.total += 1
      current.progressSum += taskProgress(task)
      if (task.status === 'DONE') current.done += 1
      else current.active += 1
      if (isTaskDelayed(task)) current.delayed += 1
      grouped.set(project, current)
    })
    return Array.from(grouped.values())
      .map((row) => ({ ...row, avgProgress: row.total ? Math.round(row.progressSum / row.total) : 0 }))
      .sort((a, b) => b.delayed - a.delayed || a.avgProgress - b.avgProgress)
  }, [tasks])

  const approveTask = async (task) => {
    await updateExecutiveRecord('work-tasks', task.id, {
      status: 'DONE',
      progress_rate: 100,
      approval_required: false,
      completed_date: new Date().toISOString().slice(0, 10),
      review_comment: feedbackDrafts[task.id] || task.review_comment || '관리자 승인 완료',
    })
    await load()
  }

  const saveFeedback = async (task) => {
    await updateExecutiveRecord('work-tasks', task.id, {
      review_comment: feedbackDrafts[task.id] ?? task.review_comment ?? '',
    })
    await load()
  }

  const setFeedback = (taskId, value) => {
    setFeedbackDrafts((prev) => ({ ...prev, [taskId]: value }))
  }

  const riskRows = [...delayedTasks, ...blockedTasks, ...reviewTasks, ...feedbackTasks]
    .filter((task, index, array) => array.findIndex((candidate) => candidate.id === task.id) === index)

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title="업무 진행 관리" description="관리자가 직원별 업무, 지연, 막힘, 승인 대기, 피드백 전달 상태를 확인합니다." />
        <button type="button" onClick={load} className="mb-6 h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 hover:bg-slate-50">
          {lastSyncedAt ? `동기화 ${lastSyncedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '동기화'}
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">전체 업무 상황판</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">위험 업무, 막힌 업무, 승인 대기 업무를 먼저 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {assignees.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedAssignee(name)}
              className={`h-10 rounded-lg border px-4 text-sm font-black transition-colors ${selectedAssignee === name ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <Kpi label="전체 진행률" value={`${avgProgress}%`} tone={avgProgress >= 75 ? 'emerald' : avgProgress >= 45 ? 'amber' : 'rose'} />
        <Kpi label="진행 중 업무" value={count(activeTasks.length, '건')} />
        <Kpi label="지연 업무" value={count(delayedTasks.length, '건')} tone={delayedTasks.length > 0 ? 'rose' : 'emerald'} />
        <Kpi label="막힌 업무" value={count(blockedTasks.length, '건')} tone={blockedTasks.length > 0 ? 'rose' : 'emerald'} />
        <Kpi label="피드백 전달" value={count(feedbackTasks.length, '건')} tone={feedbackTasks.length > 0 ? 'amber' : 'emerald'} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="직원별 업무 현황">
          <DataTable
            rows={assigneeSummary}
            rowKey={(row) => row.assignee}
            searchable={false}
            columns={[
              { key: 'assignee', label: '담당자', render: (row) => <span className="font-black text-slate-950">{row.assignee}</span> },
              { key: 'active', label: '진행', render: (row) => count(row.active, '건') },
              { key: 'delayed', label: '지연', render: (row) => <span className={row.delayed > 0 ? 'font-black text-rose-700' : 'text-slate-500'}>{count(row.delayed, '건')}</span> },
              { key: 'blocked', label: '막힘', render: (row) => <span className={row.blocked > 0 ? 'font-black text-rose-700' : 'text-slate-500'}>{count(row.blocked, '건')}</span> },
              { key: 'review', label: '승인 대기', render: (row) => count(row.review, '건') },
              { key: 'avgProgress', label: '평균 진행률', render: (row) => (
                <div className="min-w-28">
                  <p className="mb-1 text-xs font-black text-slate-600">{row.avgProgress}%</p>
                  <ProgressBar value={row.avgProgress} tone={row.delayed > 0 || row.blocked > 0 ? 'rose' : 'sky'} />
                </div>
              ) },
            ]}
          />
        </Panel>

        <Panel title="프로젝트별 진행률">
          <DataTable
            rows={projectSummary}
            rowKey={(row) => row.project_name}
            searchable={false}
            columns={[
              { key: 'project_name', label: '프로젝트', render: (row) => <span className="font-black text-slate-950">{row.project_name}</span> },
              { key: 'total', label: '업무', render: (row) => count(row.total, '건') },
              { key: 'done', label: '완료', render: (row) => count(row.done, '건') },
              { key: 'delayed', label: '지연', render: (row) => <span className={row.delayed > 0 ? 'font-black text-rose-700' : 'text-slate-500'}>{count(row.delayed, '건')}</span> },
              { key: 'avgProgress', label: '진행률', render: (row) => (
                <div className="min-w-32">
                  <p className="mb-1 text-xs font-black text-slate-600">{row.avgProgress}%</p>
                  <ProgressBar value={row.avgProgress} tone={row.delayed > 0 ? 'rose' : row.avgProgress >= 75 ? 'emerald' : 'amber'} />
                </div>
              ) },
            ]}
          />
        </Panel>
      </section>

      <Panel title="위험 / 승인 대기 / 피드백 업무" right={<span className="text-xs font-black text-slate-500">{riskRows.length}건</span>}>
        <DataTable
          rows={riskRows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'task_name', label: '업무', render: (row) => <span className="font-black text-slate-950">{row.task_name}</span> },
            { key: 'project_name', label: '프로젝트' },
            { key: 'assignee_name', label: '담당자' },
            { key: 'priority', label: '우선순위', render: (row) => <PriorityPill priority={row.priority} /> },
            { key: 'status', label: '상태', render: (row) => <StatusPill status={row.status} /> },
            { key: 'progress_rate', label: '진행률', render: (row) => `${taskProgress(row)}%` },
            { key: 'due_date', label: '마감일' },
            { key: 'blocker_text', label: '막힘 이슈', render: (row) => row.blocker_text || '-' },
            { key: 'review_comment', label: '상사 피드백', render: (row) => (
              <div className="min-w-80">
                <textarea
                  value={feedbackDrafts[row.id] ?? row.review_comment ?? ''}
                  onChange={(event) => setFeedback(row.id, event.target.value)}
                  rows="2"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder="직원에게 전달할 피드백"
                />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => saveFeedback(row)} className="h-8 rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 hover:bg-sky-100">
                    피드백 전달
                  </button>
                  {(row.status === 'REVIEW' || row.approval_required) && (
                    <button type="button" onClick={() => approveTask(row)} className="h-8 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                      완료 승인
                    </button>
                  )}
                </div>
              </div>
            ) },
          ]}
        />
      </Panel>
    </>
  )
}
