const SECRET_FIELDS = ['apiKey', 'email', 'password', 'extraValue']

const FLAG_BY_FIELD = {
  apiKey: 'hasApiKey',
  email: 'hasEmail',
  password: 'hasPassword',
  extraValue: 'hasExtraValue',
}

function isPresent(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null
}

export function redactIntegrationResponse(response) {
  const redacted = { ...response }

  for (const field of SECRET_FIELDS) {
    const flag = FLAG_BY_FIELD[field]
    redacted[flag] = Boolean(response?.[flag] ?? isPresent(response?.[field]))
    redacted[field] = ''
  }

  return redacted
}

export function buildSecretPatch(payload) {
  const patch = { integrationType: payload.integrationType }

  for (const field of SECRET_FIELDS) {
    if (isPresent(payload[field])) {
      patch[field] = payload[field]
    }
  }

  return patch
}

export function hasSavedSecret(source, field) {
  const flag = FLAG_BY_FIELD[field]
  return Boolean(source?.[flag] || isPresent(source?.[field]))
}
