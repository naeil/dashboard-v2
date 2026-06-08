export const won = (value) => `${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}원`

export const count = (value, suffix = '') => `${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}${suffix}`

export const pct = (value) => `${Number(value ?? 0).toFixed(1)}%`

export const riskClass = (value) => {
  if (['위험', '회수 필요', 'CRITICAL', 'HIGH', 'DELAYED', 'LOW_MARGIN', 'OVERDUE'].includes(value)) {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  if (['주의', 'WATCH', 'LOW_STOCK', 'OVER_STOCK', 'EXPECTED', 'SCHEDULED', 'CONSERVATIVE', 'PARTIAL'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (['PAUSED', 'PENDING'].includes(value)) {
    return 'border-slate-200 bg-slate-50 text-slate-600'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export const statusLabel = (value) => {
  const labels = {
    ACTIVE: '거래중',
    PENDING: '검토중',
    PAUSED: '보류',
    ENDED: '종료',
    NORMAL: '정상',
    WATCH: '주의',
    HIGH: '위험',
    CRITICAL: '회수 필요',
    EXPECTED: '예정',
    SCHEDULED: '예정',
    CONFIRMED: '확정',
    CONSERVATIVE: '보수적',
    MONTHLY: '매월',
    WEEKLY: '매주',
    NONE: '없음',
    OVERDUE: '연체',
    PARTIAL: '부분 입금',
    DONE: '완료',
    DELAYED: '지연',
    CANCELLED: '취소',
    LOW_STOCK: '재고 부족',
    OVER_STOCK: '재고 과다',
    LOW_MARGIN: '마진 낮음',
    OPEN: '진행중',
    IN_PROGRESS: '처리중',
    RESOLVED: '완료',
    FIXED: '고정비',
    VARIABLE: '변동비',
  }
  return labels[value] || value || '-'
}
