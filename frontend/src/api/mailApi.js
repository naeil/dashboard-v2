import { authApi } from './authApi'

export const getMails = ({ page = 0, size = 10 } = {}) =>
  authApi.get('/mail', { params: { page, size } })

export const getMailFolder = ({ folder = 'inbox', page = 0, size = 10 } = {}) =>
  authApi.get('/mail', { params: { folder, page, size } })

export const getMailStatus = ({ validate = false } = {}) =>
  authApi.get('/mail/status', { params: { validate } })

export const connectDaouMail = ({ loginId, password, host }) =>
  authApi.post('/mail/connect', { loginId, password, host })
