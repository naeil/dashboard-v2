import { authApi as api } from './authApi'

// AI 공동구매 — 셀러별 조건 판단(승인·수수료·일정)과 일정별 할 일
export const getGroupBuys = (params = {}) =>
  api.get('/group-buys', { params }).then((r) => r.data)

export const getGroupBuySchedule = (params = {}) =>
  api.get('/group-buys/schedule', { params }).then((r) => r.data)

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

export const deleteGroupBuyEvent = (eventId) =>
  api.delete(`/group-buys/events/${eventId}`).then((r) => r.data)
