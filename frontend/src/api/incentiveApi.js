import { buildApiUrl } from './apiBase'
import { getAuthToken } from './authApi'

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ==================== 온라인 성과 ====================

export async function getOnlinePerformances(month) {
  const url = buildApiUrl(`/incentives/online${month ? `?month=${month}` : ''}`)
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch online performances')
  return res.json()
}

export async function createOnlinePerformance(data) {
  const res = await fetch(buildApiUrl('/incentives/online'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create online performance')
  return res.json()
}

export async function updateOnlinePerformance(id, data) {
  const res = await fetch(buildApiUrl(`/incentives/online/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update online performance')
  return res.json()
}

export async function deleteOnlinePerformance(id) {
  const res = await fetch(buildApiUrl(`/incentives/online/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete online performance')
}

// ==================== 거래처 성과 ====================

export async function getClientPerformances(month) {
  const url = buildApiUrl(`/incentives/clients${month ? `?month=${month}` : ''}`)
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch client performances')
  return res.json()
}

export async function createClientPerformance(data) {
  const res = await fetch(buildApiUrl('/incentives/clients'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create client performance')
  return res.json()
}

export async function updateClientPerformance(id, data) {
  const res = await fetch(buildApiUrl(`/incentives/clients/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update client performance')
  return res.json()
}

export async function deleteClientPerformance(id) {
  const res = await fetch(buildApiUrl(`/incentives/clients/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete client performance')
}

// ==================== 직원별 예상 인센티브 요약 ====================

export async function getIncentiveSummary(month) {
  const url = buildApiUrl(`/incentives/summary${month ? `?month=${month}` : ''}`)
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch incentive summary')
  return res.json()
}

export async function patchIncentiveSummaryStatus(id, status) {
  const res = await fetch(buildApiUrl(`/incentives/summary/${id}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Failed to update incentive summary status')
  return res.json()
}

// ==================== KPI ====================

export async function getIncentiveKpi(month) {
  const url = buildApiUrl(`/incentives/kpi${month ? `?month=${month}` : ''}`)
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch incentive KPI')
  return res.json()
}
