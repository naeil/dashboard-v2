export const LOGIN_MODES = {
  TENANT: 'tenant',
  PLATFORM: 'platform',
}

export function getLoginEndpoint(mode) {
  return mode === LOGIN_MODES.PLATFORM ? '/auth/login' : '/auth/tenant-login'
}

export function requiresCompanyCode(mode) {
  return mode !== LOGIN_MODES.PLATFORM
}
