const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const normalizedApiBaseUrl = rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : ''

export const API_BASE_PATH = normalizedApiBaseUrl ? `${normalizedApiBaseUrl}/api` : '/api'

export function buildApiUrl(path = '') {
  if (!path) {
    return API_BASE_PATH
  }

  return `${API_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`
}
