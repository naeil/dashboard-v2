export const AI_PROVIDER_CONFIGS = [
  {
    id: 'OPENAI',
    label: 'OpenAI',
    badge: 'AI',
    requiredFields: ['apiKey'],
    optionalFields: ['organizationId', 'projectId'],
  },
  {
    id: 'CLAUDE',
    label: 'Claude',
    badge: 'C',
    requiredFields: ['apiKey'],
    optionalFields: [],
    apiVersion: '2023-06-01',
  },
  {
    id: 'GEMINI',
    label: 'Gemini',
    badge: 'G',
    requiredFields: ['apiKey'],
    optionalFields: [],
  },
]

export function getAiProviderConfig(providerId) {
  return AI_PROVIDER_CONFIGS.find((provider) => provider.id === providerId) || AI_PROVIDER_CONFIGS[0]
}

export function isAiProviderReady(providerId, values = {}) {
  const provider = getAiProviderConfig(providerId)
  return provider.requiredFields.every((field) => {
    const value = values[field]
    return typeof value === 'string' && value.trim().length > 0
  })
}

export function maskAiSecret(value) {
  if (!value) return ''
  if (value.length <= 4) return '****'
  return `${'*'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`
}
