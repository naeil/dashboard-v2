import { authApi as api } from './authApi'

export const getKpiConfig = () => api.get('/kpi/config').then((r) => r.data)
export const saveKpiConfig = (payload) => api.put('/kpi/config', payload).then((r) => r.data)

export const getKpiAssignments = () => api.get('/kpi/assignments').then((r) => r.data)
export const saveKpiAssignments = (rows) => api.put('/kpi/assignments', { rows }).then((r) => r.data)

export const getKpiTargets = (fromMonth, toMonth) =>
  api.get('/kpi/targets', { params: { fromMonth, toMonth } }).then((r) => r.data)
export const saveKpiTargets = (rows) => api.put('/kpi/targets', { rows }).then((r) => r.data)

export const getKpiPerformance = (periodType, anchor) =>
  api.get('/kpi/performance', { params: { periodType, anchor } }).then((r) => r.data)
