import assert from 'node:assert/strict'
import {
  DEFAULT_FEATURE_PERMISSIONS,
  FEATURE_PERMISSIONS,
  getAllowedMenus,
  isFeatureAllowed,
  parseAccessPermissions,
  serializeAccessPermissions,
} from './accessPermissions.js'

const flat = parseAccessPermissions(JSON.stringify([
  'work-management',
  'payroll',
  `feature:${FEATURE_PERMISSIONS.CREATE_INVITE}`,
]))
assert.deepEqual(getAllowedMenus(flat), ['work-management', 'payroll'])
assert.equal(isFeatureAllowed(flat, FEATURE_PERMISSIONS.CREATE_INVITE), true)
assert.equal(isFeatureAllowed(flat, FEATURE_PERMISSIONS.RESET_PASSWORD), false)

const modern = parseAccessPermissions(JSON.stringify({
  permissionGroupName: '마케팅 관리자',
  menus: ['marketing-projects'],
  features: ['create_invite', 'manage_menu_permissions'],
}))
assert.equal(modern.permissionGroupName, '마케팅 관리자')
assert.deepEqual(getAllowedMenus(modern), ['marketing-projects'])
assert.equal(isFeatureAllowed(modern, FEATURE_PERMISSIONS.CREATE_INVITE), true)
assert.equal(isFeatureAllowed(modern, FEATURE_PERMISSIONS.RESET_PASSWORD), false)

const serialized = serializeAccessPermissions({
  menus: ['organization'],
  features: [FEATURE_PERMISSIONS.MANAGE_PERMISSIONS],
})
assert.deepEqual(serialized, ['organization', `feature:${FEATURE_PERMISSIONS.MANAGE_PERMISSIONS}`])

const empty = parseAccessPermissions(null)
assert.equal(empty.permissionGroupName, '')
assert.deepEqual(getAllowedMenus(empty), null)
assert.deepEqual(empty.features, DEFAULT_FEATURE_PERMISSIONS)
