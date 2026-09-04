import { authApi as api } from './authApi'

/* 지출결의 전자결재 */
export const getApprovers = () => api.get('/payment-approval/approvers').then((r) => r.data)
export const submitPaymentApproval = (payload) => api.post('/payment-approval/submit', payload).then((r) => r.data)
export const getApprovalInbox = () => api.get('/payment-approval/inbox').then((r) => r.data)
export const getMyApprovals = () => api.get('/payment-approval/mine').then((r) => r.data)
export const getApprovalDetail = (id) => api.get(`/payment-approval/${id}`).then((r) => r.data)
export const actOnApproval = (id, action, comment) =>
  api.post(`/payment-approval/${id}/act`, { action, comment }).then((r) => r.data)

/* 알림 */
export const getNotifications = () => api.get('/notifications').then((r) => r.data)
export const getUnreadCount = () => api.get('/notifications/unread-count').then((r) => r.data)
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then((r) => r.data)
export const markAllNotificationsRead = () => api.post('/notifications/read-all').then((r) => r.data)
