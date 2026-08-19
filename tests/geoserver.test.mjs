/**
 * Unit tests for the pure GeoServer helpers and the tool-layer plumbing that
 * can run without a live server. The HTTP functions are exercised against a
 * mocked global fetch; parsing tests use representative GeoServer payloads.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  basicAuthHeader,
  buildGetMapUrl,
  normalizeBaseUrl,
  parseCapabilitiesXml,
  parseRestLayerDetail,
  parseRestList,
  WMS_IMAGE_FORMATS,
} from '../lib/geoserver.js'
import {
  Config,
  probeServer,
  resolveBaseUrl,
  resolveCredentials,
  resolvePublishWorkspace,
  listServices,
} from '../lib/index.js'

test('plugin config permits first boot before a server URL is configured', () => {
  const config = Config({})
  assert.equal(config.baseUrl, '')
  assert.deepEqual(config.publishRoots, [])
  assert.equal(config.defaultWorkspace, '')
  assert.equal(config.publishMaxBytes, 512 * 1024 * 1024)
  assert.equal(config.webhookTimeoutMs, 5000)
})

test('publication workspace uses the request before the configured default', () => {
  assert.equal(resolvePublishWorkspace('request_workspace', 'default_workspace'), 'request_workspace')
  assert.equal(resolvePublishWorkspace(undefined, ' default_workspace '), 'default_workspace')
  assert.throws(() => resolvePublishWorkspace(undefined, ''), /workspace is not configured/)
})

test('resolveBaseUrl rejects an unconfigured server only when a tool executes', () => {
  assert.throws(() => resolveBaseUrl(undefined), /GeoServer base URL is not configured/)
  assert.throws(() => resolveBaseUrl('   '), /GeoServer base URL is not configured/)
  assert.equal(resolveBaseUrl(' http://h:8080/geoserver/// '), 'http://h:8080/geoserver')
})

test('basicAuthHeader encodes user:pass', () => {
  assert.equal(basicAuthHeader('admin', 'geoserver'), `Basic ${Buffer.from('admin:geoserver').toString('base64')}`)
})

test('normalizeBaseUrl strips trailing slashes', () => {
  assert.equal(normalizeBaseUrl('http://h:8080/geoserver/'), 'http://h:8080/geoserver')
  assert.equal(normalizeBaseUrl('http://h:8080/geoserver///'), 'http://h:8080/geoserver')
})

test('buildGetMapUrl produces a WMS 1.1.1 GetMap URL with encoded params', () => {
  const url = buildGetMapUrl('http://gs/geoserver', {
    layers: 'topp:states',
    bbox: [-124, 24, -66, 49],
    width: 800,
    height: 600,
    format: 'image/png',
    srs: 'EPSG:4326',
    styles: '',
    transparent: true,
  })
  const parsed = new URL(url)
  assert.equal(parsed.origin + parsed.pathname, 'http://gs/geoserver/wms')
  assert.equal(parsed.searchParams.get('service'), 'WMS')
  assert.equal(parsed.searchParams.get('version'), '1.1.1')
  assert.equal(parsed.searchParams.get('request'), 'GetMap')
  assert.equal(parsed.searchParams.get('layers'), 'topp:states')
  assert.equal(parsed.searchParams.get('bbox'), '-124,24,-66,49')
  assert.equal(parsed.searchParams.get('width'), '800')
  assert.equal(parsed.searchParams.get('format'), 'image/png')
  assert.equal(parsed.searchParams.get('transparent'), 'TRUE')
})

test('parseRestList handles empty, single, and multi collections', () => {
  assert.deepEqual(parseRestList({ workspaces: '' }, 'workspace'), [])
  assert.deepEqual(parseRestList({ workspaces: { workspace: { name: 'cite' } } }, 'workspace'), ['cite'])
  assert.deepEqual(
    parseRestList({ layers: { layer: [{ name: 'a' }, { name: 'b' }] } }, 'layer'),
    ['a', 'b'],
  )
})

test('parseRestLayerDetail extracts title, srs, bbox, and styles', () => {
  const detail = parseRestLayerDetail({
    layer: {
      name: 'topp:states',
      title: 'USA States',
      srs: 'EPSG:4326',
      latLonBoundingBox: { minx: -124, miny: 24, maxx: -66, maxy: 49 },
      styles: { style: [{ name: 'population' }, { name: 'default' }] },
    },
  })
  assert.equal(detail.title, 'USA States')
  assert.equal(detail.srs, 'EPSG:4326')
  assert.deepEqual(detail.bbox, [-124, 24, -66, 49])
  assert.deepEqual(detail.styles?.map(style => style.name), ['population', 'default'])
})

test('parseRestLayerDetail tolerates missing fields', () => {
  assert.deepEqual(parseRestLayerDetail({ layer: { name: 'x' } }), {})
  assert.deepEqual(parseRestLayerDetail({}), {})
  assert.deepEqual(parseRestLayerDetail(undefined), {})
})

test('parseCapabilitiesXml extracts named layers, titles, and styles', () => {
  const xml = `<?xml version="1.0"?>
<WMS_Capabilities>
  <Service><Title>GeoServer Web Map Service</Title></Service>
  <Capability>
    <Layer>
      <Title>Global layer group</Title>
      <Layer>
        <Name>topp:states</Name>
        <Title>USA States</Title>
        <Style><Name>population</Name></Style>
        <Style><Name>default</Name></Style>
      </Layer>
      <Layer>
        <Name>topp:roads</Name>
        <Title>Roads &amp; rails</Title>
        <Style><Name>line</Name></Style>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>`
  const result = parseCapabilitiesXml(xml)
  assert.equal(result.title, 'GeoServer Web Map Service')
  assert.equal(result.layers.length, 2)
  assert.equal(result.layers[0].name, 'topp:states')
  assert.equal(result.layers[0].title, 'USA States')
  assert.equal(result.layers[0].styles[1].name, 'default')
  assert.equal(result.layers[1].title, 'Roads & rails')
})

test('resolveCredentials prefers direct fields, falls back to env by name', () => {
  const previous = { ...process.env }
  process.env.GEOSERVER_USER = 'env-user'
  process.env.GEOSERVER_PASS = 'env-pass'
  try {
    assert.deepEqual(
      resolveCredentials({ baseUrl: 'x', env: ['GEOSERVER_USER', 'GEOSERVER_PASS'] }),
      { username: 'env-user', password: 'env-pass' },
    )
    assert.deepEqual(
      resolveCredentials({ baseUrl: 'x', username: 'direct', password: 'pw', env: ['GEOSERVER_USER'] }),
      { username: 'direct', password: 'pw' },
    )
    assert.deepEqual(resolveCredentials({ baseUrl: 'x' }), {})
  } finally {
    for (const key of ['GEOSERVER_USER', 'GEOSERVER_PASS']) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('listServices enumerates workspaces, layers, styles, and formats via REST', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    const respond = body => new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    if (url.endsWith('/rest/workspaces.json')) {
      return respond({ workspaces: { workspace: [{ name: 'topp' }, { name: 'cite' }] } })
    }
    if (url.endsWith('/rest/layers.json')) {
      return respond({ layers: { layer: [{ name: 'topp:states' }, { name: 'cite:roads' }] } })
    }
    if (url.endsWith('/rest/styles.json')) {
      return respond({ styles: { style: [{ name: 'population' }, { name: 'default' }] } })
    }
    if (url.includes('/rest/layers/topp%3Astates.json')) {
      return respond({ layer: { name: 'topp:states', title: 'USA States', srs: 'EPSG:4326' } })
    }
    if (url.includes('/rest/layers/cite%3Aroads.json')) {
      return respond({ layer: { name: 'cite:roads' } })
    }
    return new Response('not found', { status: 404 })
  }
  try {
    const result = await listServices('http://gs/geoserver', {}, new AbortController().signal, 5000, false)
    assert.equal(result.services.length, 2)
    const topp = result.services.find(service => service.name === 'topp')
    assert.equal(topp.layers[0].name, 'topp:states')
    assert.equal(topp.layers[0].title, 'USA States')
    assert.deepEqual(result.styles, ['population', 'default'])
    assert.deepEqual(result.formats, [...WMS_IMAGE_FORMATS])
    assert.ok(calls.some(url => url.includes('/rest/layers/topp%3Astates.json')))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('probeServer reports auth-required on REST 401', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/rest/workspaces.json')) {
      return new Response('{"message":"Unauthorized"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('not found', { status: 404 })
  }
  try {
    const result = await probeServer('http://gs/geoserver', {}, new AbortController().signal, 5000)
    assert.equal(result.reachable, true)
    assert.equal(result.authRequired, true)
    assert.equal(result.httpStatus, 401)
    assert.equal(result.imageTest, undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('probeServer reports anonymous-ok on REST 200', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/rest/workspaces.json')) {
      return new Response('{"workspaces":""}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('GetCapabilities')) {
      return new Response('<WMS_Capabilities><Service><Title>T</Title></Service></WMS_Capabilities>', {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.ogc.wms_xml' },
      })
    }
    return new Response('not found', { status: 404 })
  }
  try {
    const result = await probeServer('http://gs/geoserver', {}, new AbortController().signal, 5000)
    assert.equal(result.reachable, true)
    assert.equal(result.authRequired, false)
    assert.equal(result.wmsTitle, 'T')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('probeServer reports unreachable when REST and capabilities both fail', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  try {
    const result = await probeServer('http://gs/geoserver', {}, new AbortController().signal, 5000)
    assert.equal(result.reachable, false)
    assert.equal(result.httpStatus, 0)
    assert.ok(result.error !== undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})
