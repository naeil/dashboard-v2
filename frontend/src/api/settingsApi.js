import { authApi as api } from './authApi'

export const getMenuConfig = () =>
  api.get('/settings/integrations/menu-config')

export const saveMenuConfig = (config) =>
  api.put('/settings/integrations/menu-config', config)
