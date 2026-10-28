import { authApi as api } from './authApi'

const companyParams = { companyId: 1 }

/** 일별 입·출고 이력 */
export const getInventoryFlow = (params = {}) =>
  api.get('/executive/inventory-flow', { params: { ...companyParams, ...params } }).then((r) => r.data)

/** 재고 예측 (소진 속도 기반) */
export const getInventoryForecast = (params = {}) =>
  api.get('/executive/inventory-forecast', { params: { ...companyParams, ...params } }).then((r) => r.data)

/** 3PL 일일재고표 — 가장 최근 업로드 */
export const getLatestThreePlSnapshot = () =>
  api.get('/executive/inventory-3pl/latest', { params: companyParams }).then((r) => r.data)

/** 3PL 일일재고표 — 업로드 이력 */
export const getThreePlSnapshotHistory = () =>
  api.get('/executive/inventory-3pl/history', { params: companyParams }).then((r) => r.data)

/** 3PL 일일재고표 — 업로드 저장 */
export const saveThreePlSnapshot = (payload) =>
  api.post('/executive/inventory-3pl', payload, { params: companyParams }).then((r) => r.data)
