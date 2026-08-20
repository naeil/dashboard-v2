import { authApi as api } from './authApi'

// CFO 재무관리 API — companyId 는 서버가 인증 사용자 기준으로 강제하므로 보내지 않는다.

export const getCfoSummary = (params = {}) => api.get('/executive/cfo/summary', { params })
export const getCfoProfitStatement = (params = {}) => api.get('/executive/cfo/profit-statement', { params })
export const getCfoProductProfitability = (params = {}) => api.get('/executive/cfo/product-profitability', { params })
export const getCfoChannelProfitability = (params = {}) => api.get('/executive/cfo/channel-profitability', { params })
export const getCfoExpenses = (params = {}) => api.get('/executive/cfo/expenses', { params })
export const getCfoCashflowForecast = () => api.get('/executive/cfo/cashflow-forecast')
export const getCfoReceivablesPayables = () => api.get('/executive/cfo/receivables-payables')
export const getCfoDebts = () => api.get('/executive/cfo/debts')
export const getCfoBudgets = (params = {}) => api.get('/executive/cfo/budgets', { params })
export const saveCfoBudget = (payload) => api.post('/executive/cfo/budgets', payload)
export const deleteCfoBudget = (id) => api.delete(`/executive/cfo/budgets/${id}`)
export const saveCfoRecurringExpense = (payload) => api.post('/executive/cfo/recurring-expenses', payload)
export const deleteCfoRecurringExpense = (id) => api.delete(`/executive/cfo/recurring-expenses/${id}`)
export const addCfoFeeHistory = (payload) => api.post('/executive/cfo/fee-history', payload)
export const getCfoCostHistory = () => api.get('/executive/cfo/cost-history')
export const addCfoCostHistory = (payload) => api.post('/executive/cfo/cost-history', payload)
export const getCfoAlerts = () => api.get('/executive/cfo/alerts')
export const updateCfoAlert = (id, payload) => api.patch(`/executive/cfo/alerts/${id}`, payload)

export const uploadCfoCsv = (type, file, dryRun = true) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/executive/cfo/upload/${type}`, formData, {
    params: { dryRun },
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
