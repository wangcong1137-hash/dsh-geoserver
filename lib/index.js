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
 *  - `geoserver_probe`: connectivity/authentication diagnostics.
 *
 * A settings card in the web GUI (Settings → Plugins → Plugin configuration)
 * edits the `geoserver` settings namespace this plugin registers; tools read
 * the resolved section per call, so a saved change takes effect immediately.
 *
 * The `/geoserver-image/<token>` route is registered on `ctx.webServer` when
 * the web surface is composed; tokens are random UUIDs bound to a short TTL
 * cache, so the browser never sees GeoServer credentials.
 */
import { randomUUID } from 'node:crypto';
import { clearInterval, setInterval } from 'node:timers';
import z from '@deepseek-ai/schemastery';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { WMS_IMAGE_FORMATS, basicAuthHeader, buildGetMapUrl, normalizeBaseUrl, parseCapabilitiesXml, parseRestLayerDetail, parseRestList, } from './geoserver.js';
export const name = 'geoserver';
export const inject = ['tools', 'webServer'];
/** Schemastery configuration for the geoserver consumer. */
export const Config = z.object({
    baseUrl: z.string().required(),
    username: z.string(),
    password: z.string().role('secret'),
    env: z.array(z.string()),
    cacheTtlMs: z.number(),
    cacheMaxEntries: z.number(),
    publicBaseUrl: z.string(),
    connectTimeoutMs: z.number(),
});
/** Settings namespace carrying the configured server, username, and password. */
export const GEOSERVER_SETTINGS_NAMESPACE = settingsNamespace('geoserver');
/** Merge direct config credentials with environment-provided ones. */
export function resolveCredentials(config) {
    let username = config.username;
    let password = config.password;
    for (const key of config.env ?? []) {
        const value = process.env[key];
        if (value === undefined)
            continue;
        if (username === undefined && /user/i.test(key))
            username = value;
        else if (password === undefined && /pass|pwd|token/i.test(key))
            password = value;
    }
    return { ...(username !== undefined ? { username } : {}), ...(password !== undefined ? { password } : {}) };
}
/** Bounded TTL cache keyed by random image token. */
class ImageCache {
    entries = new Map();
    ttlMs;
    maxEntries;
    constructor(ttlMs, maxEntries) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }
    /** Store an image and return its token. */
    put(bytes, mime) {
        this.prune();
        const token = randomUUID();
        this.entries.set(token, { bytes, mime, expires: Date.now() + this.ttlMs });
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined)
                break;
            this.entries.delete(oldest);
        }
        return token;
    }
    /** Read an unexpired entry by token; expired entries are removed. */
    get(token) {
        const entry = this.entries.get(token);
        if (entry === undefined)
            return undefined;
        if (entry.expires < Date.now()) {
            this.entries.delete(token);
            return undefined;
        }
        return entry;
    }
    /** Drop expired entries. */
    prune() {
        const now = Date.now();
        for (const [token, entry] of this.entries) {
            if (entry.expires < now)
                this.entries.delete(token);
        }
    }
    /** Number of live entries (diagnostics). */
    get size() {
        return this.entries.size;
    }
}
/** One HTTP round-trip with Basic auth and a bounded timeout honoring `exec.signal`. */
async function httpText(url, credentials, signal, timeoutMs) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json, application/xml, text/xml, text/plain;q=0.9, */*;q=0.5',
            ...authHeaders(credentials),
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    const body = await response.text();
    return {
        status: response.status,
        body,
        contentType: response.headers.get('content-type') ?? '',
    };
}
/** One HTTP round-trip returning raw bytes (for image payloads). */
async function httpBytes(url, credentials, signal, timeoutMs) {
    const response = await fetch(url, {
        headers: {
            Accept: 'image/png, image/jpeg, image/gif, image/tiff, */*',
            ...authHeaders(credentials),
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
        status: response.status,
        bytes,
        contentType: response.headers.get('content-type') ?? '',
    };
}
function authHeaders(credentials) {
    return credentials.username !== undefined && credentials.password !== undefined
        ? { Authorization: basicAuthHeader(credentials.username, credentials.password) }
        : {};
}
/** Assert a 2xx response and return its text body; throws a diagnostic on failure. */
function expectOk(response, what) {
    if (response.status >= 200 && response.status < 300)
        return response.body;
    const error = new Error(`${what} failed with HTTP ${response.status}: ${response.body.slice(0, 300)}`);
    error.status = response.status;
    throw error;
}
/** Assert the response looks like JSON (GeoServer REST serves login HTML on 302-follows). */
function expectJson(response, what) {
    const body = expectOk(response, what);
    if (!/json/i.test(response.contentType)) {
        throw new Error(`${what} did not return JSON (content-type ${response.contentType || 'none'}); ` +
            'GeoServer may require authentication — configure username/password or the env variables.');
    }
    try {
        return JSON.parse(body);
    }
    catch {
        throw new Error(`${what} returned unparsable JSON (content-type ${response.contentType})`);
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
export async function listServices(baseUrl, credentials, signal, timeoutMs, skipDetails) {
    const base = normalizeBaseUrl(baseUrl);
    const workspaces = parseRestList(await expectJson(await httpText(`${base}/rest/workspaces.json`, credentials, signal, timeoutMs), 'workspaces'), 'workspace');
    const layerNames = parseRestList(await expectJson(await httpText(`${base}/rest/layers.json`, credentials, signal, timeoutMs), 'layers'), 'layer');
    const globalStyles = parseRestList(await expectJson(await httpText(`${base}/rest/styles.json`, credentials, signal, timeoutMs), 'styles'), 'style');
    let layers;
    if (skipDetails) {
        layers = layerNames.map(name => ({ name }));
    }
    else {
        const details = await Promise.all(layerNames.map(async (name) => {
            try {
                const detail = parseRestLayerDetail(await expectJson(await httpText(`${base}/rest/layers/${encodeURIComponent(name)}.json`, credentials, signal, timeoutMs), `layer ${name}`));
                return { name, ...detail };
            }
            catch (error) {
                // A single layer detail failing (deleted mid-list, permission) must
                // not fail the whole enumeration; keep the bare name.
                return { name };
            }
        }));
        layers = details;
    }
    const services = workspaces.map((workspace) => {
        const owned = layers.filter(layer => layer.name === workspace || layer.name.startsWith(`${workspace}:`));
        return {
            name: workspace,
            type: 'wms',
            layers: owned,
        };
    });
    // Layers whose workspace is not listed still need a home; group them under
    // the workspace prefix they carry.
    const listed = new Set(services.map(service => service.name));
    const stray = layers.filter(layer => !listed.has(layer.name.split(':')[0]));
    if (stray.length > 0) {
        services.push({ name: 'other', type: 'wms', layers: stray });
    }
    return { services, styles: globalStyles, formats: [...WMS_IMAGE_FORMATS] };
}
/** Fallback enumeration over the standard WMS GetCapabilities document. */
export async function listServicesFromCapabilities(baseUrl, credentials, signal, timeoutMs) {
    const base = normalizeBaseUrl(baseUrl);
    const url = `${base}/wms?service=WMS&version=1.1.1&request=GetCapabilities`;
    const response = await httpText(url, credentials, signal, timeoutMs);
    const body = expectOk(response, 'WMS GetCapabilities');
    const parsed = parseCapabilitiesXml(body);
    const formats = extractGetMapFormats(body);
    const services = [
        {
            name: 'wms',
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            type: 'wms',
            layers: parsed.layers,
        },
    ];
    const styles = [...new Set(parsed.layers.flatMap(layer => (layer.styles ?? []).map(style => style.name)))];
    return { services, styles, formats: formats.length > 0 ? formats : [...WMS_IMAGE_FORMATS] };
}
/** Extract `<Format>` values under a `<GetMap>` block from a capabilities document. */
function extractGetMapFormats(xml) {
    const getMap = /<GetMap[^>]*>([\s\S]*?)<\/GetMap>/i.exec(xml)?.[1];
    if (getMap === undefined)
        return [];
    const formats = [];
    const re = /<Format>([\s\S]*?)<\/Format>/g;
    let match;
    while ((match = re.exec(getMap)) !== null) {
        const value = match[1].trim();
        if (value.length > 0)
            formats.push(value);
    }
    return formats;
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
export async function fetchMapImage(baseUrl, params, credentials, signal, timeoutMs, cache, imageBase) {
    const url = buildGetMapUrl(baseUrl, params);
    const response = await httpBytes(url, credentials, signal, timeoutMs);
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`WMS GetMap failed with HTTP ${response.status}: ${response.bytes.toString('utf8').slice(0, 200)}`);
    }
    if (!/image\//i.test(response.contentType)) {
        throw new Error(`GetMap did not return an image (content-type ${response.contentType || 'none'}); ` +
            `body: ${response.bytes.toString('utf8').slice(0, 200)}`);
    }
    const token = cache.put(response.bytes, response.contentType || 'image/png');
    return {
        url: `${imageBase}/geoserver-image/${token}`,
        layer: params.layers,
        bbox: params.bbox.join(','),
        width: params.width,
        height: params.height,
        format: params.format,
        srs: params.srs ?? 'EPSG:4326',
        mime: response.contentType || 'image/png',
    };
}
/** Canonical value schema shared by the three tools' `output.schema`. */
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
};
const serviceInfoSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        name: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string' },
        layers: { type: 'array', items: layerInfoSchema },
    },
};
const listResultSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        baseUrl: { type: 'string' },
        services: { type: 'array', items: serviceInfoSchema },
        styles: { type: 'array', items: { type: 'string' } },
        formats: { type: 'array', items: { type: 'string' } },
    },
};
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
};
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
};
/**
 * Register the three geoserver tools plus the image route.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - plugin configuration.
 */
export function apply(ctx, config) {
    // The authoritative configuration source: the resolved settings scope while
    // one is attached (schema defaults + entry base + user section), the
    // composition entry otherwise. Tools read through `current()` so a settings
    // write takes effect without a plugin reload.
    let current = () => config;
    installSettingsSection(ctx, GEOSERVER_SETTINGS_NAMESPACE, Config, config, {
        setSource: (source) => { current = source; },
        onChange: () => { },
    });
    const credentials = () => resolveCredentials(current());
    const cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
    const cacheMaxEntries = config.cacheMaxEntries ?? 50;
    const timeoutMs = config.connectTimeoutMs ?? 15_000;
    const cache = new ImageCache(cacheTtlMs, cacheMaxEntries);
    // Periodic TTL sweep keeps the cache bounded even without new requests.
    const timer = setInterval(() => cache.prune(), Math.min(cacheTtlMs, 60_000));
    timer.unref();
    ctx.effect(() => () => clearInterval(timer));
    // `webServer` is a declared injection: its activation gates this plugin, so
    // the route and the display-URL base are always available here.
    const webServer = ctx.webServer;
    const resolvedConfig = current();
    const imageBase = resolvedConfig.publicBaseUrl !== undefined
        ? resolvedConfig.publicBaseUrl.replace(/\/+$/, '')
        : `http://127.0.0.1:${webServer.port}`;
    webServer.register({
        kind: 'prefix',
        path: '/geoserver-image',
        handler: (req, res) => {
            const pathname = new URL(req.url ?? '/', 'http://x').pathname;
            const token = pathname.startsWith('/geoserver-image/') ? pathname.slice('/geoserver-image/'.length) : '';
            const entry = token === '' ? undefined : cache.get(token);
            if (entry === undefined) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('not found');
                return;
            }
            res.writeHead(200, {
                'Content-Type': entry.mime,
                'Content-Length': entry.bytes.length,
                'Cache-Control': 'private, max-age=300',
            });
            res.end(entry.bytes);
        },
    });
    ctx.tools.register(defineTool({
        name: 'geoserver_list',
        description: 'List the GeoServer services: workspaces, layers (with title/bbox/SRS and styles) and '
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
            const baseUrl = normalizeBaseUrl(args.baseUrl ?? current().baseUrl);
            const skipDetails = args.skipDetails === true;
            try {
                const result = await listServices(baseUrl, credentials(), exec.signal, timeoutMs, skipDetails);
                return { baseUrl, ...mutableListResult(result) };
            }
            catch (error) {
                // REST is GeoServer-specific; fall back to the OGC-standard document
                // before giving up, so any WMS-compatible server still works.
                try {
                    const result = await listServicesFromCapabilities(baseUrl, credentials(), exec.signal, timeoutMs);
                    return { baseUrl, ...mutableListResult(result) };
                }
                catch {
                    throw error instanceof Error ? error : new Error(String(error));
                }
            }
        },
    }));
    ctx.tools.register(defineTool({
        name: 'geoserver_map',
        description: 'Render a GeoServer layer as a map image. Builds a WMS GetMap request, fetches the image '
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
            const width = clampInt(args.width, 100, 4096, 800);
            const height = clampInt(args.height, 100, 4096, 600);
            const format = WMS_IMAGE_FORMATS.includes(args.format)
                ? args.format
                : 'image/png';
            const layer = args.layer.trim();
            if (layer.length === 0)
                throw new Error('layer must be a non-empty string');
            const baseUrl = normalizeBaseUrl(current().baseUrl);
            let bbox = args.bbox !== undefined && args.bbox.length === 4 && args.bbox.every(Number.isFinite)
                ? args.bbox
                : undefined;
            if (bbox === undefined) {
                const resolved = await resolveLayerBounds(baseUrl, layer, credentials(), exec.signal, timeoutMs);
                if (resolved === undefined) {
                    throw new Error(`no bounding box available for layer ${layer} — pass bbox [minx, miny, maxx, maxy] explicitly`);
                }
                bbox = resolved;
            }
            const params = {
                layers: layer,
                bbox: bbox,
                width,
                height,
                format,
                ...(args.style !== undefined && args.style.length > 0 ? { styles: args.style } : {}),
                ...(args.srs !== undefined && args.srs.length > 0 ? { srs: args.srs } : {}),
                ...(args.transparent !== undefined ? { transparent: args.transparent } : {}),
            };
            return await fetchMapImage(baseUrl, params, credentials(), exec.signal, timeoutMs, cache, imageBase);
        },
    }));
    ctx.tools.register(defineTool({
        name: 'geoserver_probe',
        description: 'Diagnose GeoServer connectivity and authentication. Reports whether the server is '
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
            const baseUrl = normalizeBaseUrl(args.baseUrl ?? current().baseUrl);
            const probe = await probeServer(baseUrl, credentials(), exec.signal, timeoutMs, args.layer);
            return probe;
        },
    }));
}
/**
 * Project the readonly list result into the plain mutable shape the output
 * schema infers (JSON round-trip semantics); the schema rejects nothing here,
 * this only satisfies TypeScript's readonly-vs-mutable assignability.
 */
function mutableListResult(result) {
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
    };
}
function clampInt(value, min, max, fallback) {
    if (value === undefined)
        return fallback;
    const clamped = Math.max(min, Math.min(max, Math.trunc(value)));
    if (!Number.isFinite(value) || value !== clamped)
        return fallback;
    return clamped;
}
/** Resolve a layer's geographic bounds from the REST metadata when the caller omitted bbox. */
async function resolveLayerBounds(baseUrl, layer, credentials, signal, timeoutMs) {
    try {
        const json = await expectJson(await httpText(`${baseUrl}/rest/layers/${encodeURIComponent(layer)}.json`, credentials, signal, timeoutMs), `layer ${layer}`);
        return parseRestLayerDetail(json).bbox;
    }
    catch {
        return undefined;
    }
}
/** Run the connectivity/authentication/image diagnostics. */
export async function probeServer(baseUrl, credentials, signal, timeoutMs, testLayer) {
    const base = normalizeBaseUrl(baseUrl);
    const authConfigured = credentials.username !== undefined && credentials.password !== undefined;
    let capabilities;
    let status = 0;
    let reachable = false;
    let authRequired = false;
    // The REST API answers immediately with a crisp 401/403 when authentication
    // is missing, while the WMS capabilities document can hang on anonymous
    // access; probe REST first for reachability and auth state.
    try {
        const rest = await httpText(`${base}/rest/workspaces.json`, credentials, signal, timeoutMs);
        status = rest.status;
        if (rest.status === 200) {
            reachable = true;
            authRequired = false;
        }
        else if (rest.status === 401 || rest.status === 403) {
            reachable = true;
            authRequired = true;
        }
        else {
            reachable = true;
        }
    }
    catch (error) {
        // REST failed (proxy, path layout, timeout): fall back to the standard
        // WMS capabilities document before declaring the server unreachable.
        try {
            const cap = await httpText(`${base}/wms?service=WMS&version=1.1.1&request=GetCapabilities`, credentials, signal, timeoutMs);
            status = cap.status;
            if (cap.status === 200) {
                reachable = true;
                authRequired = !/xml/i.test(cap.contentType);
                capabilities = parseCapabilitiesXml(cap.body);
            }
            else {
                reachable = true;
                authRequired = cap.status === 401 || cap.status === 403;
            }
        }
        catch (fallbackError) {
            return {
                baseUrl: base,
                reachable: false,
                httpStatus: 0,
                authRequired: false,
                authConfigured,
                ...(fallbackError instanceof Error ? { error: fallbackError.message } : {}),
            };
        }
    }
    // Best-effort WMS title from the capabilities document; a slow anonymous
    // capabilities response must not fail the probe, so bound it separately.
    if (reachable && capabilities === undefined) {
        try {
            const cap = await httpText(`${base}/wms?service=WMS&version=1.1.1&request=GetCapabilities`, credentials, signal, timeoutMs);
            if (cap.status === 200 && /xml/i.test(cap.contentType)) {
                capabilities = parseCapabilitiesXml(cap.body);
            }
        }
        catch {
            // Title is diagnostic only; ignore failures here.
        }
    }
    let imageTest;
    if (reachable) {
        try {
            const layer = testLayer ?? capabilities?.layers[0]?.name;
            if (layer !== undefined) {
                const response = await httpBytes(buildGetMapUrl(base, {
                    layers: layer,
                    bbox: capabilities?.layers[0]?.bbox ?? [0, 0, 1, 1],
                    width: 100,
                    height: 100,
                    format: 'image/png',
                }), credentials, signal, timeoutMs);
                imageTest = {
                    ok: response.status >= 200 && response.status < 300 && /image\//i.test(response.contentType),
                    mime: response.contentType || 'unknown',
                    bytes: response.bytes.length,
                };
            }
        }
        catch {
            imageTest = { ok: false, mime: 'unknown', bytes: 0 };
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
    };
}
/** Render the list result as model-facing markdown. */
function renderList(value) {
    const lines = [];
    const services = value.services ?? [];
    const styles = value.styles ?? [];
    const formats = value.formats ?? [];
    lines.push(`GeoServer at ${value.baseUrl ?? '(unknown)'}: ${services.length} service(s).`);
    for (const service of services) {
        const layers = service.layers ?? [];
        lines.push(`\n### ${service.name ?? '(unnamed)'}${service.title !== undefined ? ` — ${service.title}` : ''} (${layers.length} layers)`);
        for (const layer of layers) {
            const meta = [];
            if (layer.title !== undefined && layer.title !== layer.name)
                meta.push(layer.title);
            if (layer.bbox !== undefined)
                meta.push(`bbox ${layer.bbox.join(',')}`);
            if (layer.srs !== undefined)
                meta.push(layer.srs);
            const stylesList = layer.styles?.map(style => style.name).join(',');
            if (stylesList !== undefined && stylesList.length > 0)
                meta.push(`styles: ${stylesList}`);
            lines.push(`- \`${layer.name ?? ''}\`${meta.length > 0 ? ` — ${meta.join(' · ')}` : ''}`);
        }
    }
    lines.push(`\nGlobal styles: ${styles.join(', ') || '(none)'}`);
    lines.push(`Formats: ${formats.join(', ')}`);
    return lines.join('\n');
}
/** Render the probe result as model-facing markdown. */
function renderProbe(value) {
    const lines = [];
    lines.push(`GeoServer probe at ${value.baseUrl ?? '(unknown)'}:`);
    lines.push(`- reachable: ${value.reachable ?? false}${value.httpStatus !== undefined && value.httpStatus > 0 ? ` (HTTP ${value.httpStatus})` : ''}`);
    lines.push(`- authentication required: ${value.authRequired ?? false}, configured: ${value.authConfigured ?? false}`);
    if (value.wmsTitle !== undefined)
        lines.push(`- WMS title: ${value.wmsTitle}`);
    if (value.error !== undefined)
        lines.push(`- error: ${value.error}`);
    if (value.imageTest !== undefined) {
        lines.push(`- image test: ${value.imageTest.ok ? 'ok' : 'failed'} (${value.imageTest.mime ?? 'unknown'}, ${value.imageTest.bytes ?? 0} bytes)`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=index.js.map