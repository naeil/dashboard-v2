import { authApi as api } from './authApi'

const companyParams = { companyId: 1 }

export const getStaffWorkReports = (params = {}) =>
  api.get('/staff/work-reports', { params: { ...companyParams, ...params } })

export const createStaffWorkReport = (payload) =>
  api.post('/staff/work-reports', payload, { params: companyParams })

export const updateStaffWorkReport = (id, payload) =>
  api.put(`/staff/work-reports/${id}`, payload)

export const deleteStaffWorkReport = (id) =>
  api.delete(`/staff/work-reports/${id}`)

export const getStaffTaskCategories = () =>
  api.get('/staff/task-categories', { params: companyParams })

export const createStaffTaskCategory = (payload) =>
  api.post('/staff/task-categories', payload, { params: companyParams })

export const updateStaffTaskCategory = (id, payload) =>
  api.put(`/staff/task-categories/${id}`, payload)

export const deleteStaffTaskCategory = (id) =>
  api.delete(`/staff/task-categories/${id}`)

export const getStaffTodayAttendance = () =>
  api.get('/staff/attendance/today', { params: companyParams })

export const getStaffAttendance = (params = {}) =>
  api.get('/staff/attendance', { params: { ...companyParams, ...params } })

export const getStaffAdminAttendance = (params = {}) =>
  api.get('/staff/attendance/admin', { params: { ...companyParams, ...params } })

export const clockStaffAttendance = (action) =>
  api.post('/staff/attendance/clock', { action }, { params: companyParams })

export const updateStaffAttendanceLocation = (id, payload) =>
  api.put(`/staff/attendance/admin/${id}/location`, payload, { params: companyParams })

export const getWorkReportFeedback = (reportId) =>
  api.get(`/staff/work-reports/${reportId}/feedback`)

export const createWorkReportFeedback = (reportId, payload) =>
  api.post(`/staff/work-reports/${reportId}/feedback`, payload)

export const updateWorkReportFeedback = (id, payload) =>
  api.put(`/staff/work-reports/feedback/${id}`, payload)

export const deleteWorkReportFeedback = (id) =>
  api.delete(`/staff/work-reports/feedback/${id}`)
