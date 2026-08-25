import { authApi as api } from './authApi'

const companyParams = { companyId: 1 }

/** 일별 입·출고 이력 */
export const getInventoryFlow = (params = {}) =>
  api.get('/executive/inventory-flow', { params: { ...companyParams, ...params } }).then((r) => r.data)

/** 재고 예측 (소진 속도 기반) */
export const getInventoryForecast = (params = {}) =>
  api.get('/executive/inventory-forecast', { params: { ...companyParams, ...params } }).then((r) => r.data)
