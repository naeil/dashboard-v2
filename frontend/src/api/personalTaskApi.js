import { authApi as api } from './authApi'

const BASE = '/personal-tasks'

export const getPersonalTasks = (companyId = 1, date) =>
        api.get(BASE, { params: date ? { companyId, date } : { companyId } })

export const getPersonalTaskHistoryDates = (companyId = 1) =>
        api.get(`${BASE}/dates`, { params: { companyId } })

export const createPersonalTask = (payload, companyId = 1, createdBy) =>
        api.post(BASE, payload, { params: { companyId, createdBy } })

export const updatePersonalTask = (id, payload, companyId = 1) =>
        api.put(`${BASE}/${id}`, payload, { params: { companyId } })

export const movePersonalTask = (id, category, companyId = 1) =>
        api.put(`${BASE}/${id}/category`, { category }, { params: { companyId } })

export const deletePersonalTask = (id, companyId = 1) =>
        api.delete(`${BASE}/${id}`, { params: { companyId } })
