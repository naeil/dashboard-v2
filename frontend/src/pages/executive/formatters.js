export const won = (value) => `${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}원`

export const count = (value, suffix = '') => `${Math.round(Number(value ?? 0)).toLocaleString('ko-KR')}${suffix}`

export const pct = (value) => `${Number(value ?? 0).toFixed(1)}%`

export const riskClass = (value) => {
  if (['위험', '회수 필요', 'CRITICAL', 'HIGH', 'DELAYED', 'LOW_MARGIN'].includes(value)) {
    return 'border-rose-500/30 bg-rose-500/15 text-rose-200'
  }
  if (['주의', 'WATCH', 'LOW_STOCK', 'OVER_STOCK', 'EXPECTED', 'SCHEDULED', 'CONSERVATIVE'].includes(value)) {
    return 'border-amber-400/30 bg-amber-400/15 text-amber-100'
  }
  return 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
}

export const statusLabel = (value) => {
  const labels = {
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
