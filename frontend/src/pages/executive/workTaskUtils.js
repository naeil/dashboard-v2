export const taskStatusLabels = {
  WAITING: '대기',
  IN_PROGRESS: '진행중',
  REVIEW: '검토요청',
  DONE: '완료',
  BLOCKED: '막힘',
  DELAYED: '지연',
  HOLD: '보류',
  CONTRACT: '계약',
  PREPARING: '준비',
  CHECKING: '점검',
  EXECUTING: '실행',
  REVIEW_1: '1차검토',
  REVIEW_2: '2차검토',
  REVIEW_3: '3차검토',
}

export const taskPriorityLabels = {
  URGENT: '긴급',
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export const taskCategories = [
  'NPD',
  '생산',
  '마케팅',
  '마케팅 프로젝트',
  '오프라인 프로모션',
  '온라인 프로모션',
  '디자인',
  '영업',
  '채널 운영',
  '재고',
  '수출',
  '운영',
  '회계',
]

export const marketingProjectStatuses = [
  'CONTRACT',
  'PREPARING',
  'CHECKING',
  'EXECUTING',
  'REVIEW_1',
  'REVIEW_2',
  'REVIEW_3',
  'DONE',
]

export function taskStatusClass(status) {
  if (['DELAYED', 'BLOCKED'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (['REVIEW', 'HOLD', 'WAITING', 'CONTRACT', 'PREPARING', 'CHECKING'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'DONE') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

export function taskPriorityClass(priority) {
  if (priority === 'URGENT') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (priority === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (priority === 'LOW') return 'border-slate-200 bg-slate-50 text-slate-500'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

export function isTaskDelayed(task) {
  if (['DONE', 'HOLD'].includes(task.status)) return false
  if (task.status === 'DELAYED') return true
  if (!task.due_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${String(task.due_date).slice(0, 10)}T00:00:00`)
  return due < today
}

export function taskProgress(task) {
  if (task.status === 'DONE') return 100
  return Math.max(0, Math.min(100, Number(task.progress_rate || 0)))
}
