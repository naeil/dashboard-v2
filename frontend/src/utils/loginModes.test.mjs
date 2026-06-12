import assert from 'node:assert/strict'
import { getLoginEndpoint, LOGIN_MODES } from './loginModes.js'

assert.equal(getLoginEndpoint(LOGIN_MODES.TENANT), '/auth/tenant-login')
assert.equal(getLoginEndpoint(LOGIN_MODES.PLATFORM), '/auth/login')
assert.equal(getLoginEndpoint(undefined), '/auth/tenant-login')
