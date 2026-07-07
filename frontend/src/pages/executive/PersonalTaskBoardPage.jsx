import { useEffect, useState, createElement as h } from 'react'
import {
    getPersonalTasks,
    createPersonalTask,
    updatePersonalTask,
    movePersonalTask,
    deletePersonalTask,
} from '../../api/personalTaskApi'

const COLUMNS = [
  { id: 'INBOX', label: 'Inbox', hint: '생각나는 순간 5초 안에 기록하세요', color: 'bg-slate-50' },
  { id: 'TODAY', label: '오늘 반드시 끝낼 일', hint: '최대 5개만 노출됩니다', color: 'bg-sky-50' },
  { id: 'WAITING', label: 'Waiting', hint: '남에게 맡겼거나 회신을 기다리는 일', color: 'bg-amber-50' },
  { id: 'DONE', label: 'Done', hint: '오늘 끝낸 업무가 자동으로 기록됩니다', color: 'bg-emerald-50' },
  ]

const TODAY_LIMIT = 5

function formatDateTime(value) {
    if (!value) return ''
    try {
          return new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
          return value
    }
}

export default function PersonalTaskBoardPage({ displayName, username }) {
    const [tasks, setTasks] = useState([])
    const [newContent, setNewContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [savingId, setSavingId] = useState(null)

  const createdBy = displayName || username || 'unknown'

  function extractErrorMessage(err, fallback) {
        return err && err.response && err.response.data && err.response.data.message
          ? err.response.data.message
                : fallback
  }

  async function loadTasks() {
        setLoading(true)
        setError('')
        try {
                const res = await getPersonalTasks()
                setTasks(res.data || [])
        } catch (err) {
                setError('업무 목록을 불러오지 못했습니다. 백엔드가 아직 배포되지 않았을 수 있습니다.')
        } finally {
                setLoading(false)
        }
  }

  useEffect(() => {
        loadTasks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addInboxTask(event) {
        event.preventDefault()
        const content = newContent.trim()
        if (!content) return
        setError('')
        try {
                await createPersonalTask({ content, category: 'INBOX' }, 1, createdBy)
                setNewContent('')
                loadTasks()
        } catch (err) {
                setError(extractErrorMessage(err, '업무를 등록하지 못했습니다.'))
        }
  }

  async function moveTask(task, category) {
        setError('')
        setSavingId(task.id)
        try {
                await movePersonalTask(task.id, category)
                await loadTasks()
        } catch (err) {
                setError(extractErrorMessage(err, '업무 상태를 변경하지 못했습니다.'))
        } finally {
                setSavingId(null)
        }
  }

  async function removeTask(task) {
        setError('')
        setSavingId(task.id)
        try {
                await deletePersonalTask(task.id)
                await loadTasks()
        } catch (err) {
                setError(extractErrorMessage(err, '업무를 삭제하지 못했습니다.'))
        } finally {
                setSavingId(null)
        }
  }

  async function saveMemo(task, memo) {
        try {
                await updatePersonalTask(task.id, { content: task.content, memo })
                loadTasks()
        } catch (err) {
                setError(extractErrorMessage(err, '메모를 저장하지 못했습니다.'))
        }
  }

  const byCategory = (categoryId) => tasks.filter((task) => task.category === categoryId)
    const todayTasks = byCategory('TODAY')

  function actionButton(label, onClick, tone) {
        const toneClass = tone === 'danger'
          ? 'text-rose-500 hover:text-rose-600'
                : tone === 'primary'
            ? 'text-sky-600 hover:text-sky-700'
                  : 'text-slate-500 hover:text-slate-700'
        return h('button', {
                type: 'button',
                onClick: onClick,
                className: 'text-xs font-bold ' + toneClass,
        }, label)
  }

  function taskCard(task) {
        const isSaving = savingId === task.id
        const buttons = []

              if (task.category !== 'TODAY') {
                      buttons.push(actionButton('오늘 할 일로', () => moveTask(task, 'TODAY'), 'primary'))
              }
        if (task.category !== 'WAITING') {
                buttons.push(actionButton('Waiting로', () => moveTask(task, 'WAITING'), 'default'))
        }
        if (task.category !== 'DONE') {
                buttons.push(actionButton('완료', () => moveTask(task, 'DONE'), 'primary'))
        } else {
                buttons.push(actionButton('되돌리기', () => moveTask(task, 'TODAY'), 'default'))
        }
        if (task.category !== 'INBOX') {
                buttons.push(actionButton('Inbox로', () => moveTask(task, 'INBOX'), 'default'))
        }
        buttons.push(actionButton('삭제', () => removeTask(task), 'danger'))

      const doneLine = task.category === 'DONE' && task.doneAt
          ? h('p', { className: 'mt-1 text-[11px] font-bold text-emerald-600' }, '완료 - ' + formatDateTime(task.doneAt))
              : null

      const memoInput = h('input', {
              className: 'mt-2 w-full rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-500',
              placeholder: '메모 (담당자, 상황 등)',
              defaultValue: task.memo || '',
              onBlur: (event) => {
                        const value = event.target.value
                        if (value !== (task.memo || '')) saveMemo(task, value)
              },
      })

      return h('div', {
              key: task.id,
              className: 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm ' + (isSaving ? 'opacity-50' : ''),
      },
                     h('p', { className: 'text-sm font-bold text-slate-900' }, task.content),
                     doneLine,
                     memoInput,
                     h('div', { className: 'mt-2 flex flex-wrap gap-3' }, ...buttons)
                   )
  }

  function column(col) {
        const items = byCategory(col.id)
        const isToday = col.id === 'TODAY'
        const countLabel = isToday ? (items.length + '/' + TODAY_LIMIT) : (items.length + '건')

      const quickAddForm = col.id === 'INBOX'
          ? h('form', { onSubmit: addInboxTask, className: 'mt-3 flex gap-2' },
                        h('input', {
                                      className: 'flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm',
                                      placeholder: '떠오르는 일을 바로 입력하세요',
                                      value: newContent,
                                      onChange: (event) => setNewContent(event.target.value),
                        }),
                        h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-white' }, '기록')
                      )
              : null

      const listBody = items.length === 0
          ? h('p', { className: 'text-xs text-slate-400' }, '항목이 없습니다.')
              : items.map(taskCard)

      return h('div', { key: col.id, className: 'flex min-h-[320px] flex-col rounded-xl border border-slate-200 ' + col.color + ' p-4' },
                     h('div', { className: 'flex items-center justify-between' },
                               h('h2', { className: 'text-sm font-black text-slate-900' }, col.label),
                               h('span', { className: 'text-xs font-black text-slate-500' }, countLabel)
                             ),
                     h('p', { className: 'mt-1 text-[11px] text-slate-500' }, col.hint),
                     quickAddForm,
                     h('div', { className: 'mt-3 flex-1 space-y-2 overflow-y-auto' }, listBody)
                   )
  }

  const warningBanner = todayTasks.length >= TODAY_LIMIT
      ? h('p', { className: 'text-xs font-bold text-amber-600' }, '오늘 할 일이 ' + TODAY_LIMIT + '개로 가득 찼습니다. 먼저 완료하거나 다른 상태로 옮겨주세요.')
        : null

  const errorBanner = error
      ? h('div', { className: 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600' }, error)
        : null

  const boardBody = loading
      ? h('p', { className: 'text-sm text-slate-400' }, '불러오는 중...')
        : h('div', { className: 'grid grid-cols-1 gap-4 md:grid-cols-4' }, ...COLUMNS.map(column))

  return h('div', { className: 'space-y-6' },
               h('div', null,
                       h('p', { className: 'text-xs font-black uppercase tracking-[0.2em] text-sky-600' }, '대표 홈 · CEO 전략 대시보드'),
                       h('h1', { className: 'mt-1 text-2xl font-black text-slate-950' }, '개인 업무 관리'),
                       h('p', { className: 'mt-2 text-sm text-slate-500' }, 'Inbox에 빠르게 기록하고, 오늘 할 일은 최대 5개까지만 관리하세요. 남에게 맡긴 일은 Waiting에서, 끝낸 일은 Done에서 자동으로 확인할 수 있습니다.')
                     ),
               errorBanner,
               boardBody,
               warningBanner
             )
}
