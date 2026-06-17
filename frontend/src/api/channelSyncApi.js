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
