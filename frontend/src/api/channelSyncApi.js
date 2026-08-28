import { buildApiUrl } from './apiBase'
import { getAuthToken } from './authApi'

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ==================== 자격증명 관리 ====================

export async function getChannelCredentials() {
  const res = await fetch(buildApiUrl('/channel-sync/credentials'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch channel credentials')
  return res.json()
}

export async function saveChannelCredentials(channelType, payload) {
  const res = await fetch(buildApiUrl(`/channel-sync/credentials/${channelType}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to save channel credentials')
  return res.json()
}

// ==================== 동기화 ====================

export async function syncAllChannels(month) {
  const url = buildApiUrl(`/channel-sync/sync/all${month ? `?month=${month}` : ''}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to sync all channels')
  return res.json()
}

export async function syncChannel(channelType, month) {
  const url = buildApiUrl(`/channel-sync/sync/${channelType}${month ? `?month=${month}` : ''}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to sync channel: ${channelType}`)
  return res.json()
}

// ==================== 일별 매출 수집 (CFO/CEO 대시보드 연동) ====================

function dailyRangeQuery(from, to) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function syncDailyAll(from, to) {
  const res = await fetch(buildApiUrl(`/channel-sync/sync-daily/all${dailyRangeQuery(from, to)}`), {
    method: 'POST',
    headers: authHeaders(),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || 'Failed to run daily sync')
  return body
}

export async function syncDailyChannel(channelType, from, to) {
  const res = await fetch(buildApiUrl(`/channel-sync/sync-daily/${channelType}${dailyRangeQuery(from, to)}`), {
    method: 'POST',
    headers: authHeaders(),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || `Failed to run daily sync: ${channelType}`)
  return body
}

// ==================== 오프라인 발주 시트 (서버 직접 수집) ====================

export async function getOfflineSheetConfig() {
  const res = await fetch(buildApiUrl('/channel-sync/offline-sheet/config'), { headers: authHeaders() })
  if (!res.ok) throw new Error('오프라인 시트 설정 조회 실패')
  return res.json()
}

export async function saveOfflineSheetConfig(sheetUrl) {
  const res = await fetch(buildApiUrl('/channel-sync/offline-sheet/config'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ sheetUrl }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message || '오프라인 시트 설정 저장 실패')
  return body
}

export async function pullOfflineSheet() {
  const res = await fetch(buildApiUrl('/channel-sync/offline-sheet/pull'), {
    method: 'POST',
    headers: authHeaders(),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message || '오프라인 시트 수집 실패')
  return body
}
