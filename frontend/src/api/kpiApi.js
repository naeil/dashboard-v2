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

/* v2: 팀 가중치 · 정성 평가 · 마감/확정 · 지급 대장 */
export const getKpiTeams = () => api.get('/kpi/teams').then((r) => r.data)
export const saveKpiTeams = (rows) => api.put('/kpi/teams', { rows }).then((r) => r.data)

export const getKpiScores = (periodKey) =>
  api.get('/kpi/scores', { params: { periodKey } }).then((r) => r.data)
export const saveKpiScores = (periodKey, rows) =>
  api.put('/kpi/scores', { periodKey, rows }).then((r) => r.data)

export const kpiClose = (periodType, anchor) =>
  api.post('/kpi/close', { periodType, anchor }).then((r) => r.data)
export const kpiConfirm = (periodType, anchor, memo) =>
  api.post('/kpi/confirm', { periodType, anchor, memo }).then((r) => r.data)
export const kpiReopen = (periodType, anchor) =>
  api.post('/kpi/reopen', { periodType, anchor }).then((r) => r.data)

export const adjustKpiPayout = (id, adjustAmount, reason) =>
  api.put(`/kpi/payout/${id}`, { adjustAmount, reason }).then((r) => r.data)

export const getKpiHistory = () => api.get('/kpi/history').then((r) => r.data)

export const getKpiUnmappedProducts = (periodType, anchor) =>
  api.get('/kpi/unmapped-products', { params: { periodType, anchor } }).then((r) => r.data)
