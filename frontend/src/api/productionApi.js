import { authApi as api } from './authApi'

export const getSuppliers = () => api.get('/production/suppliers').then((r) => r.data)
export const saveSupplier = (payload) => api.post('/production/suppliers', payload).then((r) => r.data)

export const getProductionOrders = (status) =>
  api.get('/production/orders', { params: status ? { status } : {} }).then((r) => r.data)
export const getProductionOrderItems = (id) =>
  api.get(`/production/orders/${id}/items`).then((r) => r.data)
export const createProductionOrder = (payload) =>
  api.post('/production/orders', payload).then((r) => r.data)
export const receiveProductionOrder = (id, receivedDate) =>
  api.post(`/production/orders/${id}/receive`, { receivedDate }).then((r) => r.data)
export const cancelProductionOrder = (id) =>
  api.post(`/production/orders/${id}/cancel`, {}).then((r) => r.data)

export const getCostTrend = () => api.get('/production/cost-trend').then((r) => r.data)
export const getProductionConfig = () => api.get('/production/config').then((r) => r.data)
export const saveProductionConfig = (payload) => api.put('/production/config', payload).then((r) => r.data)
export const getProductionSummary = () => api.get('/production/summary').then((r) => r.data)
