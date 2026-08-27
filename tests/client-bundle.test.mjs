import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('published client bundle registers the settings card with a keyed contribution', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  const registration = bundle.slice(bundle.indexOf('scoped.slots.inject("settings.plugin.item"'))

  assert.match(registration, /name: "settings\.plugin\.item",\s+key: GEOSERVER_NS,/)
  assert.doesNotMatch(registration, /\bid: GEOSERVER_NS,/)
  assert.doesNotMatch(registration, /\border: 30,/)
})
