import { authApi as api } from './authApi'

const companyParams = { companyId: 1 }

export const getCeoDashboard = () => api.get('/executive/ceo-dashboard', { params: companyParams })
export const getCeoFinancials = () => api.get('/executive/ceo-financials', { params: companyParams })
export const saveCeoFinancials = (payload) => api.post('/executive/ceo-financials', payload, { params: companyParams })
export const getExecutiveSummary = () => api.get('/executive/summary', { params: companyParams })
export const getExecutiveMonthlySales = () => api.get('/executive/monthly-sales', { params: companyParams })
export const getExecutiveCashFlow = () => api.get('/executive/cash-flow', { params: companyParams })
export const importOnlineSettlements = (params = {}) =>
  api.post('/executive/cash-flow/import-online-settlements', null, { params: { ...companyParams, ...params } })
export const getExecutiveProductProfits = () => api.get('/executive/product-profits', { params: companyParams })
export const getExecutiveProductMovements = () => api.get('/executive/product-movements', { params: companyParams })
export const syncPlayAutoProductMovements = () =>
  api.post('/executive/product-movements/sync-playauto', null, { params: companyParams })
export const getExecutiveProductForecasts = () => api.get('/executive/product-forecasts', { params: companyParams })
export const getExecutiveWorkTasks = () => api.get('/executive/work-tasks', { params: companyParams })
export const getChannelCredentials = () => api.get('/executive/channel-credentials', { params: companyParams })
export const saveChannelCredential = (payload) =>
  api.post('/executive/channel-credentials', payload, { params: companyParams })
export const getExecutivePaymentRequests = () => api.get('/executive/payment-requests', { params: companyParams })
export const approvePaymentRequest = (id) => api.post(`/executive/payment-requests/${id}/approve`)
export const getExecutiveChannelSales = () => api.get('/executive/channel-sales', { params: companyParams })
export const getExecutiveConsultingRevenues = () => api.get('/executive/consulting-revenues', { params: companyParams })
export const getExecutiveChannelSalesAnalytics = (params = {}) =>
  api.get('/executive/channel-sales/analytics', { params: { ...companyParams, ...params } })
export const importPlayAutoChannelSales = (params = {}) =>
  api.post('/executive/channel-sales/import-playauto', null, {
    params: { ...companyParams, refreshOrders: true, ...params },
  })
export const getExecutiveReceivables = () => api.get('/executive/receivables', { params: companyParams })
export const getExecutivePartners = () => api.get('/executive/partners', { params: companyParams })
export const getExecutiveOperatingExpenses = () => api.get('/executive/operating-expenses', { params: companyParams })
export const getExecutiveDebts = () => api.get('/executive/debts', { params: companyParams })
export const getExecutiveExportPipeline = () => api.get('/executive/export-pipeline', { params: companyParams })
export const getExecutiveExportSupplyPrices = () => api.get('/executive/export-supply-prices', { params: companyParams })
export const getExecutiveAdPerformance = () => api.get('/executive/ad-performance', { params: companyParams })
export const getExecutiveAdRoasGoals = () => api.get('/executive/ad-roas-goals', { params: companyParams })
export const getExecutiveIssues = () => api.get('/executive/issues', { params: companyParams })
export const getExecutiveIssueBriefing = () => api.get('/executive/issue-briefing', { params: companyParams })
export const getExecutiveCustomerInquiries = () => api.get('/executive/customer-inquiries', { params: companyParams })
export const getExecutiveCustomerDatabase = (params = {}) => api.get('/executive/customer-db', { params: { ...companyParams, ...params } })
export const syncPlayAutoCustomerDatabase = () =>
  api.post('/executive/customer-db/sync-playauto', null, { params: companyParams })
export const searchKeywordTrend = (keyword) =>
  api.get('/marketing/keyword-trend/search', { params: { keyword } })
export const getLinkedMarketingKeywords = (params = {}) =>
  api.get('/marketing/keyword-trend/linked-keywords', { params })
export const getNaverCpcPerformance = (params = {}) =>
  api.get('/marketing/naver-cpc/performance', { params })
export const getMetaAdsPerformance = (params = {}) =>
  api.get('/marketing/meta-ads/performance', { params })
export const getMetaAdsCreatives = (params = {}) =>
  api.get('/marketing/meta-ads/creatives', { params })
export const getMarketingAiAnalysis = (params = {}) =>
  api.get('/marketing/ai-analysis/summary', { params })
export const createMarketingAgentScenario = (payload) =>
  api.post('/marketing/agent/scenario', payload)
export const deployMarketingAgentNaverBlog = (payload) =>
  api.post('/marketing/agent/naver-blog/deploy', payload)

export const getBrandHealth = (params = {}) =>
  api.get('/executive/brand-health', { params: { ...companyParams, ...params } })

export const getProfitManagement = (params = {}) =>
  api.get('/executive/profit-management', { params: { ...companyParams, ...params } })
export const saveProfitPlan = (planMonth, items) =>
  api.post('/executive/profit-management/plan', items, { params: { ...companyParams, planMonth } })

export const createExecutiveRecord = (resource, payload) =>
  api.post(`/executive/${resource}`, { company_id: 1, ...payload })

export const updateExecutiveRecord = (resource, id, payload) =>
  api.put(`/executive/${resource}/${id}`, payload)

export const deleteExecutiveRecord = (resource, id) =>
  api.delete(`/executive/${resource}/${id}`)

// ── 직원 성과 AI 분석 API ─────────────────────────────────────────────────
export const getEmployeeDetail = (username) =>
  api.get('/employee-analysis/detail', { params: { ...companyParams, username } })

export const analyzeEmployee = (username, displayName) =>
  api.post('/employee-analysis/analyze', { username, displayName }, { params: companyParams })

export const getEmployeeAnalysisHistory = (username) =>
  api.get('/employee-analysis/history', { params: { ...companyParams, username } })

export const saveEmployeeFeedback = (analysisId, feedback) =>
  api.put(`/employee-analysis/${analysisId}/feedback`, { feedback })

// ── 채널별·제품별 판매 상세 분석 API ─────────────────────────────────────────
export const getSalesDetail = (params = {}) =>
  api.get('/executive/analytics/sales-detail', { params: { ...companyParams, ...params } })

export const getRepurchaseByProduct = (params = {}) =>
  api.get('/executive/analytics/repurchase-by-product', { params: { ...companyParams, ...params } })

export const getChannelProductMatrix = (params = {}) =>
  api.get('/executive/analytics/channel-product-matrix', { params: { ...companyParams, ...params } })
