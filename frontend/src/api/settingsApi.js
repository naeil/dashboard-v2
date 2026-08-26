import { authApi as api } from './authApi'

export const getMenuConfig = () =>
  api.get('/settings/integrations/menu-config')

export const saveMenuConfig = (config) =>
  api.put('/settings/integrations/menu-config', config)

export const getLoginBranding = () =>
  api.get('/settings/integrations/login-branding')

// payload: { image?, title?, subtitle? } — 포함된 키만 저장됨
export const saveLoginBranding = (payload) =>
  api.put('/settings/integrations/login-branding', payload)
