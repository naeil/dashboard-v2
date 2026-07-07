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


// Excel upload / template download

export const uploadSalesExcel = (file, companyId = 1, createdBy) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`${BASE}/sales/upload`, formData, {
          params: { companyId, createdBy },
          headers: { 'Content-Type': 'multipart/form-data' },
    })
}

export const downloadSalesTemplate = () =>
    api.get(`${BASE}/sales/template`, { responseType: 'blob' })

export const uploadAdCostExcel = (file, companyId = 1, createdBy) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`${BASE}/ad-costs/upload`, formData, {
          params: { companyId, createdBy },
          headers: { 'Content-Type': 'multipart/form-data' },
    })
}

export const downloadAdCostTemplate = () =>
    api.get(`${BASE}/ad-costs/template`, { responseType: 'blob' })

export const uploadInventoryExcel = (file, companyId = 1, createdBy) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`${BASE}/inventory/upload`, formData, {
          params: { companyId, createdBy },
          headers: { 'Content-Type': 'multipart/form-data' },
    })
}

export const downloadInventoryTemplate = () =>
    api.get(`${BASE}/inventory/template`, { responseType: 'blob' })

export const uploadOtherCostExcel = (file, companyId = 1, createdBy) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`${BASE}/other-costs/upload`, formData, {
          params: { companyId, createdBy },
          headers: { 'Content-Type': 'multipart/form-data' },
    })
}

export const downloadOtherCostTemplate = () =>
    api.get(`${BASE}/other-costs/template`, { responseType: 'blob' })
