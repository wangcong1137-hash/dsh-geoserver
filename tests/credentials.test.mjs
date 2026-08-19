import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
// Built artifact: the test lane runs against lib/ like every other suite here.
import { resolveRuntimeCredentials } from '../lib/index.js'

/** A minimal in-memory credential provider for the resolution test. */
class MemoryCredentials extends CredentialProvider {
  constructor(values) {
    super(new Context())
    this.values = values
  }
  async resolve(ref) {
    const value = this.values[String(ref)]
    return value === undefined ? undefined : { value, source: 'file' }
  }
  async describe(ref) {
    return { configured: this.values[String(ref)] !== undefined, writable: true }
  }
  async set(ref, value) {
    this.values[String(ref)] = value
  }
  async unset(ref) {
    delete this.values[String(ref)]
  }
}

const base = { baseUrl: 'http://host:8080/geoserver' }

test('resolveRuntimeCredentials falls back to the credentials domain for the password', async () => {
  const store = new MemoryCredentials({ GEOSERVER_PASS: 'secret-from-card' })
  const resolved = await resolveRuntimeCredentials({ ...base, username: 'admin' }, store)
  assert.deepEqual(resolved, { username: 'admin', password: 'secret-from-card' })
})

test('resolveRuntimeCredentials prefers direct config and env over the credentials domain', async () => {
  const store = new MemoryCredentials({ GEOSERVER_PASS: 'card', GEOSERVER_USER: 'card-user' })
  const previous = process.env['GS_TEST_PASS']
  process.env['GS_TEST_PASS'] = 'env-pass'
  try {
    const resolved = await resolveRuntimeCredentials(
      { ...base, username: 'config-user', env: ['GS_TEST_PASS'] },
      store,
    )
    assert.deepEqual(resolved, { username: 'config-user', password: 'env-pass' })
  } finally {
    if (previous === undefined) delete process.env['GS_TEST_PASS']
    else process.env['GS_TEST_PASS'] = previous
  }
})

test('resolveRuntimeCredentials with no provider returns config/env only', async () => {
  const resolved = await resolveRuntimeCredentials(base, undefined)
  assert.deepEqual(resolved, {})
})
