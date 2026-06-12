import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  deleteExecutiveRecord,
  getExecutiveProductForecasts,
  getExecutiveWorkTasks,
  updateExecutiveRecord,
} from '../../api/executiveApi'
import { EmptyState, Panel } from './ExecutiveComponents'
import { count } from './formatters'
import { isTaskDelayed, taskCategories, taskPriorityLabels, taskProgress, taskStatusClass, taskStatusLabels } from './workTaskUtils'

const statusOptions = ['WAITING', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED', 'DELAYED', 'HOLD']
const priorityOptions = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

const commerceChannels = [
  { id: 'smartstore', name: '스마트스토어', url: 'https://sell.smartstore.naver.com/', hint: '주문, 정산, 상품 노출 점검' },
  { id: 'imweb', name: '공식몰(아임웹)', url: 'https://admin.imweb.me/', hint: '주문, 회원, 쿠폰, 상세페이지 점검' },
  { id: 'coupang', name: '쿠팡 판매자', url: 'https://wing.coupang.com/', hint: '주문, 배송, 상품 판매 상태 점검' },
  { id: 'auction', name: '옥션/G마켓 ESM', url: 'https://www.esmplus.com/', hint: '오픈마켓 주문, 클레임, 상품 점검' },
  { id: 'elevenst', name: '11번가 셀러', url: 'https://soffice.11st.co.kr/', hint: '주문, 배송, 상품 판매 상태 점검' },
]

const dailyReportFields = [
  { key: 'today_work', label: '오늘 할 일', tone: 'rose', placeholder: '오늘 처리할 업무를 우선순위대로 적어주세요.' },
  { key: 'blocker_text', label: '막힘 이슈', tone: 'amber', placeholder: '진행을 막고 있는 이슈, 필요한 결정, 리스크를 적어주세요.' },
  { key: 'next_action', label: '다음 액션', tone: 'sky', placeholder: '다음 담당자, 다음 단계, 후속 조치를 적어주세요.' },
  { key: 'request_text', label: '요청사항', tone: 'emerald', placeholder: '상사나 다른 부서에 요청할 내용을 적어주세요.' },
]

const toneClasses = {
  rose: 'text-rose-600 border-rose-200 bg-rose-50',
  amber: 'text-amber-700 border-amber-200 bg-amber-50',
  sky: 'text-sky-600 border-sky-200 bg-sky-50',
  emerald: 'text-emerald-700 border-emerald-200 bg-emerald-50',
}

const emptyForm = (username, department) => ({
  project_name: '',
  task_name: '',
  assignee_name: username || '',
  department: department || '',
  work_category: 'NPD',
  linked_product_name: '',
  priority: 'MEDIUM',
  status: 'IN_PROGRESS',
  progress_rate: 0,
  start_date: '',
  due_date: '',
  today_work: '',
  blocker_text: '',
  next_action: '',
  request_text: '',
})

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(2, Math.min(100, Number(value || 0)))}%` }} />
    </div>
  )
}

function TaskCard({ task, active, onSelect, onDelete }) {
  const progress = taskProgress(task)
  const delayed = isTaskDelayed(task)

  return (
    <article className={`rounded-lg border p-4 transition-colors ${active ? 'border-sky-300 bg-sky-50' : delayed ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-black text-slate-950">{task.task_name || '업무명 없음'}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">{task.project_name || '미지정 프로젝트'} · {task.due_date || '마감일 미정'}</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${taskStatusClass(task.status)}`}>
            {delayed ? '지연' : taskStatusLabels[task.status] || task.status}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
            title="업무 삭제"
            aria-label="업무 삭제"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
      <button type="button" onClick={onSelect} className="mt-3 block w-full text-left">
        <div className="mb-1 flex justify-between text-[11px] font-black text-slate-500">
          <span>진행률</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </button>
      {task.review_comment && (
        <button type="button" onClick={onSelect} className="mt-3 block w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs font-bold leading-5 text-amber-700">
          상사 피드백: {task.review_comment}
        </button>
      )}
    </article>
  )
}

function ChannelOperationsPanel({ credentials = [] }) {
  return (
    <Panel title="채널 운영" right={<span className="text-xs font-black text-slate-500">온라인 MD 판매 점검</span>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {commerceChannels.map((channel) => {
          const saved = credentials.find((row) => row.channel_id === channel.id)
          return (
            <article key={channel.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">{channel.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{channel.hint}</p>
                  {saved?.username && <p className="mt-2 truncate text-xs font-bold text-sky-600">ID: {saved.username}</p>}
                </div>
                <a href={channel.url} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-sky-500 px-3 text-xs font-black text-white hover:bg-sky-600">
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  이동
                </a>
              </div>
            </article>
          )
        })}
      </div>
    </Panel>
  )
}

function DailyReportGrid({ form, setValue }) {
  return (
    <section className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between border-t border-slate-200 pt-5">
        <div>
          <h3 className="text-base font-black text-slate-950">업무 일일 보고</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">각 항목을 오른쪽 방향으로 한 번에 작성합니다.</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {dailyReportFields.map((field) => (
          <label key={field.key} className="block">
            <span className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${toneClasses[field.tone]}`}>
              ▷ {field.label}
            </span>
            <textarea
              value={form[field.key]}
              onChange={(e) => setValue(field.key, e.target.value)}
              rows="9"
              placeholder={field.placeholder}
              className="min-h-[190px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
        ))}
      </div>
    </section>
  )
}

export default function WorkInputPage({ username = 'admin', displayName, department, positionName }) {
  const [tasks, setTasks] = useState([])
  const [products, setProducts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [form, setForm] = useState(() => emptyForm(displayName || username, department))

  const load = async () => {
    const [taskRes, productRes] = await Promise.all([
      getExecutiveWorkTasks(),
      getExecutiveProductForecasts(),
    ])
    setTasks(taskRes.data || [])
    setProducts(productRes.data || [])
    setLastSyncedAt(new Date())
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const ownerName = displayName || username
  const ownerKeys = useMemo(
    () => [username, displayName].filter(Boolean).map((value) => String(value).trim().replace(/\s+/g, '').toLowerCase()),
    [displayName, username],
  )
  const myTasks = useMemo(
    () => tasks.filter((task) => ownerKeys.includes(String(task.assignee_name || '').trim().replace(/\s+/g, '').toLowerCase())),
    [ownerKeys, tasks],
  )
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedId), [selectedId, tasks])
  const projectNames = useMemo(() => Array.from(new Set(myTasks.map((task) => task.project_name || '미지정 프로젝트'))), [myTasks])
  const delayedTasks = myTasks.filter((task) => isTaskDelayed(task) || task.status === 'BLOCKED')

  const resetNew = (projectName = form.project_name) => {
    setSelectedId(null)
    setForm({ ...emptyForm(ownerName, department), project_name: projectName || '' })
  }

  const selectTask = (task) => {
    setSelectedId(task.id)
    setMessage('')
    setForm({
      project_name: task.project_name || '',
      task_name: task.task_name || '',
      assignee_name: task.assignee_name || ownerName,
      department: task.department || department || '',
      work_category: task.work_category || 'NPD',
      linked_product_name: task.linked_product_name || '',
      priority: task.priority || 'MEDIUM',
      status: task.status || 'IN_PROGRESS',
      progress_rate: task.progress_rate || 0,
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      today_work: task.today_work || '',
      blocker_text: task.blocker_text || '',
      next_action: task.next_action || '',
      request_text: task.request_text || '',
    })
  }

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const save = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      project_name: form.project_name.trim(),
      task_name: form.task_name.trim(),
      assignee_name: form.assignee_name || ownerName,
      department: form.department || department || '',
      approval_required: form.status === 'REVIEW',
      completed_date: form.status === 'DONE' ? new Date().toISOString().slice(0, 10) : null,
    }

    if (selectedTask) {
      await updateExecutiveRecord('work-tasks', selectedTask.id, payload)
      setMessage('업무가 수정되었습니다.')
    } else {
      await createExecutiveRecord('work-tasks', payload)
      setMessage('새 업무가 등록되었습니다.')
    }
    await load()
  }

  const deleteTask = async (task = selectedTask) => {
    if (!task) return
    const ok = window.confirm(`"${task.task_name || '선택한 업무'}" 업무를 삭제할까요?`)
    if (!ok) return

    await deleteExecutiveRecord('work-tasks', task.id)
    setMessage('업무가 삭제되었습니다.')
    if (selectedId === task.id) resetNew(task.project_name || form.project_name)
    await load()
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{[department, ownerName].filter(Boolean).join(' / ')}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">{positionName ? `${positionName} · ` : ''}개인 업무를 등록, 수정, 삭제하고 진행 상태를 관리합니다.</p>
        </div>
        <button type="button" onClick={load} className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">
          {lastSyncedAt ? `동기화 ${lastSyncedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '동기화'}
        </button>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-black text-slate-500">내 업무</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(myTasks.length, '건')}</p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
          <p className="text-xs font-black text-slate-500">진행 업무</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(myTasks.filter((task) => task.status !== 'DONE').length, '건')}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-black text-slate-500">지연/막힘</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{count(delayedTasks.length, '건')}</p>
        </div>
        <button type="button" onClick={() => resetNew()} className="rounded-lg border border-sky-200 bg-sky-50 p-5 text-left text-sky-700 hover:bg-sky-100">
          <p className="text-xs font-black">새 업무</p>
          <p className="mt-3 text-lg font-black">업무 추가</p>
        </button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[400px_1fr]">
        <Panel title="내 업무 목록" right={<span className="text-xs font-black text-slate-500">카드 우측 휴지통으로 즉시 삭제</span>}>
          <div className="space-y-3">
            {myTasks.length === 0 ? (
              <EmptyState message="아직 등록된 업무가 없습니다." />
            ) : myTasks.map((task) => (
              <TaskCard key={task.id} task={task} active={selectedId === task.id} onSelect={() => selectTask(task)} onDelete={() => deleteTask(task)} />
            ))}
          </div>
        </Panel>

        <Panel title={selectedTask ? '업무 수정' : '새 업무 등록'} right={message ? <span className="text-xs font-black text-emerald-600">{message}</span> : null}>
          {selectedTask?.review_comment && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700">
              상사 피드백: {selectedTask.review_comment}
            </div>
          )}
          <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="프로젝트명">
              <input required list="my-projects" value={form.project_name} onChange={(e) => setValue('project_name', e.target.value)} placeholder="프로젝트명을 입력하거나 기존 프로젝트를 선택" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              <datalist id="my-projects">{projectNames.map((project) => <option key={project} value={project} />)}</datalist>
            </Field>
            <Field label="업무명">
              <input required value={form.task_name} onChange={(e) => setValue('task_name', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
            </Field>
            <Field label="담당자">
              <input value={form.assignee_name} onChange={(e) => setValue('assignee_name', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
            </Field>
            <Field label="부서">
              <input value={form.department} onChange={(e) => setValue('department', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
            </Field>
            <Field label="업무 카테고리">
              <select value={form.work_category} onChange={(e) => setValue('work_category', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                {taskCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="연결 제품">
              <select value={form.linked_product_name} onChange={(e) => setValue('linked_product_name', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                <option value="">없음</option>
                {products.map((product) => <option key={product.id} value={product.product_name}>{product.product_name}</option>)}
              </select>
            </Field>
            <Field label="상태">
              <select value={form.status} onChange={(e) => setValue('status', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                {statusOptions.map((status) => <option key={status} value={status}>{taskStatusLabels[status] || status}</option>)}
              </select>
            </Field>
            <Field label="우선순위">
              <select value={form.priority} onChange={(e) => setValue('priority', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                {priorityOptions.map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority] || priority}</option>)}
              </select>
            </Field>
            <Field label={`진행률 ${form.progress_rate}%`}>
              <input type="range" min="0" max="100" step="5" value={form.progress_rate} onChange={(e) => setValue('progress_rate', Number(e.target.value))} className="w-full accent-sky-500" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작일">
                <input type="date" value={form.start_date || ''} onChange={(e) => setValue('start_date', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              </Field>
              <Field label="마감일">
                <input type="date" value={form.due_date || ''} onChange={(e) => setValue('due_date', e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400" />
              </Field>
            </div>
            <DailyReportGrid form={form} setValue={setValue} />
            <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
              <button type="button" onClick={() => resetNew(form.project_name)} className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">새 업무로 전환</button>
              <button type="submit" className="h-11 rounded-lg bg-sky-500 px-6 text-sm font-black text-white hover:bg-sky-600">{selectedTask ? '수정 저장' : '업무 등록'}</button>
            </div>
          </form>
        </Panel>
      </section>
    </>
  )
}
