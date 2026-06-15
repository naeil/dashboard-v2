import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AI_PROVIDER_CONFIGS,
  getAiProviderConfig,
  isAiProviderReady,
  maskAiSecret,
} from './aiProviderCatalog.js'

test('defines required credential fields and default models for supported AI providers', () => {
  assert.deepEqual(
    AI_PROVIDER_CONFIGS.map((provider) => provider.id),
    ['OPENAI', 'CLAUDE', 'GEMINI'],
  )

  assert.deepEqual(getAiProviderConfig('OPENAI').requiredFields, ['apiKey'])
  assert.deepEqual(getAiProviderConfig('OPENAI').optionalFields, ['organizationId', 'projectId'])
  assert.ok(getAiProviderConfig('OPENAI').models.includes('gpt-4o'))

  assert.deepEqual(getAiProviderConfig('CLAUDE').requiredFields, ['apiKey'])
  assert.equal(getAiProviderConfig('CLAUDE').apiVersion, '2023-06-01')
  assert.ok(getAiProviderConfig('CLAUDE').models.includes('claude-3-5-sonnet-20241022'))

  assert.deepEqual(getAiProviderConfig('GEMINI').requiredFields, ['apiKey'])
  assert.ok(getAiProviderConfig('GEMINI').models.includes('gemini-1.5-pro'))
})

test('checks whether entered credentials are ready for validation', () => {
  assert.equal(isAiProviderReady('OPENAI', { apiKey: 'sk-test' }), true)
  assert.equal(isAiProviderReady('OPENAI', { apiKey: '   ' }), false)
  assert.equal(isAiProviderReady('CLAUDE', { apiKey: 'claude-key' }), true)
  assert.equal(isAiProviderReady('GEMINI', {}), false)
})

test('masks AI secret values without exposing the full key', () => {
  assert.equal(maskAiSecret(''), '')
  assert.equal(maskAiSecret('abcd'), '****')
  assert.equal(maskAiSecret('sk-1234567890abcdef'), '************cdef')
})
