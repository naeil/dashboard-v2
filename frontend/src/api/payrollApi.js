import { authApi as api } from './authApi'

export const getPayrollMonths = () =>
  api.get('/payroll/months')

export const getPayrollRecords = (payYearMonth) =>
  api.get('/payroll', { params: payYearMonth ? { payYearMonth } : {} })

export const uploadPayrollExcel = (file, payYearMonth) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('payYearMonth', payYearMonth)
  return api.post('/payroll/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const sendPayslips = (payYearMonth) =>
  api.post('/payroll/send', null, { params: { payYearMonth } })

export const updateUserEmail = (userId, email) =>
  api.post(`/payroll/users/${userId}/email`, null, { params: { email } })
