/** Publication upload, local-path policy, metadata, and webhook tests. */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createPublicationEvent,
  deliverPublicationWebhook,
  publishLayerFile,
  resolvePublicationMetadata,
} from '../lib/publishing.js'

const signal = new AbortController().signal

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('publishLayerFile uploads and verifies one GeoTIFF', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gs-publish-'))
  const sourcePath = join(root, 'dem.tif')
  await writeFile(sourcePath, Buffer.from('fake-tiff'))
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    calls.push({ url, method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body })
    if (url.endsWith('/rest/workspaces/demo.json')) return jsonResponse({}, 404)
    if (url.endsWith('/rest/workspaces') && init.method === 'POST') return new Response('', { status: 201 })
    if (url.includes('/rest/layers/demo%3Adem.json')) {
      if (calls.filter(call => call.url.includes('/rest/layers/demo%3Adem.json')).length === 1) {
        return jsonResponse({}, 404)
      }
      return jsonResponse({
        layer: {
          name: 'dem',
          srs: 'EPSG:4326',
          latLonBoundingBox: { minx: 100, miny: 30, maxx: 101, maxy: 31 },
        },
      })
    }
    if (url.endsWith('/rest/workspaces/demo/coveragestores/dem.json')) return jsonResponse({}, 404)
    if (url.includes('/coveragestores/dem/file.geotiff?')) return new Response('', { status: 201 })
    return new Response('unexpected', { status: 500 })
  }
  try {
    const result = await publishLayerFile(
      'http://gs/geoserver',
      { username: 'admin', password: 'secret' },
      {
        kind: 'raster',
        sourcePath,
        workspace: 'demo',
        metadata: { projectId: 'p1', datasetId: 7 },
      },
      { allowedRoots: [root], maxBytes: 1024 },
      signal,
      5000,
    )
    assert.equal(result.publication.qualifiedName, 'demo:dem')
    assert.equal(result.publication.createdWorkspace, true)
    assert.equal(result.publication.srs, 'EPSG:4326')
    assert.deepEqual(result.publication.bbox, [100, 30, 101, 31])
    assert.match(result.publication.serviceUrls.wcs, /GetCoverage/)
    assert.deepEqual(result.metadata, { projectId: 'p1', datasetId: 7 })
    const upload = calls.find(call => call.url.includes('/file.geotiff?'))
    assert.equal(upload.method, 'PUT')
    assert.equal(upload.headers.get('content-type'), 'image/tiff')
    assert.match(upload.headers.get('authorization'), /^Basic /)
  } finally {
    globalThis.fetch = originalFetch
    await rm(root, { recursive: true, force: true })
  }
})

test('publishLayerFile uses the SHP ZIP upload endpoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gs-vector-'))
  const sourcePath = join(root, 'roads.zip')
  await writeFile(sourcePath, Buffer.from('fake-zip'))
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    calls.push({ url, method: init.method ?? 'GET', headers: new Headers(init.headers) })
    if (url.endsWith('/rest/workspaces/demo.json')) return jsonResponse({ workspace: { name: 'demo' } })
    if (url.includes('/rest/layers/demo%3Aroads.json')) {
      if (calls.filter(call => call.url.includes('/rest/layers/demo%3Aroads.json')).length === 1) {
        return jsonResponse({}, 404)
      }
      return jsonResponse({ layer: { name: 'roads' } })
    }
    if (url.endsWith('/rest/workspaces/demo/datastores/roads.json')) return jsonResponse({}, 404)
    if (url.includes('/datastores/roads/file.shp?')) return new Response('', { status: 201 })
    return new Response('unexpected', { status: 500 })
  }
  try {
    const result = await publishLayerFile(
      'http://gs/geoserver',
      {},
      { kind: 'vector', sourcePath, workspace: 'demo' },
      { allowedRoots: [root], maxBytes: 1024 },
      signal,
      5000,
    )
    assert.equal(result.publication.kind, 'vector')
    assert.match(result.publication.serviceUrls.wfs, /GetFeature/)
    const upload = calls.find(call => call.url.includes('/file.shp?'))
    assert.equal(upload.method, 'PUT')
    assert.equal(upload.headers.get('content-type'), 'application/zip')
  } finally {
    globalThis.fetch = originalFetch
    await rm(root, { recursive: true, force: true })
  }
})

test('publication rejects files outside configured roots before HTTP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gs-root-'))
  const outside = await mkdtemp(join(tmpdir(), 'gs-outside-'))
  const sourcePath = join(outside, 'dem.tif')
  await writeFile(sourcePath, Buffer.from('fake-tiff'))
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('fetch must not run') }
  try {
    await assert.rejects(
      publishLayerFile(
        'http://gs/geoserver',
        {},
        { kind: 'raster', sourcePath, workspace: 'demo' },
        { allowedRoots: [root], maxBytes: 1024 },
        signal,
        5000,
      ),
      /outside config\.publishRoots/,
    )
  } finally {
    globalThis.fetch = originalFetch
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('publication never replaces an existing GeoServer layer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gs-existing-'))
  const sourcePath = join(root, 'dem.tif')
  await writeFile(sourcePath, Buffer.from('fake-tiff'))
  const originalFetch = globalThis.fetch
  const methods = []
  globalThis.fetch = async (input, init = {}) => {
    methods.push(init.method ?? 'GET')
    const url = String(input)
    if (url.endsWith('/rest/workspaces/demo.json')) return jsonResponse({ workspace: { name: 'demo' } })
    if (url.includes('/rest/layers/demo%3Adem.json')) return jsonResponse({ layer: { name: 'dem' } })
    return new Response('unexpected', { status: 500 })
  }
  try {
    await assert.rejects(
      publishLayerFile(
        'http://gs/geoserver',
        {},
        { kind: 'raster', sourcePath, workspace: 'demo' },
        { allowedRoots: [root], maxBytes: 1024 },
        signal,
        5000,
      ),
      /already exists; automatic replacement is disabled/,
    )
    assert.deepEqual(methods, ['GET', 'GET'])
  } finally {
    globalThis.fetch = originalFetch
    await rm(root, { recursive: true, force: true })
  }
})

test('publication metadata is flat, scalar, and bounded', () => {
  assert.deepEqual(resolvePublicationMetadata({ projectId: 'p1', datasetId: 7, active: true }), {
    projectId: 'p1',
    datasetId: 7,
    active: true,
  })
  assert.throws(() => resolvePublicationMetadata({ nested: { id: 1 } }), /must be a string, number, or boolean/)
})

test('business webhook reports delivery without changing publication data', async () => {
  const publication = {
    workspace: 'demo',
    layer: 'dem',
    qualifiedName: 'demo:dem',
    kind: 'raster',
    store: 'dem',
    sourceName: 'dem.tif',
    createdWorkspace: false,
    serviceUrls: { wms: 'http://gs/wms', wcs: 'http://gs/wcs' },
  }
  const event = createPublicationEvent(publication, { projectId: 'p1' })
  assert.equal(event.type, 'geoserver.layer.published')
  assert.equal(event.version, 1)
  assert.equal(Object.hasOwn(event, 'eventType'), false)
  assert.equal(Object.hasOwn(event, 'eventVersion'), false)
  const originalFetch = globalThis.fetch
  let deliveredBody
  globalThis.fetch = async (_input, init = {}) => {
    deliveredBody = JSON.parse(String(init.body))
    const headers = new Headers(init.headers)
    assert.equal(headers.get('authorization'), 'Bearer business-token')
    assert.equal(headers.get('x-dsh-event-type'), 'geoserver.layer.published')
    return new Response(null, { status: 204 })
  }
  try {
    assert.deepEqual(
      await deliverPublicationWebhook('https://business.example/events', 'business-token', event, signal, 5000),
      { status: 'delivered', httpStatus: 204 },
    )
    assert.equal(deliveredBody.eventId, event.eventId)
    assert.equal(deliveredBody.type, 'geoserver.layer.published')
    assert.equal(deliveredBody.version, 1)
    assert.equal(deliveredBody.publication.qualifiedName, 'demo:dem')
    assert.deepEqual(deliveredBody.metadata, { projectId: 'p1' })

    globalThis.fetch = async () => new Response('temporarily unavailable', { status: 503 })
    const failed = await deliverPublicationWebhook(
      'https://business.example/events',
      undefined,
      event,
      signal,
      5000,
    )
    assert.equal(failed.status, 'failed')
    assert.equal(failed.httpStatus, 503)
    assert.match(failed.error, /temporarily unavailable/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('an absent webhook is an explicit no-op', async () => {
  const event = createPublicationEvent({
    workspace: 'demo',
    layer: 'dem',
    qualifiedName: 'demo:dem',
    kind: 'raster',
    store: 'dem',
    sourceName: 'dem.tif',
    createdWorkspace: false,
    serviceUrls: { wms: 'http://gs/wms', wcs: 'http://gs/wcs' },
  }, {})
  assert.deepEqual(await deliverPublicationWebhook(undefined, undefined, event, signal, 5000), {
    status: 'not_configured',
  })
})
