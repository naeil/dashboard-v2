import { authApi as api } from './authApi'

export const getMenuConfig = () =>
  api.get('/settings/integrations/menu-config')

export const saveMenuConfig = (config) =>
  api.put('/settings/integrations/menu-config', config)

export const getLoginBranding = () =>
  api.get('/settings/login-branding')

export const saveLoginBranding = (image) =>
  api.put('/settings/login-branding', { image })
