import assert from 'node:assert/strict'
import test from 'node:test'

import { groupExternalIntegrations } from './externalIntegrationGroups.js'

test('groups NAVER integrations under one provider and preserves other providers', () => {
  const integrations = [
    { id: 'naver-search', group: 'NAVER' },
    { id: 'naver-blog', group: 'NAVER' },
    { id: 'naver-ad', group: 'NAVER' },
    { id: 'meta-ad', group: 'META' },
    { id: 'daou-mail', group: 'MAIL' },
  ]

  assert.deepEqual(groupExternalIntegrations(integrations), [
    {
      id: 'naver',
      label: 'NAVER',
      children: integrations.slice(0, 3),
    },
    integrations[3],
    integrations[4],
  ])
})
