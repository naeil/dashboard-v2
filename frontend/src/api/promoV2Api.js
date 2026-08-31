import { authApi as api } from './authApi'

const BASE = '/promo-v2'

/** 채널 기본 비용조건 (수수료/광고/판관/배송단가) */
export const getChannelDefaults = () => api.get(`${BASE}/channel-defaults`).then((r) => r.data)

/** 상품 검색 (상품마스터 + 원가 참조) */
export const searchPromoProducts = (q) =>
  api.get(`${BASE}/products`, { params: q ? { q } : {} }).then((r) => r.data)

/** 행사 목록 (month=YYYY-MM, brand, channel 필터) */
export const listPromoEvents = (params = {}) =>
  api.get(`${BASE}/events`, { params }).then((r) => r.data)

/** 행사 단건 (블록/옵션 포함) */
export const getPromoEvent = (id) => api.get(`${BASE}/events/${id}`).then((r) => r.data)

/** 행사 생성 */
export const createPromoEvent = (payload) =>
  api.post(`${BASE}/events`, payload).then((r) => r.data)

/** 행사 수정 */
export const updatePromoEvent = (id, payload) =>
  api.put(`${BASE}/events/${id}`, payload).then((r) => r.data)

/** 상태 변경 (기획/진행중/종료/취소) */
export const updatePromoStatus = (id, status) =>
  api.patch(`${BASE}/events/${id}/status`, { status }).then((r) => r.data)

/** 행사 삭제 */
export const deletePromoEvent = (id) => api.delete(`${BASE}/events/${id}`).then((r) => r.data)

/** 행사 기간 내 매핑 상품 실시간 매출 (직연동 orders 기준) */
export const getPromoRealtime = (id) => api.get(`${BASE}/events/${id}/realtime`).then((r) => r.data)

/** 여러 행사 실시간 매출 일괄 조회 — 목록/상태보드 BPE 달성률 표시용 */
export const getPromoRealtimeBatch = (ids) =>
  api.get(`${BASE}/events/realtime-batch`, { params: { ids: ids.join(',') } }).then((r) => r.data)
