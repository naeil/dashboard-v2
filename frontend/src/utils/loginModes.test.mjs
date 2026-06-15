import assert from 'node:assert/strict'
import { getLoginEndpoint, LOGIN_MODES, requiresCompanyCode } from './loginModes.js'

assert.equal(getLoginEndpoint(LOGIN_MODES.TENANT), '/auth/tenant-login')
assert.equal(getLoginEndpoint(LOGIN_MODES.PLATFORM), '/auth/login')
assert.equal(getLoginEndpoint(undefined), '/auth/tenant-login')
assert.equal(requiresCompanyCode(LOGIN_MODES.TENANT), true)
assert.equal(requiresCompanyCode(LOGIN_MODES.PLATFORM), false)
assert.equal(requiresCompanyCode(undefined), true)

console.log('loginModes tests passed')
