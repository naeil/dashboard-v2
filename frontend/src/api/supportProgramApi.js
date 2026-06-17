import { authApi as api } from './authApi'

const BASE = '/support-programs'
const companyId = 1

export const getSupportProgramList = () =>
  api.get(BASE, { params: { companyId } })

export const getSupportProgramKpi = () =>
  api.get(`${BASE}/kpi`, { params: { companyId } })

export const createSupportProgram = (payload) =>
  api.post(BASE, { companyId, company_id: companyId, ...payload })

export const updateSupportProgram = (id, payload) =>
  api.put(`${BASE}/${id}`, payload)

export const deleteSupportProgram = (id) =>
  api.delete(`${BASE}/${id}`)
