import { authApi as api } from './authApi'

export const getControlTowerOverview = () =>
  api.get('/control-tower/overview').then((r) => r.data)

export const saveReorderLeadDays = (productId, days) =>
  api.put('/control-tower/lead-days', { productId, days }).then((r) => r.data)
