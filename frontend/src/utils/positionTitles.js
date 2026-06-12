export const CUSTOM_POSITION_VALUE = '__custom_position__'

export const DEFAULT_POSITION_TITLES = ['대표', '관리자', '팀장', '직원']

export function normalizePositionTitle(value) {
  return String(value || '').trim()
}

export function getPositionTitleOptions(users = [], invites = []) {
  const titles = new Set(DEFAULT_POSITION_TITLES)
  ;[...users, ...invites].forEach((item) => {
    const title = normalizePositionTitle(item.position_name ?? item.positionName)
    if (title) titles.add(title)
  })
  return [...titles].sort((a, b) => {
    const indexA = DEFAULT_POSITION_TITLES.indexOf(a)
    const indexB = DEFAULT_POSITION_TITLES.indexOf(b)
    if (indexA !== -1 || indexB !== -1) {
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
    }
    return a.localeCompare(b, 'ko')
  })
}
