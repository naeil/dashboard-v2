export const AI_PROVIDER_CONFIGS = [
  {
    id: 'OPENAI',
    label: 'OpenAI',
    badge: 'AI',
    description: 'OpenAI API Key로 GPT 계열 모델을 연결합니다.',
    requiredFields: ['apiKey'],
    optionalFields: ['organizationId', 'projectId'],
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'CLAUDE',
    label: 'Claude',
    badge: 'C',
    description: 'Anthropic API Key로 Claude 모델을 연결합니다.',
    requiredFields: ['apiKey'],
    optionalFields: [],
    apiVersion: '2023-06-01',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
  {
    id: 'GEMINI',
    label: 'Gemini',
    badge: 'G',
    description: 'Google AI Studio API Key로 Gemini 모델을 연결합니다.',
    requiredFields: ['apiKey'],
    optionalFields: [],
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
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
