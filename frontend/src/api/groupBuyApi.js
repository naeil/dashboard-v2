import { authApi as api } from './authApi'

// AI 공동구매 — 셀러별 조건 판단(승인·수수료·일정)과 일정별 할 일
export const getGroupBuys = (params = {}) =>
  api.get('/group-buys', { params }).then((r) => r.data)

export const getGroupBuySchedule = (params = {}) =>
  api.get('/group-buys/schedule', { params }).then((r) => r.data)

// 공용 설정(공급가표·업무 절차·확정 필요 항목) — value 는 JSON 문자열로 저장
export const getGroupBuySettings = () =>
  api.get('/group-buys/settings').then((r) => r.data)

export const saveGroupBuySetting = (key, value) =>
  api.put(`/group-buys/settings/${key}`, { value: JSON.stringify(value) }).then((r) => r.data)

export const createGroupBuy = (body) =>
  api.post('/group-buys', body).then((r) => r.data)

export const updateGroupBuy = (id, body) =>
  api.put(`/group-buys/${id}`, body).then((r) => r.data)

export const decideGroupBuy = (id, body) =>
  api.post(`/group-buys/${id}/decide`, body).then((r) => r.data)

export const setGroupBuyStatus = (id, status) =>
  api.patch(`/group-buys/${id}/status`, { status }).then((r) => r.data)

export const addGroupBuyEvent = (id, body) =>
  api.post(`/group-buys/${id}/events`, body).then((r) => r.data)

export const setGroupBuyEventDone = (eventId, done) =>
  api.patch(`/group-buys/events/${eventId}`, { done }).then((r) => r.data)

// 관제실 '실무진 판단 필요' 카드 판단(승인·진행 중·보류·거절) — 상담·미팅 기록에 자동 기재
export const getStaffDecisions = () =>
  api.get('/staff-decisions').then((r) => r.data)

export const saveStaffDecision = (body) =>
  api.post('/staff-decisions', body).then((r) => r.data)

export const deleteGroupBuyEvent = (eventId) =>
  api.delete(`/group-buys/events/${eventId}`).then((r) => r.data)
