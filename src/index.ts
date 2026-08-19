/**
 * dsh-geoserver — read GeoServer WMS services and render map images in the
 * dsh web GUI.
 *
 * Tools:
 *  - `geoserver_list`: enumerate workspaces/layers/styles via the GeoServer
 *    REST API (fallback: WMS GetCapabilities XML).
 *  - `geoserver_map`: fetch a WMS GetMap image server-side (credentials never
 *    leave the host) and hand the browser an in-origin URL served by this
 *    plugin's `/geoserver-image` route.
 *  - `geoserver_publish`: upload one local GeoTIFF or SHP ZIP, then optionally
 *    notify an administrator-configured business webhook.
 *  - `geoserver_probe`: connectivity/authentication diagnostics.
 *
 * A settings card in the web GUI (Settings → Plugins → Plugin configuration)
 * reads and writes its fields through this plugin's `/geoserver/config` route
 * (registered on `ctx.webServer` below); the route persists into the
 * `geoserver` settings namespace, so a saved change takes effect immediately
 * and needs no settings-RPC allowlist on any host.
 *
 * The `/geoserver-image/<token>` route is registered on `ctx.webServer` when
 * the web surface is composed; tokens are random UUIDs bound to a short TTL
 * cache, so the browser never sees GeoServer credentials.
 */

import { randomUUID } from 'node:crypto'
import { clearInterval, setInterval } from 'node:timers'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import {
  WMS_IMAGE_FORMATS,
  basicAuthHeader,
  buildGetMapUrl,
  normalizeBaseUrl,
  parseCapabilitiesXml,
  parseRestLayerDetail,
  parseRestList,
} from './geoserver.js'
import type { CapabilitiesResult, GetMapParams, WmsLayerInfo, WmsServiceInfo, WmsStyleInfo } from './geoserver.ts'
import {
  createPublicationEvent,
  deliverPublicationWebhook,
  publishLayerFile,
} from './publishing.js'

export const name = 'geoserver'
export const inject = ['tools', 'webServer']

declare module '@deepseek-ai/cordis' {
  interface Context {
    webServer: WebServerLike
  }
}

/** Credentials resolved from config fields or the configured environment variables. */
export interface ResolvedCredentials {
  /** Basic-auth username; absent means anonymous access. */
  readonly username?: string
  /** Basic-auth password; absent means anonymous access. */
  readonly password?: string
}

/** Plugin configuration. */
export interface Config {
  /** GeoServer base URL, or an empty string until the user configures one. */
  baseUrl: string
  /** Optional direct Basic-auth username. */
  username?: string
  /** Optional direct Basic-auth password. */
  password?: string
  /**
   * Environment-variable names to read credentials from. The first name
   * matching `/user/i` supplies the username and the first matching
   * `/pass|pwd|token/i` the password; direct `username`/`password` fields
   * take precedence. Typical value: `['GEOSERVER_USER', 'GEOSERVER_PASS']`.
   */
  env?: string[]
  /** Image cache TTL in milliseconds; default 10 minutes. */
  cacheTtlMs?: number
  /** Maximum cached images before the oldest entries are evicted; default 50. */
  cacheMaxEntries?: number
  /**
   * Externally reachable base URL of this dsh web GUI, e.g. for LAN access.
   * Defaults to `http://127.0.0.1:<webServer.port>`.
   */
  publicBaseUrl?: string
  /** Per-request HTTP timeout in milliseconds; default 15 seconds. */
  connectTimeoutMs?: number
  /** Local directories from which `geoserver_publish` may read source files. Empty disables publication. */
  publishRoots: string[]
  /** Default workspace used when a publication request does not specify one. */
  defaultWorkspace: string
  /** Maximum source-file size accepted by `geoserver_publish`; default 512 MiB. */
  publishMaxBytes: number
  /** Optional business-system endpoint notified after a layer is published successfully. */
  webhookUrl?: string
  /** Optional environment variable supplying the webhook Bearer token. */
  webhookTokenEnv?: string
  /** Business webhook timeout in milliseconds; default 5 seconds. */
  webhookTimeoutMs: number
}

/** Schemastery configuration for the geoserver consumer. */
export const Config: z<Config> = z.object({
  baseUrl: z.string().default(''),
  username: z.string(),
  password: z.string().role('secret'),
  env: z.array(z.string()),
  cacheTtlMs: z.number(),
  cacheMaxEntries: z.number(),
  publicBaseUrl: z.string(),
  connectTimeoutMs: z.number(),
  publishRoots: z.array(z.string()).default([]),
  defaultWorkspace: z.string().default(''),
  publishMaxBytes: z.number().default(512 * 1024 * 1024),
  webhookUrl: z.string(),
  webhookTokenEnv: z.string(),
  webhookTimeoutMs: z.number().default(5000),
})

/**
 * Resolve the configured server address at tool-execution time.
 * @param value - the tool override or current settings value.
 * @returns the normalized non-empty GeoServer base URL.
 */
export function resolveBaseUrl(value: string | undefined): string {
  const baseUrl = normalizeBaseUrl(value?.trim() ?? '')
  if (baseUrl === '') {
    throw new Error(
      'GeoServer base URL is not configured. Open Settings → Plugins → Plugin configuration → GeoServer, '
      + 'or set config.baseUrl on the geoserver profile entry.',
    )
  }
  return baseUrl
}

/**
 * Resolve the target workspace at publication time.
 * @param requested - optional workspace supplied by the tool call.
 * @param configured - default workspace from plugin settings.
 * @returns the non-empty workspace name.
 */
export function resolvePublishWorkspace(requested: string | undefined, configured: string): string {
  const workspace = (requested ?? configured).trim()
  if (workspace === '') {
    throw new Error(
      'GeoServer publication workspace is not configured. Set Default publication workspace in the '
      + 'GeoServer settings card, or pass workspace in this publication request.',
    )
  }
  return workspace
}

/** Settings namespace carrying the configured server, username, and password. */
export const GEOSERVER_SETTINGS_NAMESPACE = settingsNamespace('geoserver')

/** Merge direct config credentials with environment-provided ones. */
export function resolveCredentials(config: Config): ResolvedCredentials {
  let username = config.username
  let password = config.password
  for (const key of config.env ?? []) {
    const value = process.env[key]
    if (value === undefined) continue
    if (username === undefined && /user/i.test(key)) username = value
    else if (password === undefined && /pass|pwd|token/i.test(key)) password = value
  }
  return { ...(username !== undefined ? { username } : {}), ...(password !== undefined ? { password } : {}) }
}

/** Credential references the settings card writes the password through. */
export const GEOSERVER_PASS_REF = 'GEOSERVER_PASS'
export const GEOSERVER_USER_REF = 'GEOSERVER_USER'

/**
 * Resolve the Basic-auth credentials for one call: direct config fields, then
 * environment variables, then the credentials domain the settings card writes
 * the password into. A value found earlier wins; a field with no value
 * anywhere stays absent, so `authHeaders` simply omits the header.
 * @param config - the resolved settings section.
 * @param store - the credentials provider, or undefined when none is mounted.
 * @returns the merged credentials.
 */
export async function resolveRuntimeCredentials(
  config: Config,
  store: CredentialProvider | undefined,
): Promise<ResolvedCredentials> {
  const direct = resolveCredentials(config)
  if (store === undefined) return direct
  const [password, username] = await Promise.all([
    direct.password === undefined ? store.resolve(credentialRef(GEOSERVER_PASS_REF)) : undefined,
    direct.username === undefined ? store.resolve(credentialRef(GEOSERVER_USER_REF)) : undefined,
  ])
  return {
    ...(direct.username !== undefined ? { username: direct.username } : username === undefined ? {} : { username: username.value }),
    ...(direct.password !== undefined ? { password: direct.password } : password === undefined ? {} : { password: password.value }),
  }
}

interface ImageCacheEntry {
  bytes: Buffer
  mime: string
  expires: number
}

/** Bounded TTL cache keyed by random image token. */
class ImageCache {
  private readonly entries = new Map<string, ImageCacheEntry>()
  private readonly ttlMs: number
  private readonly maxEntries: number

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  /** Store an image and return its token. */
  put(bytes: Buffer, mime: string): string {
    this.prune()
    const token = randomUUID()
    this.entries.set(token, { bytes, mime, expires: Date.now() + this.ttlMs })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
    return token
  }

  /** Read an unexpired entry by token; expired entries are removed. */
  get(token: string): ImageCacheEntry | undefined {
    const entry = this.entries.get(token)
    if (entry === undefined) return undefined
    if (entry.expires < Date.now()) {
      this.entries.delete(token)
      return undefined
    }
    return entry
  }

  /** Drop expired entries. */
  prune(): void {
    const now = Date.now()
    for (const [token, entry] of this.entries) {
      if (entry.expires < now) this.entries.delete(token)
    }
  }

  /** Number of live entries (diagnostics). */
  get size(): number {
    return this.entries.size
  }
}

/** Minimal structural view of the `webServer` service; avoids a host-package dependency. */
interface WebServerLike {
  /** The listening port. */
  readonly port: number
  /** The configured bind host. */
  readonly host: string
  /**
   * Register a named route.
   * @param route - kind, path, and the owning handler.
   * @returns the disposer removing the route.
   */
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

interface HttpError extends Error {
  status?: number
}

/** True when the request's Origin matches its Host — required on the config POST. */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Read and parse a JSON request body, rejecting anything over 4 KiB. */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4096) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** Write a JSON payload with no-store caching. */
function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

interface HttpResponse {
  status: number
  body: string
  contentType: string
}

/** One HTTP round-trip with Basic auth and a bounded timeout honoring `exec.signal`. */
async function httpText(
  url: string,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<HttpResponse> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, application/xml, text/xml, text/plain;q=0.9, */*;q=0.5',
      ...authHeaders(credentials),
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  })
  const body = await response.text()
  return {
    status: response.status,
    body,
    contentType: response.headers.get('content-type') ?? '',
  }
}

/** One HTTP round-trip returning raw bytes (for image payloads). */
async function httpBytes(
  url: string,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ status: number; bytes: Buffer; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/png, image/jpeg, image/gif, image/tiff, */*',
      ...authHeaders(credentials),
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  })
  const bytes = Buffer.from(await response.arrayBuffer())
  return {
    status: response.status,
    bytes,
    contentType: response.headers.get('content-type') ?? '',
  }
}

function authHeaders(credentials: ResolvedCredentials): Record<string, string> {
  return credentials.username !== undefined && credentials.password !== undefined
    ? { Authorization: basicAuthHeader(credentials.username, credentials.password) }
    : {}
}

/** Assert a 2xx response and return its text body; throws a diagnostic on failure. */
function expectOk(response: HttpResponse, what: string): string {
  if (response.status >= 200 && response.status < 300) return response.body
  const error: HttpError = new Error(
    `${what} failed with HTTP ${response.status}: ${response.body.slice(0, 300)}`,
  )
  error.status = response.status
  throw error
}

/** Assert the response looks like JSON (GeoServer REST serves login HTML on 302-follows). */
function expectJson(response: HttpResponse, what: string): unknown {
  const body = expectOk(response, what)
  if (!/json/i.test(response.contentType)) {
    throw new Error(`${what} did not return JSON (content-type ${response.contentType || 'none'}); ` +
      'GeoServer may require authentication — configure username/password or the env variables.')
  }
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`${what} returned unparsable JSON (content-type ${response.contentType})`)
  }
}

/**
 * Enumerate GeoServer services. Primary path is the REST API (rich JSON);
 * when REST is unavailable (auth layout or older server), falls back to the
 * standard WMS GetCapabilities document.
 * @param baseUrl - GeoServer base URL.
 * @param credentials - resolved auth.
 * @param signal - caller cancellation.
 * @param timeoutMs - per-request timeout.
 * @param skipDetails - when true, layer details (title/bbox/srs) are skipped
 * for speed.
 * @returns the discovered services plus global styles and formats.
 */
export async function listServices(
  baseUrl: string,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
  skipDetails: boolean,
): Promise<{ services: WmsServiceInfo[]; styles: string[]; formats: string[] }> {
  const base = normalizeBaseUrl(baseUrl)
  const workspaces = parseRestList(
    await expectJson(await httpText(`${base}/rest/workspaces.json`, credentials, signal, timeoutMs), 'workspaces'),
    'workspace',
  )
  const layerNames = parseRestList(
    await expectJson(await httpText(`${base}/rest/layers.json`, credentials, signal, timeoutMs), 'layers'),
    'layer',
  )
  const globalStyles = parseRestList(
    await expectJson(await httpText(`${base}/rest/styles.json`, credentials, signal, timeoutMs), 'styles'),
    'style',
  )

  let layers: WmsLayerInfo[]
  if (skipDetails) {
    layers = layerNames.map(name => ({ name }))
  } else {
    const details = await Promise.all(
      layerNames.map(async (name): Promise<WmsLayerInfo> => {
        try {
          const detail = parseRestLayerDetail(
            await expectJson(
              await httpText(`${base}/rest/layers/${encodeURIComponent(name)}.json`, credentials, signal, timeoutMs),
              `layer ${name}`,
            ),
          )
          return { name, ...detail }
        } catch (error) {
          // A single layer detail failing (deleted mid-list, permission) must
          // not fail the whole enumeration; keep the bare name.
          return { name }
        }
      }),
    )
    layers = details
  }

  const services = workspaces.map((workspace): WmsServiceInfo => {
    const owned = layers.filter(layer => layer.name === workspace || layer.name.startsWith(`${workspace}:`))
    return {
      name: workspace,
      type: 'wms',
      layers: owned,
    }
  })
  // Layers whose workspace is not listed still need a home; group them under
  // the workspace prefix they carry.
  const listed = new Set(services.map(service => service.name))
  const stray = layers.filter(layer => !listed.has(layer.name.split(':')[0]))
  if (stray.length > 0) {
    services.push({ name: 'other', type: 'wms', layers: stray })
  }
  return { services, styles: globalStyles, formats: [...WMS_IMAGE_FORMATS] }
}

/** Fallback enumeration over the standard WMS GetCapabilities document. */
export async function listServicesFromCapabilities(
  baseUrl: string,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ services: WmsServiceInfo[]; styles: string[]; formats: string[] }> {
  const base = normalizeBaseUrl(baseUrl)
  const url = `${base}/wms?service=WMS&version=1.1.1&request=GetCapabilities`
  const response = await httpText(url, credentials, signal, timeoutMs)
  const body = expectOk(response, 'WMS GetCapabilities')
  const parsed: CapabilitiesResult = parseCapabilitiesXml(body)
  const formats = extractGetMapFormats(body)
  const services: WmsServiceInfo[] = [
    {
      name: 'wms',
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      type: 'wms',
      layers: parsed.layers,
    },
  ]
  const styles = [...new Set(parsed.layers.flatMap(layer => (layer.styles ?? []).map(style => style.name)))]
  return { services, styles, formats: formats.length > 0 ? formats : [...WMS_IMAGE_FORMATS] }
}

/** Extract `<Format>` values under a `<GetMap>` block from a capabilities document. */
function extractGetMapFormats(xml: string): string[] {
  const getMap = /<GetMap[^>]*>([\s\S]*?)<\/GetMap>/i.exec(xml)?.[1]
  if (getMap === undefined) return []
  const formats: string[] = []
  const re = /<Format>([\s\S]*?)<\/Format>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(getMap)) !== null) {
    const value = match[1].trim()
    if (value.length > 0) formats.push(value)
  }
  return formats
}

/**
 * Fetch one WMS GetMap image and cache it, returning the in-origin display
 * URL the browser can load directly.
 * @param baseUrl - GeoServer base URL.
 * @param params - GetMap parameters.
 * @param credentials - resolved auth.
 * @param signal - caller cancellation.
 * @param timeoutMs - per-request timeout.
 * @param cache - the image cache.
 * @param imageBase - the GUI base URL prefixing `/geoserver-image/...`.
 * @returns the canonical map result with the display URL.
 */
export async function fetchMapImage(
  baseUrl: string,
  params: GetMapParams,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
  cache: ImageCache,
  imageBase: string,
): Promise<{ url: string; layer: string; bbox: string; width: number; height: number; format: string; srs: string; mime: string }> {
  const url = buildGetMapUrl(baseUrl, params)
  const response = await httpBytes(url, credentials, signal, timeoutMs)
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`WMS GetMap failed with HTTP ${response.status}: ${response.bytes.toString('utf8').slice(0, 200)}`)
  }
  if (!/image\//i.test(response.contentType)) {
    throw new Error(`GetMap did not return an image (content-type ${response.contentType || 'none'}); ` +
      `body: ${response.bytes.toString('utf8').slice(0, 200)}`)
  }
  const token = cache.put(response.bytes, response.contentType || 'image/png')
  return {
    url: `${imageBase}/geoserver-image/${token}`,
    layer: params.layers,
    bbox: params.bbox.join(','),
    width: params.width,
    height: params.height,
    format: params.format,
    srs: params.srs ?? 'EPSG:4326',
    mime: response.contentType || 'image/png',
  }
}

/** Canonical value schemas shared by the GeoServer tools. */
const layerInfoSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    title: { type: 'string' },
    srs: { type: 'string' },
    bbox: { type: 'array', items: { type: 'number' } },
    styles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
  },
} as const

const serviceInfoSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    title: { type: 'string' },
    type: { type: 'string' },
    layers: { type: 'array', items: layerInfoSchema },
  },
} as const

const listResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    baseUrl: { type: 'string' },
    services: { type: 'array', items: serviceInfoSchema },
    styles: { type: 'array', items: { type: 'string' } },
    formats: { type: 'array', items: { type: 'string' } },
  },
} as const

const mapResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    url: { type: 'string' },
    layer: { type: 'string' },
    bbox: { type: 'string' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    format: { type: 'string' },
    srs: { type: 'string' },
    mime: { type: 'string' },
  },
} as const

const probeResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    baseUrl: { type: 'string' },
    reachable: { type: 'boolean' },
    httpStatus: { type: 'integer' },
    authRequired: { type: 'boolean' },
    authConfigured: { type: 'boolean' },
    wmsTitle: { type: 'string' },
    error: { type: 'string' },
    imageTest: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean' },
        mime: { type: 'string' },
        bytes: { type: 'integer' },
      },
    },
  },
} as const

const publicationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    workspace: { type: 'string' },
    layer: { type: 'string' },
    qualifiedName: { type: 'string' },
    kind: { type: 'string', enum: ['raster', 'vector'] },
    store: { type: 'string' },
    sourceName: { type: 'string' },
    createdWorkspace: { type: 'boolean' },
    srs: { type: 'string' },
    bbox: { type: 'array', items: { type: 'number' } },
    serviceUrls: {
      type: 'object',
      additionalProperties: false,
      properties: {
        wms: { type: 'string' },
        wfs: { type: 'string' },
        wcs: { type: 'string' },
      },
    },
  },
} as const

const publishResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    publication: publicationSchema,
    metadata: { type: 'object', additionalProperties: true },
    eventId: { type: 'string' },
    notification: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['not_configured', 'delivered', 'failed'] },
        httpStatus: { type: 'integer' },
        error: { type: 'string' },
      },
    },
  },
} as const

/**
 * Register the GeoServer tools plus the image and settings routes.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  // The authoritative configuration source: the resolved settings scope while
  // one is attached (schema defaults + entry base + user section), the
  // composition entry otherwise. Tools read through `current()` so a settings
  // write takes effect without a plugin reload.
  let current = (): Config => config
  installSettingsSection(ctx, GEOSERVER_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => { current = source },
    onChange: () => {},
  })

  // Basic auth for one call: config/env first, then the credentials domain the
  // settings card writes the password into. Resolve the optional service on
  // every operation so a provider mounted after this consumer, or remounted
  // during composition updates, takes effect without restarting the plugin.
  const credentials = () => resolveRuntimeCredentials(
    current(),
    ctx.get('credentials') as CredentialProvider | undefined,
  )
  const cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000
  const cacheMaxEntries = config.cacheMaxEntries ?? 50
  const timeoutMs = config.connectTimeoutMs ?? 15_000
  const cache = new ImageCache(cacheTtlMs, cacheMaxEntries)

  // Periodic TTL sweep keeps the cache bounded even without new requests.
  const timer = setInterval(() => cache.prune(), Math.min(cacheTtlMs, 60_000))
  timer.unref()
  ctx.effect(() => () => clearInterval(timer))

  // `webServer` is a declared injection: its activation gates this plugin, so
  // the route and the display-URL base are always available here.
  const webServer = ctx.webServer
  const resolvedConfig = current()
  const imageBase = resolvedConfig.publicBaseUrl !== undefined
    ? resolvedConfig.publicBaseUrl.replace(/\/+$/, '')
    : `http://127.0.0.1:${webServer.port}`

  webServer.register({
      kind: 'prefix',
      path: '/geoserver-image',
      handler: (req, res): void => {
        const pathname = new URL(req.url ?? '/', 'http://x').pathname
        const token = pathname.startsWith('/geoserver-image/') ? pathname.slice('/geoserver-image/'.length) : ''
        const entry = token === '' ? undefined : cache.get(token)
        if (entry === undefined) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('not found')
          return
        }
        res.writeHead(200, {
          'Content-Type': entry.mime,
          'Content-Length': entry.bytes.length,
          'Cache-Control': 'private, max-age=300',
        })
        res.end(entry.bytes)
      },
    })

  // The settings card reads and writes its section fields through this route
  // instead of the settings RPC, so the card renders on any host without the
  // `geoserver` namespace being allowlisted in the api-proxy settings gate.
  // The password never touches this route: the browser writes it through the
  // credentials domain (reference `GEOSERVER_PASS`), which is a separate RPC.
  // The registration rides the settings scoped fiber, so a host without a
  // settings service (every dsh before 0.1.0-rc.7) simply lacks the route and
  // the card degrades to entry configuration.
  ctx.inject(['settings'], (sctx) => {
    webServer.register({
      kind: 'exact',
      path: '/geoserver/config',
      handler: (req, res): void => {
        void (async () => {
          if (req.method === 'GET') {
            const resolved = current()
            const descriptor = sctx.settings.describe({ redactSecrets: true })
              .find(item => item.ns === GEOSERVER_SETTINGS_NAMESPACE)
            sendJson(res, 200, {
              value: {
                baseUrl: resolved.baseUrl,
                username: (await credentials()).username ?? '',
                publishRoots: resolved.publishRoots,
                defaultWorkspace: resolved.defaultWorkspace,
                publishMaxBytes: resolved.publishMaxBytes,
                webhookUrl: resolved.webhookUrl ?? '',
                webhookTokenEnv: resolved.webhookTokenEnv ?? '',
                webhookTimeoutMs: resolved.webhookTimeoutMs,
              },
              ...(descriptor?.base === undefined ? {} : { base: descriptor.base }),
              ...(descriptor?.user === undefined ? {} : { user: descriptor.user }),
            })
            return
          }
          if (req.method !== 'POST') {
            res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('method not allowed')
            return
          }
          if (!sameOrigin(req)) {
            sendJson(res, 403, { error: 'untrusted origin' })
            return
          }
          let body: unknown
          try {
            body = await readJsonBody(req)
          } catch {
            sendJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
          const patch: Record<string, unknown> = {}
          const stringFields = ['baseUrl', 'username', 'defaultWorkspace', 'webhookUrl', 'webhookTokenEnv'] as const
          const numberFields = ['publishMaxBytes', 'webhookTimeoutMs'] as const
          const supportedFields = new Set<string>([...stringFields, ...numberFields, 'publishRoots'])
          for (const key of stringFields) {
            const value = record[key]
            if (typeof value === 'string') patch[key] = value
          }
          for (const key of numberFields) {
            const value = record[key]
            if (typeof value === 'number') patch[key] = value
          }
          const publishRoots = record['publishRoots']
          if (Array.isArray(publishRoots) && publishRoots.every(value => typeof value === 'string')) {
            patch['publishRoots'] = publishRoots
          }
          const unset = record['unset']
          const unsetFields = Array.isArray(unset)
            ? unset.filter((key): key is string => typeof key === 'string' && supportedFields.has(key))
            : []
          if (Object.keys(patch).length > 0 || unsetFields.length > 0) {
            try {
              if (Object.keys(patch).length > 0) {
                await sctx.settings.update(GEOSERVER_SETTINGS_NAMESPACE, patch)
              }
              if (unsetFields.length > 0) {
                await sctx.settings.mutate(
                  GEOSERVER_SETTINGS_NAMESPACE,
                  unsetFields.map(path => ({ op: 'unset' as const, path: [path] })),
                )
              }
            } catch (error) {
              sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
              return
            }
          }
          sendJson(res, 200, { ok: true })
        })().catch((error) => {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        })
      },
    })
  })

  ctx.tools.register(defineTool({
    name: 'geoserver_list',
    description:
      'List the GeoServer services: workspaces, layers (with title/bbox/SRS and styles) and '
      + 'available image formats. Call this first to discover layer names and bounds before '
      + 'requesting maps. Reads the GeoServer REST API, falling back to the WMS GetCapabilities '
      + 'document when REST is unavailable.',
    parameters: {
      baseUrl: { type: 'string', description: 'Optional GeoServer base URL override; defaults to the configured server.' },
      skipDetails: {
        type: 'boolean',
        description: 'Skip per-layer title/bbox/SRS lookups for speed when only names are needed.',
      },
    },
    output: {
      schema: listResultSchema,
      render: (_args, value) => [{
        type: 'text',
        text: renderList(value),
      }],
    },
    async execute(args, exec) {
      const baseUrl = resolveBaseUrl(args.baseUrl ?? current().baseUrl)
      const skipDetails = args.skipDetails === true
      try {
        const result = await listServices(baseUrl, await credentials(), exec.signal, timeoutMs, skipDetails)
        return { baseUrl, ...mutableListResult(result) }
      } catch (error) {
        // REST is GeoServer-specific; fall back to the OGC-standard document
        // before giving up, so any WMS-compatible server still works.
        try {
          const result = await listServicesFromCapabilities(baseUrl, await credentials(), exec.signal, timeoutMs)
          return { baseUrl, ...mutableListResult(result) }
        } catch {
          throw error instanceof Error ? error : new Error(String(error))
        }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'geoserver_map',
    description:
      'Render a GeoServer layer as a map image. Builds a WMS GetMap request, fetches the image '
      + 'server-side (credentials never reach the browser), and returns an in-origin display URL. '
      + 'When you reply, include the returned markdown image exactly as rendered — do not omit or '
      + 'rewrite the URL. Prefer bounds from geoserver_list; a missing bbox is resolved from the '
      + 'layer metadata automatically.',
    parameters: {
      layer: { type: 'string', required: true, description: 'Layer name, e.g. `topp:states` or `states`.' },
      bbox: {
        type: 'array',
        items: { type: 'number' },
        description: 'Bounding box [minx, miny, maxx, maxy] in the SRS (decimal degrees for EPSG:4326). Optional: auto-resolved from layer metadata.',
      },
      width: { type: 'integer', description: 'Image width in pixels; default 800.' },
      height: { type: 'integer', description: 'Image height in pixels; default 600.' },
      format: {
        type: 'string',
        description: `Output format; one of ${WMS_IMAGE_FORMATS.join(', ')}; default image/png.`,
      },
      style: { type: 'string', description: 'Optional style name (see geoserver_list).' },
      transparent: { type: 'boolean', description: 'Transparent background; default false.' },
      srs: { type: 'string', description: 'SRS code; default EPSG:4326.' },
    },
    output: {
      schema: mapResultSchema,
      render: (_args, value) => value.url !== undefined && value.url.length > 0
        ? [{
          type: 'text',
          text: `![${value.layer ?? value.url}](${value.url})\n\n`
            + `Map of **${value.layer ?? ''}** ready (${value.width ?? '?'}×${value.height ?? '?'}, ${value.mime ?? '?'}). `
            + 'Include the image markdown above in your reply unchanged.',
        }]
        : [{ type: 'text', text: 'Map generation failed; the image URL is empty.' }],
    },
    async execute(args, exec) {
      const width = clampInt(args.width, 100, 4096, 800)
      const height = clampInt(args.height, 100, 4096, 600)
      const format = WMS_IMAGE_FORMATS.includes(args.format as typeof WMS_IMAGE_FORMATS[number])
        ? args.format!
        : 'image/png'
      const layer = args.layer.trim()
      if (layer.length === 0) throw new Error('layer must be a non-empty string')
      const baseUrl = resolveBaseUrl(current().baseUrl)

      let bbox: readonly [number, number, number, number] | undefined =
        args.bbox !== undefined && args.bbox.length === 4 && args.bbox.every(Number.isFinite)
          ? (args.bbox as [number, number, number, number])
          : undefined
      if (bbox === undefined) {
        const resolved = await resolveLayerBounds(baseUrl, layer, await credentials(), exec.signal, timeoutMs)
        if (resolved === undefined) {
          throw new Error(
            `no bounding box available for layer ${layer} — pass bbox [minx, miny, maxx, maxy] explicitly`,
          )
        }
        bbox = resolved
      }
      const params: GetMapParams = {
        layers: layer,
        bbox: bbox as [number, number, number, number],
        width,
        height,
        format,
        ...(args.style !== undefined && args.style.length > 0 ? { styles: args.style } : {}),
        ...(args.srs !== undefined && args.srs.length > 0 ? { srs: args.srs } : {}),
        ...(args.transparent !== undefined ? { transparent: args.transparent } : {}),
      }
      return await fetchMapImage(
        baseUrl,
        params,
        await credentials(),
        exec.signal,
        timeoutMs,
        cache,
        imageBase,
      )
    },
  }))

  ctx.tools.register(defineTool({
    name: 'geoserver_publish',
    description:
      'Publish one local GeoTIFF (.tif/.tiff) or one ZIP containing a single SHP dataset to '
      + 'GeoServer. The source file must be inside a configured publishRoots directory. Existing '
      + 'layers are never replaced. After GeoServer confirms the layer, the tool optionally sends '
      + 'the result and caller metadata to the administrator-configured business webhook.',
    parameters: {
      kind: {
        type: 'string',
        enum: ['raster', 'vector'],
        required: true,
        description: 'raster uploads a GeoTIFF; vector uploads a ZIP containing one SHP dataset.',
      },
      sourcePath: {
        type: 'string',
        required: true,
        description: 'Absolute or workspace-relative source path inside config.publishRoots.',
      },
      workspace: {
        type: 'string',
        description: 'Target GeoServer workspace; defaults to the workspace configured in the settings card.',
      },
      layerName: {
        type: 'string',
        description: 'Layer name; defaults to the source filename without its extension. A vector ZIP must contain a same-named SHP dataset.',
      },
      storeName: { type: 'string', description: 'GeoServer store name; defaults to the layer name.' },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Optional flat business identifiers forwarded unchanged to the configured webhook.',
      },
    },
    output: {
      schema: publishResultSchema,
      render: (_args, value) => [{
        type: 'text',
        text: value.publication === undefined
          ? 'GeoServer publication returned no layer information.'
          : `Published **${value.publication.qualifiedName ?? value.publication.layer ?? 'layer'}** as `
            + `${value.publication.kind ?? 'unknown'} data. Business notification: `
            + `${value.notification?.status ?? 'unknown'}.`,
      }],
    },
    async execute(args, exec) {
      const resolved = current()
      const baseUrl = resolveBaseUrl(resolved.baseUrl)
      const workspace = resolvePublishWorkspace(args.workspace, resolved.defaultWorkspace)
      const result = await publishLayerFile(
        baseUrl,
        await credentials(),
        {
          kind: args.kind,
          sourcePath: args.sourcePath,
          workspace,
          ...(args.layerName === undefined ? {} : { layerName: args.layerName }),
          ...(args.storeName === undefined ? {} : { storeName: args.storeName }),
          ...(args.metadata === undefined ? {} : { metadata: args.metadata }),
        },
        { allowedRoots: resolved.publishRoots, maxBytes: resolved.publishMaxBytes },
        exec.signal,
        timeoutMs,
      )
      const event = createPublicationEvent(result.publication, result.metadata)
      const webhookToken = resolved.webhookTokenEnv === undefined
        ? undefined
        : process.env[resolved.webhookTokenEnv]
      const notification = resolved.webhookTokenEnv !== undefined && webhookToken === undefined
        ? {
            status: 'failed' as const,
            error: `webhook token environment variable ${resolved.webhookTokenEnv} is not set`,
          }
        : await deliverPublicationWebhook(
            resolved.webhookUrl,
            webhookToken,
            event,
            exec.signal,
            resolved.webhookTimeoutMs,
          )
      const publication = result.publication
      return {
        publication: {
          workspace: publication.workspace,
          layer: publication.layer,
          qualifiedName: publication.qualifiedName,
          kind: publication.kind,
          store: publication.store,
          sourceName: publication.sourceName,
          createdWorkspace: publication.createdWorkspace,
          ...(publication.srs === undefined ? {} : { srs: publication.srs }),
          ...(publication.bbox === undefined ? {} : { bbox: Array.from(publication.bbox) }),
          serviceUrls: { ...publication.serviceUrls },
        },
        metadata: { ...result.metadata },
        eventId: event.eventId,
        notification,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'geoserver_probe',
    description:
      'Diagnose GeoServer connectivity and authentication. Reports whether the server is '
      + 'reachable, whether authentication is required and configured, the WMS service title, '
      + 'and optionally verifies that a small map image can actually be produced.',
    parameters: {
      baseUrl: { type: 'string', description: 'Optional GeoServer base URL override; defaults to the configured server.' },
      layer: { type: 'string', description: 'Optional layer to test map rendering against.' },
    },
    output: {
      schema: probeResultSchema,
      render: (_args, value) => [{ type: 'text', text: renderProbe(value) }],
    },
    async execute(args, exec) {
      const baseUrl = resolveBaseUrl(args.baseUrl ?? current().baseUrl)
      const probe = await probeServer(baseUrl, await credentials(), exec.signal, timeoutMs, args.layer)
      return probe
    },
  }))
}

/**
 * Plain mutable projections of the list schema's inferred value shape (all
 * fields optional, matching `ValueSchemaSpec` inference). The list tool's
 * execute returns these, and the render helpers accept them, so the schema
 * boundary is the single source of the shape.
 */
interface RenderStyleInfo {
  name?: string
  title?: string
}

interface RenderLayerInfo {
  name?: string
  title?: string
  srs?: string
  bbox?: number[]
  styles?: RenderStyleInfo[]
}

interface RenderServiceInfo {
  name?: string
  title?: string
  type?: string
  layers?: RenderLayerInfo[]
}

interface RenderListResult {
  baseUrl?: string
  services?: RenderServiceInfo[]
  styles?: string[]
  formats?: string[]
}

/**
 * Project the readonly list result into the plain mutable shape the output
 * schema infers (JSON round-trip semantics); the schema rejects nothing here,
 * this only satisfies TypeScript's readonly-vs-mutable assignability.
 */
function mutableListResult(result: {
  services: readonly WmsServiceInfo[]
  styles: readonly string[]
  formats: readonly string[]
}): RenderListResult {
  return {
    services: result.services.map(service => ({
      name: service.name,
      ...(service.title !== undefined ? { title: service.title } : {}),
      type: service.type,
      layers: service.layers.map(layer => ({
        name: layer.name,
        ...(layer.title !== undefined ? { title: layer.title } : {}),
        ...(layer.srs !== undefined ? { srs: layer.srs } : {}),
        ...(layer.bbox !== undefined ? { bbox: [...layer.bbox] } : {}),
        ...(layer.styles !== undefined
          ? { styles: layer.styles.map(style => ({
            name: style.name,
            ...(style.title !== undefined ? { title: style.title } : {}),
          })) }
          : {}),
      })),
    })),
    styles: [...result.styles],
    formats: [...result.formats],
  }
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {  if (value === undefined) return fallback
  const clamped = Math.max(min, Math.min(max, Math.trunc(value)))
  if (!Number.isFinite(value) || value !== clamped) return fallback
  return clamped
}

/** Resolve a layer's geographic bounds from the REST metadata when the caller omitted bbox. */
async function resolveLayerBounds(
  baseUrl: string,
  layer: string,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<readonly [number, number, number, number] | undefined> {
  try {
    const json = await expectJson(
      await httpText(`${baseUrl}/rest/layers/${encodeURIComponent(layer)}.json`, credentials, signal, timeoutMs),
      `layer ${layer}`,
    )
    return parseRestLayerDetail(json).bbox
  } catch {
    return undefined
  }
}

/** Run the connectivity/authentication/image diagnostics. */
export async function probeServer(
  baseUrl: string,
  credentials: ResolvedCredentials,
  signal: AbortSignal,
  timeoutMs: number,
  testLayer?: string,
): Promise<{
  baseUrl: string
  reachable: boolean
  httpStatus: number
  authRequired: boolean
  authConfigured: boolean
  wmsTitle?: string
  error?: string
  imageTest?: { ok: boolean; mime: string; bytes: number }
}> {
  const base = normalizeBaseUrl(baseUrl)
  const authConfigured = credentials.username !== undefined && credentials.password !== undefined
  let capabilities: { title?: string; layers: readonly WmsLayerInfo[] } | undefined
  let status = 0
  let reachable = false
  let authRequired = false

  // The REST API answers immediately with a crisp 401/403 when authentication
  // is missing, while the WMS capabilities document can hang on anonymous
  // access; probe REST first for reachability and auth state.
  try {
    const rest = await httpText(`${base}/rest/workspaces.json`, credentials, signal, timeoutMs)
    status = rest.status
    if (rest.status === 200) {
      reachable = true
      authRequired = false
    } else if (rest.status === 401 || rest.status === 403) {
      reachable = true
      authRequired = true
    } else {
      reachable = true
    }
  } catch (error) {
    // REST failed (proxy, path layout, timeout): fall back to the standard
    // WMS capabilities document before declaring the server unreachable.
    try {
      const cap = await httpText(
        `${base}/wms?service=WMS&version=1.1.1&request=GetCapabilities`,
        credentials,
        signal,
        timeoutMs,
      )
      status = cap.status
      if (cap.status === 200) {
        reachable = true
        authRequired = !/xml/i.test(cap.contentType)
        capabilities = parseCapabilitiesXml(cap.body)
      } else {
        reachable = true
        authRequired = cap.status === 401 || cap.status === 403
      }
    } catch (fallbackError) {
      return {
        baseUrl: base,
        reachable: false,
        httpStatus: 0,
        authRequired: false,
        authConfigured,
        ...(fallbackError instanceof Error ? { error: fallbackError.message } : {}),
      }
    }
  }

  // Best-effort WMS title from the capabilities document; a slow anonymous
  // capabilities response must not fail the probe, so bound it separately.
  if (reachable && capabilities === undefined) {
    try {
      const cap = await httpText(
        `${base}/wms?service=WMS&version=1.1.1&request=GetCapabilities`,
        credentials,
        signal,
        timeoutMs,
      )
      if (cap.status === 200 && /xml/i.test(cap.contentType)) {
        capabilities = parseCapabilitiesXml(cap.body)
      }
    } catch {
      // Title is diagnostic only; ignore failures here.
    }
  }

  let imageTest: { ok: boolean; mime: string; bytes: number } | undefined
  if (reachable) {
    try {
      const layer = testLayer ?? capabilities?.layers[0]?.name
      if (layer !== undefined) {
        const response = await httpBytes(
          buildGetMapUrl(base, {
            layers: layer,
            bbox: capabilities?.layers[0]?.bbox ?? [0, 0, 1, 1],
            width: 100,
            height: 100,
            format: 'image/png',
          }),
          credentials,
          signal,
          timeoutMs,
        )
        imageTest = {
          ok: response.status >= 200 && response.status < 300 && /image\//i.test(response.contentType),
          mime: response.contentType || 'unknown',
          bytes: response.bytes.length,
        }
      }
    } catch {
      imageTest = { ok: false, mime: 'unknown', bytes: 0 }
    }
  }

  return {
    baseUrl: base,
    reachable,
    httpStatus: status,
    authRequired,
    authConfigured,
    ...(capabilities?.title !== undefined ? { wmsTitle: capabilities.title } : {}),
    ...(imageTest !== undefined ? { imageTest } : {}),
  }
}

/** Render the list result as model-facing markdown. */
function renderList(value: RenderListResult): string {
  const lines: string[] = []
  const services = value.services ?? []
  const styles = value.styles ?? []
  const formats = value.formats ?? []
  lines.push(`GeoServer at ${value.baseUrl ?? '(unknown)'}: ${services.length} service(s).`)
  for (const service of services) {
    const layers = service.layers ?? []
    lines.push(`\n### ${service.name ?? '(unnamed)'}${service.title !== undefined ? ` — ${service.title}` : ''} (${layers.length} layers)`)
    for (const layer of layers) {
      const meta: string[] = []
      if (layer.title !== undefined && layer.title !== layer.name) meta.push(layer.title)
      if (layer.bbox !== undefined) meta.push(`bbox ${layer.bbox.join(',')}`)
      if (layer.srs !== undefined) meta.push(layer.srs)
      const stylesList = layer.styles?.map(style => style.name).join(',')
      if (stylesList !== undefined && stylesList.length > 0) meta.push(`styles: ${stylesList}`)
      lines.push(`- \`${layer.name ?? ''}\`${meta.length > 0 ? ` — ${meta.join(' · ')}` : ''}`)
    }
  }
  lines.push(`\nGlobal styles: ${styles.join(', ') || '(none)'}`)
  lines.push(`Formats: ${formats.join(', ')}`)
  return lines.join('\n')
}

/** Render the probe result as model-facing markdown. */
function renderProbe(value: {
  baseUrl?: string
  reachable?: boolean
  httpStatus?: number
  authRequired?: boolean
  authConfigured?: boolean
  wmsTitle?: string
  error?: string
  imageTest?: { ok?: boolean; mime?: string; bytes?: number }
}): string {
  const lines: string[] = []
  lines.push(`GeoServer probe at ${value.baseUrl ?? '(unknown)'}:`)
  lines.push(`- reachable: ${value.reachable ?? false}${value.httpStatus !== undefined && value.httpStatus > 0 ? ` (HTTP ${value.httpStatus})` : ''}`)
  lines.push(`- authentication required: ${value.authRequired ?? false}, configured: ${value.authConfigured ?? false}`)
  if (value.wmsTitle !== undefined) lines.push(`- WMS title: ${value.wmsTitle}`)
  if (value.error !== undefined) lines.push(`- error: ${value.error}`)
  if (value.imageTest !== undefined) {
    lines.push(
      `- image test: ${value.imageTest.ok ? 'ok' : 'failed'} (${value.imageTest.mime ?? 'unknown'}, ${value.imageTest.bytes ?? 0} bytes)`,
    )
  }
  return lines.join('\n')
}

// Re-exported for tests and doc-sync consumers.
export type { ImageCacheEntry }
export type { WmsLayerInfo, WmsServiceInfo, WmsStyleInfo }
