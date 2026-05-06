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

  const response = await fetch(input, { ...init, headers })
  if (response.status === 401) {
    clearAuthToken()
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }

  return response
}

const authApi = axios.create({ baseURL: API_BASE_PATH })

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
    body: JSON.stringify({ username, password }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || '로그인에 실패했습니다.')
  }

  setAuthToken(body.token)
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

export { authApi }
