export const paymentTypeLabels = {
  EXPENSE_APPROVAL: '지출결의서',
  PURCHASE: '구매 요청',
  AD_BUDGET: '광고비 집행',
  PRODUCTION_PREPAYMENT: '생산비 선금',
  OUTSOURCING: '외주비',
  LOGISTICS: '물류비',
  TAX: '세금/공과금',
  INFLOW_EXPECTED: '입금 예정',
  REFUND: '환불/취소',
  ETC: '기타',
}

export const paymentStatusLabels = {
  DRAFT: '작성중',
  SUBMITTED: '제출',
  REVIEWING: '검토중',
  APPROVED: '승인',
  CASH_APPLIED: '현금흐름 반영',
  PAID: '지급 완료',
  RECEIVED: '입금 완료',
  REJECTED: '반려',
  HOLD: '보류',
}

export function paymentStatusClass(status) {
  if (status === 'REJECTED') return 'border-rose-400/30 bg-rose-400/15 text-rose-100'
  if (['SUBMITTED', 'REVIEWING', 'HOLD'].includes(status)) return 'border-amber-400/30 bg-amber-400/15 text-amber-100'
  if (['CASH_APPLIED', 'PAID', 'RECEIVED', 'APPROVED'].includes(status)) return 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
  return 'border-slate-500/30 bg-slate-500/15 text-slate-200'
}

export function flowTypeLabel(value) {
  return value === 'INFLOW' ? '입금' : '출금'
}

export function flowTypeClass(value) {
  return value === 'INFLOW'
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
    : 'border-rose-400/30 bg-rose-400/15 text-rose-100'
}
