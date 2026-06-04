import { authApi as api } from './authApi'

const BASE = '/executive/product-costs'

export const getAllCostData    = (companyId = 1) =>
  api.get(BASE, { params: { companyId } })

export const getChannelProducts = (channelName, companyId = 1) =>
  api.get(`${BASE}/channel/${encodeURIComponent(channelName)}`, { params: { companyId } })

export const uploadCostExcel = (file, companyId = 1) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`${BASE}/upload-excel`, formData, {
    params: { companyId },
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const saveChannelProduct = (payload, companyId = 1) =>
  api.post(`${BASE}/channel-product`, payload, { params: { companyId } })

export const updateChannelProduct = (id, payload, companyId = 1) =>
  api.put(`${BASE}/channel-product/${id}`, payload, { params: { companyId } })

export const deleteChannelProduct = (id, companyId = 1) =>
  api.delete(`${BASE}/channel-product/${id}`, { params: { companyId } })

export const saveSku = (payload, companyId = 1) =>
  api.post(`${BASE}/sku`, payload, { params: { companyId } })

export const updateSku = (id, payload, companyId = 1) =>
  api.put(`${BASE}/sku/${id}`, payload, { params: { companyId } })

export const deleteSku = (id, companyId = 1) =>
  api.delete(`${BASE}/sku/${id}`, { params: { companyId } })

export const saveLogisticsFee = (payload, companyId = 1) =>
  api.post(`${BASE}/logistics-fee`, payload, { params: { companyId } })

export const deleteLogisticsFee = (id, companyId = 1) =>
  api.delete(`${BASE}/logistics-fee/${id}`, { params: { companyId } })
