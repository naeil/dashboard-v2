import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://naeil-dashboard.onrender.com'
const api = axios.create({ baseURL: `${API_BASE}/api` })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dashboard_auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const syncReviews = (channel) =>
  api.post('/reviews/sync', channel ? { channel } : {})

export const analyzeReview = (reviewId) =>
  api.post('/reviews/analyze', { reviewId })

export const generateReply = (reviewId) =>
  api.post('/reviews/generate-reply', { reviewId })

export const getReviewDashboard = () =>
  api.get('/reviews/dashboard')

export const getVocData = () =>
  api.get('/reviews/voc')

export const getInsights = () =>
  api.get('/reviews/insights')
