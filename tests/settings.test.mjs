import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { FileSettingsProvider } from '@deepseek-ai/dsh-settings-file'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

/**
 * Host-half settings wiring: installSettingsSection must register the
 * `geoserver` namespace over the composition entry, then hand the consumer the
 * resolved scope so a committed user section takes effect without reload.
 */
test('geoserver settings section attaches and tracks committed updates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gs-settings-'))
  const ctx = new Context()
  const provider = ctx.plugin(FileSettingsProvider, { path: join(dir, 'settings.yaml'), dshHome: dir, watch: false })
  try {
    await provider

    const Config = z.object({
      baseUrl: z.string().required(),
      username: z.string(),
      publishRoots: z.array(z.string()).default([]),
      defaultWorkspace: z.string().default(''),
      publishMaxBytes: z.number().default(512 * 1024 * 1024),
      webhookUrl: z.string(),
      webhookTokenEnv: z.string(),
      webhookTimeoutMs: z.number().default(5000),
    })
    const ns = settingsNamespace('geoserver')
    const entry = { baseUrl: 'http://default:8080/geoserver' }
    let current = () => entry
    let attached = false

    installSettingsSection(ctx, ns, Config, entry, {
      setSource: (source) => { current = source; attached = true },
      onChange: () => {},
    })
    await new Promise(resolve => setTimeout(resolve, 300))

    assert.equal(attached, true)
    assert.equal(current().baseUrl, 'http://default:8080/geoserver')

    await ctx.settings.update(ns, {
      baseUrl: 'http://10.0.0.1:8651/geoserver',
      username: 'admin',
      publishRoots: ['D:/data', 'D:/imports'],
      defaultWorkspace: 'demo',
      publishMaxBytes: 1048576,
      webhookUrl: 'https://business.example.com/geoserver/published',
      webhookTokenEnv: 'BUSINESS_WEBHOOK_TOKEN',
      webhookTimeoutMs: 3000,
    })
    await new Promise(resolve => setTimeout(resolve, 300))

    assert.equal(current().baseUrl, 'http://10.0.0.1:8651/geoserver')
    assert.equal(current().username, 'admin')
    assert.deepEqual(current().publishRoots, ['D:/data', 'D:/imports'])
    assert.equal(current().defaultWorkspace, 'demo')
    assert.equal(current().publishMaxBytes, 1048576)
    assert.equal(current().webhookUrl, 'https://business.example.com/geoserver/published')
    assert.equal(current().webhookTokenEnv, 'BUSINESS_WEBHOOK_TOKEN')
    assert.equal(current().webhookTimeoutMs, 3000)
  } finally {
    await provider.dispose().catch(() => {})
    await rm(dir, { recursive: true, force: true })
  }
})
