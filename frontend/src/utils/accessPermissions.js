export const FEATURE_PERMISSIONS = {
  CREATE_INVITE: 'employee.invite',
  RESET_PASSWORD: 'employee.reset_password',
  MANAGE_PERMISSIONS: 'employee.manage_permissions',
  DELETE_USERS: 'employee.deactivate',
}

export const DEFAULT_FEATURE_PERMISSIONS = Object.values(FEATURE_PERMISSIONS)

function normalizeFeatureId(value) {
  const legacyMap = {
    create_invite: FEATURE_PERMISSIONS.CREATE_INVITE,
    reset_password: FEATURE_PERMISSIONS.RESET_PASSWORD,
    manage_menu_permissions: FEATURE_PERMISSIONS.MANAGE_PERMISSIONS,
    delete_users: FEATURE_PERMISSIONS.DELETE_USERS,
  }
  return legacyMap[value] || value
}

export function parseAccessPermissions(raw) {
  if (!raw) {
    return {
      permissionGroupName: '',
      menus: null,
      features: DEFAULT_FEATURE_PERMISSIONS,
    }
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) {
      const menus = parsed.filter((item) => typeof item === 'string' && !item.startsWith('feature:'))
      const features = parsed
        .filter((item) => typeof item === 'string' && item.startsWith('feature:'))
        .map((item) => normalizeFeatureId(item.slice('feature:'.length)))
      return {
        permissionGroupName: '',
        menus,
        features: features.length ? features : DEFAULT_FEATURE_PERMISSIONS,
      }
    }

    if (parsed && typeof parsed === 'object') {
      return {
        permissionGroupName: String(parsed.permissionGroupName || ''),
        menus: Array.isArray(parsed.menus) ? parsed.menus : null,
        features: Array.isArray(parsed.features) ? parsed.features.map(normalizeFeatureId) : DEFAULT_FEATURE_PERMISSIONS,
      }
    }
  } catch {
    // Fall through to the default open configuration.
  }

  return {
    permissionGroupName: '',
    menus: null,
    features: DEFAULT_FEATURE_PERMISSIONS,
  }
}

export function getAllowedMenus(accessPermissions) {
  return Array.isArray(accessPermissions?.menus) ? accessPermissions.menus : null
}

export function isFeatureAllowed(accessPermissions, featureId) {
  const features = accessPermissions?.features
  if (!Array.isArray(features)) return true
  return features.includes(featureId)
}

export function serializeAccessPermissions({ menus = null, features = DEFAULT_FEATURE_PERMISSIONS }) {
  const menuEntries = Array.isArray(menus) ? menus : []
  const featureEntries = (Array.isArray(features) ? features : [])
    .map(normalizeFeatureId)
    .map((feature) => `feature:${feature}`)
  return [...new Set([...menuEntries, ...featureEntries])]
}
