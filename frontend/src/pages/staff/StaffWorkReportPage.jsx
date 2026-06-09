import { useEffect, useMemo, useState } from 'react'
import { createStaffWorkReport, deleteStaffWorkReport, getStaffWorkReports, updateStaffWorkReport } from '../../api/staffApi'
import { getExecutiveWorkTasks } from '../../api/executiveApi'

const todayText = () => new Date().toISOString().slice(0, 10)

function startOfWeekText(dateText) {
  const date = new Date(`${dateText}T00:00:00`)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

const emptyForm = {
  report_type: 'DAILY',
  report_date: todayText(),
  week_start_date: startOfWeekText(todayText()),
  title: '',
  completed_work: '',
  planned_work: '',
  blockers: '',
  memo: '',
  status: 'SUBMITTED',
  linked_task_id: '',
  linked_project_name: '',
}

const reportTypeLabels = {
  DAILY: '일일 업무',
  WEEKLY: '주간 업무',
}

function statusBadge(status) {
  return status === 'DRAFT'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export default function StaffWorkReportPage({ username, displayName, onNavigate }) {
  const [reports, setReports] = useState([])
  const [workTasks, setWorkTasks] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const ownerLabel = displayName || username || '실무진'

  const load = async () => {
    setLoading(true)
    try {
      const [response, taskResponse] = await Promise.all([
        getStaffWorkReports(filter === 'ALL' ? {} : { reportType: filter }),
        getExecutiveWorkTasks(),
      ])
      setReports(response.data || [])
      setWorkTasks(taskResponse.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  const summary = useMemo(() => {
    const daily = reports.filter((report) => report.report_type === 'DAILY').length
    const weekly = reports.filter((report) => report.report_type === 'WEEKLY').length
    const blockers = reports.filter((report) => report.blockers).length
    return { daily, weekly, blockers }
  }, [reports])

  const projectNames = useMemo(() => (
    Array.from(new Set(workTasks.map((task) => task.project_name).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  ), [workTasks])

  const linkedProjectTasks = useMemo(() => (
    workTasks
      .filter((task) => form.linked_project_name && task.project_name === form.linked_project_name)
      .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
  ), [form.linked_project_name, workTasks])

  const taskById = useMemo(() => {
    const map = new Map()
    workTasks.forEach((task) => map.set(String(task.id), task))
    return map
  }, [workTasks])

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'report_date') {
        next.week_start_date = startOfWeekText(value)
      }
      return next
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setMessage('')
  }

  const editReport = (report) => {
    setEditingId(report.id)
    setForm({
      report_type: report.report_type || 'DAILY',
      report_date: String(report.report_date || todayText()).slice(0, 10),
      week_start_date: String(report.week_start_date || report.report_date || todayText()).slice(0, 10),
      title: report.title || '',
      completed_work: report.completed_work || '',
      planned_work: report.planned_work || '',
      blockers: report.blockers || '',
      memo: report.memo || '',
      status: report.status || 'SUBMITTED',
      linked_task_id: report.linked_task_id || '',
      linked_project_name: report.linked_project_name || '',
    })
    setMessage('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setMessage('보고 제목을 입력하세요.')
      return
    }

    const payload = {
      ...form,
      week_start_date: form.report_type === 'WEEKLY' ? form.week_start_date : null,
      linked_task_id: form.linked_task_id || null,
      linked_project_name: form.linked_project_name || null,
    }

    if (editingId) {
      await updateStaffWorkReport(editingId, payload)
      setMessage('업무 보고를 수정했습니다.')
    } else {
      await createStaffWorkReport(payload)
      setMessage('업무 보고를 저장했습니다.')
    }
    resetForm()
    await load()
  }

  const removeReport = async (report) => {
    await deleteStaffWorkReport(report.id)
    if (editingId === report.id) resetForm()
    await load()
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-slate-50 p-6">
      <section className="mb-6 border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">{ownerLabel} / 업무 보고</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950">일일 업무 / 주간 업무</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">오늘 한 일, 다음 업무, 막힌 이슈를 누적해서 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
            새로고침
          </button>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">일일 보고</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{summary.daily.toLocaleString('ko-KR')}건</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">주간 보고</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{summary.weekly.toLocaleString('ko-KR')}건</p>
        </article>
        <article className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-black text-rose-700">막힌 이슈 포함</p>
          <p className="mt-3 text-2xl font-black text-rose-700">{summary.blockers.toLocaleString('ko-KR')}건</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">{editingId ? '업무 보고 수정' : '업무 보고 작성'}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="h-9 rounded border border-slate-300 px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                새 보고
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">구분</span>
              <select value={form.report_type} onChange={(event) => setField('report_type', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400">
                <option value="DAILY">일일 업무</option>
                <option value="WEEKLY">주간 업무</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">보고일</span>
              <input type="date" value={form.report_date} onChange={(event) => setField('report_date', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
          </div>

          {form.report_type === 'WEEKLY' && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-black text-slate-500">주간 시작일</span>
              <input type="date" value={form.week_start_date} onChange={(event) => setField('week_start_date', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-black text-slate-500">제목</span>
            <input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="예: 쿠팡 상세페이지 수정 및 재고 점검" className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
          </label>

          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-black text-sky-700">기존 프로젝트 / 일정 연결</p>
              {form.linked_project_name && (
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, linked_project_name: '', linked_task_id: '' }))} className="text-[11px] font-black text-slate-500">
                  연결 해제
                </button>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-slate-500">프로젝트명</span>
              <input
                list="staff-report-project-options"
                value={form.linked_project_name}
                onChange={(event) => setField('linked_project_name', event.target.value)}
                placeholder="기존 프로젝트명을 선택하거나 입력"
                className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-sky-400"
              />
              <datalist id="staff-report-project-options">
                {projectNames.map((project) => <option key={project} value={project} />)}
              </datalist>
            </label>
            {linkedProjectTasks.length > 0 && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-black text-slate-500">연관 일정</span>
                <select
                  value={form.linked_task_id}
                  onChange={(event) => {
                    const task = workTasks.find((item) => String(item.id) === event.target.value)
                    setForm((prev) => ({
                      ...prev,
                      linked_task_id: event.target.value,
                      linked_project_name: task?.project_name || prev.linked_project_name,
                      title: prev.title || task?.task_name || '',
                    }))
                  }}
                  className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-sky-400"
                >
                  <option value="">프로젝트만 연결</option>
                  {linkedProjectTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.task_name} · {String(task.due_date || '마감일 없음').slice(0, 10)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {[
            ['completed_work', '완료 / 진행한 업무'],
            ['planned_work', '다음 액션'],
            ['blockers', '막힌 이슈'],
            ['memo', '메모'],
          ].map(([key, label]) => (
            <label key={key} className="mt-3 block">
              <span className={`mb-1 block text-xs font-black ${key === 'blockers' ? 'text-rose-600' : 'text-slate-500'}`}>{label}</span>
              <textarea
                value={form[key]}
                onChange={(event) => setField(key, event.target.value)}
                rows="4"
                className={`w-full rounded border px-3 py-2 text-sm font-bold outline-none ${
                  key === 'blockers'
                    ? 'border-rose-200 bg-rose-50 text-rose-700 placeholder:text-rose-300 focus:border-rose-400'
                    : 'border-slate-200 focus:border-sky-400'
                }`}
              />
            </label>
          ))}

          <div className="mt-4 grid grid-cols-[1fr_120px] gap-3">
            <select value={form.status} onChange={(event) => setField('status', event.target.value)} className="h-11 rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400">
              <option value="SUBMITTED">제출</option>
              <option value="DRAFT">임시저장</option>
            </select>
            <button type="submit" className="h-11 rounded bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-600">
              저장
            </button>
          </div>
          {message && <p className="mt-3 rounded border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">{message}</p>}
        </form>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-black text-slate-950">보고 내역</h2>
            <div className="flex gap-2">
              {[
                ['ALL', '전체'],
                ['DAILY', '일일'],
                ['WEEKLY', '주간'],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`h-9 rounded border px-3 text-xs font-black ${filter === value ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {reports.map((report) => (
              <article key={report.id} className="p-5 hover:bg-slate-50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">{reportTypeLabels[report.report_type] || report.report_type}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusBadge(report.status)}`}>{report.status === 'DRAFT' ? '임시저장' : '제출'}</span>
                      <span className="text-xs font-bold text-slate-400">{String(report.report_date).slice(0, 10)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-950">{report.title}</h3>
                    {report.linked_project_name && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
                          <span className="material-symbols-outlined text-sm">link</span>
                          {report.linked_project_name}
                        </span>
                        {report.linked_task_id && taskById.get(String(report.linked_task_id)) && (
                          <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                            <span className="truncate">{taskById.get(String(report.linked_task_id)).task_name}</span>
                          </span>
                        )}
                        <button type="button" onClick={() => onNavigate?.('staff-project-status')} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700">
                          프로젝트 현황 열기
                        </button>
                      </div>
                    )}
                    <div className="mt-4 space-y-3">
                      {report.completed_work && (
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                          <p className="text-[11px] font-black text-slate-500">완료 / 진행한 업무</p>
                          <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-700">{report.completed_work}</p>
                        </div>
                      )}
                      {report.planned_work && (
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3">
                          <p className="text-[11px] font-black text-sky-700">다음 액션</p>
                          <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-700">{report.planned_work}</p>
                        </div>
                      )}
                      {report.blockers && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
                          <p className="text-[11px] font-black text-rose-700">막힌 이슈</p>
                          <p className="mt-2 whitespace-pre-line text-sm font-black leading-6 text-rose-700">{report.blockers}</p>
                        </div>
                      )}
                      {!report.completed_work && !report.planned_work && !report.blockers && (
                        <p className="mt-2 text-sm font-bold text-slate-400">내용 없음</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => editReport(report)} className="h-9 rounded border border-slate-300 px-3 text-xs font-black text-slate-600 hover:bg-white">
                      수정
                    </button>
                    <button type="button" onClick={() => removeReport(report)} className="h-9 rounded border border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50">
                      삭제
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {reports.length === 0 && <p className="p-8 text-center text-sm font-bold text-slate-400">아직 작성된 업무 보고가 없습니다.</p>}
          </div>
        </section>
      </section>
    </main>
  )
}
