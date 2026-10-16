import { authApi as api } from './authApi'

// 상담·미팅 기록 (전화 상담 · 줌 · 대면 미팅)
export const getContactLogs = (params = {}) =>
  api.get('/contact-logs', { params }).then((r) => r.data)

export const createContactLog = (body) =>
  api.post('/contact-logs', body).then((r) => r.data)

export const updateContactLog = (id, body) =>
  api.put(`/contact-logs/${id}`, body).then((r) => r.data)

export const setContactLogStatus = (id, status) =>
  api.patch(`/contact-logs/${id}/status`, { status }).then((r) => r.data)

export const deleteContactLog = (id) =>
  api.delete(`/contact-logs/${id}`).then((r) => r.data)
