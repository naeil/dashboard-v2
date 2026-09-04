import { authApi as api } from './authApi'

/* 직원 명부 · 인사카드 */
export const getRoster = () => api.get('/hr/roster').then((r) => r.data)
export const getHrCard = (id) => api.get(`/hr/card/${id}`).then((r) => r.data)
export const saveHrCard = (id, payload) => api.post(`/hr/card/${id}`, payload).then((r) => r.data)

/* 휴가 · 연차 */
export const getMyLeave = () => api.get('/hr/leave/my').then((r) => r.data)
export const submitLeave = (payload) => api.post('/hr/leave', payload).then((r) => r.data)
export const getLeaveInbox = () => api.get('/hr/leave/inbox').then((r) => r.data)
export const getLeaveAll = () => api.get('/hr/leave/all').then((r) => r.data)
export const actOnLeave = (id, action, comment) =>
  api.post(`/hr/leave/${id}/act`, { action, comment }).then((r) => r.data)
