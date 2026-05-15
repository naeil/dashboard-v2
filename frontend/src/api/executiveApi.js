import { authApi as api } from './authApi'

const companyParams = { companyId: 1 }

export const getExecutiveSummary = () => api.get('/executive/summary', { params: companyParams })
export const getExecutiveMonthlySales = () => api.get('/executive/monthly-sales', { params: companyParams })
export const getExecutiveCashFlow = () => api.get('/executive/cash-flow', { params: companyParams })
export const importOnlineSettlements = (params = {}) =>
  api.post('/executive/cash-flow/import-online-settlements', null, { params: { ...companyParams, ...params } })
export const getExecutiveProductProfits = () => api.get('/executive/product-profits', { params: companyParams })
export const getExecutiveProductForecasts = () => api.get('/executive/product-forecasts', { params: companyParams })
export const getExecutiveChannelSales = () => api.get('/executive/channel-sales', { params: companyParams })
export const getExecutiveConsultingRevenues = () => api.get('/executive/consulting-revenues', { params: companyParams })
export const getExecutiveChannelSalesAnalytics = (params = {}) =>
  api.get('/executive/channel-sales/analytics', { params: { ...companyParams, ...params } })
export const importPlayAutoChannelSales = (params = {}) =>
  api.post('/executive/channel-sales/import-playauto', null, {
    params: { ...companyParams, refreshOrders: true, ...params },
  })
export const getExecutiveReceivables = () => api.get('/executive/receivables', { params: companyParams })
export const getExecutiveOperatingExpenses = () => api.get('/executive/operating-expenses', { params: companyParams })
export const getExecutiveDebts = () => api.get('/executive/debts', { params: companyParams })
export const getExecutiveExportPipeline = () => api.get('/executive/export-pipeline', { params: companyParams })
export const getExecutiveExportSupplyPrices = () => api.get('/executive/export-supply-prices', { params: companyParams })
export const getExecutiveAdPerformance = () => api.get('/executive/ad-performance', { params: companyParams })
export const getExecutiveIssues = () => api.get('/executive/issues', { params: companyParams })
export const searchKeywordTrend = (keyword) =>
  api.get('/marketing/keyword-trend/search', { params: { keyword } })
export const getNaverCpcPerformance = (params = {}) =>
  api.get('/marketing/naver-cpc/performance', { params })
export const getMetaAdsPerformance = (params = {}) =>
  api.get('/marketing/meta-ads/performance', { params })
export const getMarketingAiAnalysis = (params = {}) =>
  api.get('/marketing/ai-analysis/summary', { params })

export const createExecutiveRecord = (resource, payload) =>
  api.post(`/executive/${resource}`, { company_id: 1, ...payload })

export const updateExecutiveRecord = (resource, id, payload) =>
  api.put(`/executive/${resource}/${id}`, payload)

export const deleteExecutiveRecord = (resource, id) =>
  api.delete(`/executive/${resource}/${id}`)
