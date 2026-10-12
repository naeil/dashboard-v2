import { authApi as api } from './authApi'

export const searchPlayAutoProducts = (params) =>
  api.get('/playauto-products', { params }).then((r) => r.data)

export const getPlayAutoProduct = (olShopNo) =>
  api.get(`/playauto-products/${olShopNo}`).then((r) => r.data)

export const checkProductClaims = (payload) =>
  api.post('/playauto-products/check-claims', payload).then((r) => r.data)

export const editPlayAutoProduct = (payload) =>
  api.put('/playauto-products/edit', payload).then((r) => r.data)
