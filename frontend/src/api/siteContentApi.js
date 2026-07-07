import { authApi as api } from './authApi'
import { buildApiUrl } from './apiBase'

// Public (no login required) — used on the login page before sign-in
export const getPublicNotices = async (companyId = 1) => {
  const response = await fetch(buildApiUrl(`/public/notices?companyId=${companyId}`))
  if (!response.ok) throw new Error('공지사항을 불러오지 못했습니다.')
  return response.json()
}

export const getPublicLoginBanner = async (companyId = 1) => {
  const response = await fetch(buildApiUrl(`/public/login-banner?companyId=${companyId}`))
  if (!response.ok) throw new Error('배너 이미지를 불러오지 못했습니다.')
  return response.json()
}

// Authenticated — used from the platform admin console ("로그인 화면 관리")
export const listNotices = (companyId = 1) => api.get('/notices', { params: { companyId } })

export const createNotice = (payload, companyId = 1, createdBy) =>
  api.post('/notices', payload, { params: { companyId, createdBy } })

export const updateNotice = (id, payload, companyId = 1) =>
  api.put(`/notices/${id}`, payload, { params: { companyId } })

export const deleteNotice = (id, companyId = 1) =>
  api.delete(`/notices/${id}`, { params: { companyId } })

export const updateLoginBanner = (imageData, companyId = 1, updatedBy) =>
  api.put('/login-banner', { imageData }, { params: { companyId, updatedBy } })
