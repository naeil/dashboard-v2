import axios from 'axios'
import { API_BASE_PATH, buildApiUrl } from './apiBase'

const AUTH_TOKEN_KEY = 'dashboard_auth_token'

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token) {
  if (!token) return
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getAuthHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authorizedFetch(input, init = {}) {
  const headers = new Headers(init.headers || {})
  const authHeaders = getAuthHeaders()

  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value))

  const response = await fetch(input, { ...init, headers, credentials: 'include' })
  if (response.status === 401) {
    clearAuthToken()
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }

  return response
}

const authApi = axios.create({ baseURL: API_BASE_PATH, withCredentials: true })

authApi.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthToken()
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export const login = async (username, password) => {
  const response = await fetch(buildApiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ loginId: username, password }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || '로그인에 실패했습니다.')
  }

  setAuthToken(body.token)
  return body
}

export const registerWithInvite = async ({ inviteCode, username, password }) => {
  const response = await fetch(buildApiUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ inviteCode, username, password }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || '가입에 실패했습니다.')
  }

  setAuthToken(body.token)
  return body
}

export const previewInvite = async (inviteCode) => {
  const response = await fetch(buildApiUrl(`/auth/invites/preview?inviteCode=${encodeURIComponent(inviteCode)}`))
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || '초대 정보를 확인하지 못했습니다.')
  }
  return body
}

export const getSession = async () => {
  const response = await authorizedFetch(buildApiUrl('/auth/session'))
  if (!response.ok) {
    throw new Error('세션 확인에 실패했습니다.')
  }

  return response.json()
}

export const logout = async () => {
  try {
    await authorizedFetch(buildApiUrl('/auth/logout'), { method: 'POST' })
  } finally {
    clearAuthToken()
  }
}

export const getUsers = () => authApi.get('/auth/users')
export const getInvites = () => authApi.get('/auth/invites')
export const createInvite = (payload) => authApi.post('/auth/invites', payload)
export const changePassword = (payload) => authApi.post('/auth/password', payload)
export const resetUserPassword = (id, payload) => authApi.post(`/auth/users/${id}/password`, payload)
export const deleteUser = (id) => authApi.delete(`/auth/users/${id}`)
export const updateMenuPermissions = (id, sections) =>
  authApi.post(`/auth/users/${id}/menu-permissions`, { sections: JSON.stringify(sections) })

export { authApi }
