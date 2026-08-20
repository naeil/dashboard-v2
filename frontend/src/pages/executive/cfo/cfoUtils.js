import { won, pct } from '../formatters'

// null = "계산 불가/데이터 없음" — 0으로 왜곡하지 않는다.
export const fmtWon = (value) => (value == null ? '데이터 없음' : won(value))
export const fmtPct = (value) => (value == null ? '—' : pct(value))
export const fmtCount = (value, suffix = '') =>
  value == null ? '—' : `${Math.round(Number(value)).toLocaleString('ko-KR')}${suffix}`

export const changeOf = (current, previous) => {
  const prev = Number(previous)
  const cur = Number(current)
  if (previous == null || current == null || !prev) return null
  return ((cur - prev) * 100) / Math.abs(prev)
}

export const signClass = (value) =>
  value == null ? 'text-slate-400' : Number(value) < 0 ? 'text-rose-600' : 'text-slate-950'
