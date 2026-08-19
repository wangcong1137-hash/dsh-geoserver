/**
 * Local business-webhook receiver for exercising dsh-geoserver publication
 * notifications without a real business system.
 */

import { createServer } from 'node:http'

const host = process.env.GEOSERVER_WEBHOOK_TEST_HOST?.trim() || '127.0.0.1'
const port = parsePort(process.env.GEOSERVER_WEBHOOK_TEST_PORT)
const expectedToken = process.env.GEOSERVER_WEBHOOK_TEST_TOKEN?.trim()
const events = []

const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
  })
})

server.listen(port, host, () => {
  console.log(`GeoServer test webhook listening at http://${host}:${port}`)
  console.log(`POST http://${host}:${port}/geoserver/published`)
  console.log(`GET  http://${host}:${port}/events`)
})

/** Handle one health, event-list, or publication request. */
async function handle(request, response) {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`)
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true, received: events.length })
    return
  }
  if (request.method === 'GET' && url.pathname === '/events') {
    sendJson(response, 200, { events })
    return
  }
  if (request.method !== 'POST' || url.pathname !== '/geoserver/published') {
    sendJson(response, 404, { error: 'not found' })
    return
  }
  if (expectedToken !== undefined && request.headers.authorization !== `Bearer ${expectedToken}`) {
    sendJson(response, 401, { error: 'invalid bearer token' })
    return
  }
  const event = await readJson(request)
  if (!isPublicationEvent(event)) {
    sendJson(response, 400, { error: 'expected a geoserver.layer.published v1 event' })
    return
  }
  events.push({ receivedAt: new Date().toISOString(), event })
  if (events.length > 100) events.shift()
  console.log(JSON.stringify(event, null, 2))
  sendJson(response, 202, { accepted: true, eventId: event.eventId })
}

/** Read one bounded JSON request body. */
async function readJson(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > 64 * 1024) throw new Error('request body exceeds 64 KiB')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Check the stable fields that identify a publication event. */
function isPublicationEvent(value) {
  return typeof value === 'object'
    && value !== null
    && value.type === 'geoserver.layer.published'
    && value.version === 1
    && typeof value.eventId === 'string'
    && typeof value.publication === 'object'
    && value.publication !== null
}

/** Write one JSON response. */
function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

/** Resolve the optional port environment variable. */
function parsePort(value) {
  if (value === undefined || value.trim() === '') return 3900
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('GEOSERVER_WEBHOOK_TEST_PORT must be an integer from 1 to 65535')
  }
  return parsed
}
