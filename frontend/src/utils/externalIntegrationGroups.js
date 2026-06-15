export function groupExternalIntegrations(integrations) {
  const naverIntegrations = integrations.filter((integration) => integration.group === 'NAVER')
  const otherIntegrations = integrations.filter((integration) => integration.group !== 'NAVER')

  return [
    {
      id: 'naver',
      label: 'NAVER',
      children: naverIntegrations,
    },
    ...otherIntegrations,
  ]
}
