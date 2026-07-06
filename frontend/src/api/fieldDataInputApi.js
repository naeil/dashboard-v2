import { authApi as api } from './authApi'

const BASE = '/field-input'

// Sales
export const getSalesEntries = (companyId = 1) =>
  api.get(`${BASE}/sales`, { params: { companyId } })

export const createSalesEntry = (payload, companyId = 1, createdBy) =>
  api.post(`${BASE}/sales`, payload, { params: { companyId, createdBy } })

export const updateSalesEntry = (id, payload, companyId = 1) =>
  api.put(`${BASE}/sales/${id}`, payload, { params: { companyId } })

export const deleteSalesEntry = (id, companyId = 1) =>
  api.delete(`${BASE}/sales/${id}`, { params: { companyId } })

// Ad cost
export const getAdCostEntries = (companyId = 1) =>
  api.get(`${BASE}/ad-costs`, { params: { companyId } })

export const createAdCostEntry = (payload, companyId = 1, createdBy) =>
  api.post(`${BASE}/ad-costs`, payload, { params: { companyId, createdBy } })

export const updateAdCostEntry = (id, payload, companyId = 1) =>
  api.put(`${BASE}/ad-costs/${id}`, payload, { params: { companyId } })

export const deleteAdCostEntry = (id, companyId = 1) =>
  api.delete(`${BASE}/ad-costs/${id}`, { params: { companyId } })

// Inventory / order
export const getInventoryEntries = (companyId = 1) =>
  api.get(`${BASE}/inventory`, { params: { companyId } })

export const createInventoryEntry = (payload, companyId = 1, createdBy) =>
  api.post(`${BASE}/inventory`, payload, { params: { companyId, createdBy } })

export const updateInventoryEntry = (id, payload, companyId = 1) =>
  api.put(`${BASE}/inventory/${id}`, payload, { params: { companyId } })

export const deleteInventoryEntry = (id, companyId = 1) =>
  api.delete(`${BASE}/inventory/${id}`, { params: { companyId } })

// Other cost
export const getOtherCostEntries = (companyId = 1) =>
  api.get(`${BASE}/other-costs`, { params: { companyId } })

export const createOtherCostEntry = (payload, companyId = 1, createdBy) =>
  api.post(`${BASE}/other-costs`, payload, { params: { companyId, createdBy } })

export const updateOtherCostEntry = (id, payload, companyId = 1) =>
  api.put(`${BASE}/other-costs/${id}`, payload, { params: { companyId } })

export const deleteOtherCostEntry = (id, companyId = 1) =>
  api.delete(`${BASE}/other-costs/${id}`, { params: { companyId } })

// L1/L2 summary
export const getFieldDataSummary = (startDate, endDate, companyId = 1) =>
  api.get(`${BASE}/summary`, { params: { companyId, startDate, endDate } })
