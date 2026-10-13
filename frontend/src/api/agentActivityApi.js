import { authApi as api } from './authApi'

export const getAgentOverview = (limit = 50) =>
  api.get('/agent/activities', { params: { limit } }).then((r) => r.data)

export const getAgentControlRoom = () =>
  api.get('/agent/control-room').then((r) => r.data)

export const approveAgentActivity = (id, comment) =>
  api.post(`/agent/activities/${id}/approve`, { comment }).then((r) => r.data)

export const handleAgentActivity = (id, comment) =>
  api.post(`/agent/activities/${id}/handle`, { comment }).then((r) => r.data)

export const rejectAgentActivity = (id, comment) =>
  api.post(`/agent/activities/${id}/reject`, { comment }).then((r) => r.data)
