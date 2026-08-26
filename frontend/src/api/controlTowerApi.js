import { authApi as api } from './authApi'

export const getControlTowerOverview = () =>
  api.get('/control-tower/overview').then((r) => r.data)

export const getWeekPlan = (weekStart) =>
  api.get('/control-tower/week-plan', { params: weekStart ? { weekStart } : {} }).then((r) => r.data)

export const saveReorderLeadDays = (productId, days) =>
  api.put('/control-tower/lead-days', { productId, days }).then((r) => r.data)

export const createControlTask = (payload) =>
  api.post('/control-tower/task', payload).then((r) => r.data)

export const updateControlTask = (id, payload) =>
  api.put(`/control-tower/task/${id}`, payload).then((r) => r.data)
