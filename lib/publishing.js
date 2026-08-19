/** GeoServer file publication and post-publication webhook delivery. */
import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { basicAuthHeader, normalizeBaseUrl, parseRestLayerDetail } from './geoserver.js';
const NAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u;
const MAX_METADATA_FIELDS = 32;
const MAX_METADATA_BYTES = 8192;
/**
 * Validate and detach business metadata before it crosses the webhook boundary.
 * @param value - model-supplied metadata.
 * @returns a flat scalar-only record.
 */
export function resolvePublicationMetadata(value) {
    if (value === undefined)
        return {};
    const entries = Object.entries(value);
    if (entries.length > MAX_METADATA_FIELDS) {
        throw new Error(`metadata accepts at most ${MAX_METADATA_FIELDS} fields`);
    }
    const result = {};
    for (const [key, item] of entries) {
        if (key.trim() === '')
            throw new Error('metadata keys must be non-empty strings');
        if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') {
            throw new Error(`metadata.${key} must be a string, number, or boolean`);
        }
        if (typeof item === 'number' && !Number.isFinite(item)) {
            throw new Error(`metadata.${key} must be a finite number`);
        }
        result[key] = item;
    }
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_METADATA_BYTES) {
        throw new Error(`metadata must be at most ${MAX_METADATA_BYTES} UTF-8 bytes`);
    }
    return result;
}
/**
 * Publish one local TIF or SHP ZIP through GeoServer's REST upload endpoints.
 * @param baseUrl - GeoServer base URL without `/rest`.
 * @param credentials - Basic-auth credentials.
 * @param input - publication request.
 * @param policy - allowed local roots and maximum file size.
 * @param signal - caller cancellation.
 * @param timeoutMs - per-request timeout.
 * @returns the verified published layer.
 */
export async function publishLayerFile(baseUrl, credentials, input, policy, signal, timeoutMs) {
    const workspace = validateName(input.workspace, 'workspace');
    const source = await readPublicationSource(input.sourcePath, input.kind, policy, signal);
    const layer = validateName(input.layerName ?? source.defaultName, 'layerName');
    const store = validateName(input.storeName ?? layer, 'storeName');
    const metadata = resolvePublicationMetadata(input.metadata);
    const base = normalizeBaseUrl(baseUrl);
    const workspaceUrl = `${base}/rest/workspaces/${encodeURIComponent(workspace)}.json`;
    const workspaceResponse = await request(workspaceUrl, credentials, signal, timeoutMs);
    let createdWorkspace = false;
    if (workspaceResponse.status === 404) {
        const created = await request(`${base}/rest/workspaces`, credentials, signal, timeoutMs, {
            method: 'POST',
            contentType: 'application/json',
            body: Buffer.from(JSON.stringify({ workspace: { name: workspace } }), 'utf8'),
        });
        expectSuccess(created, `create workspace ${workspace}`);
        createdWorkspace = true;
    }
    else {
        expectSuccess(workspaceResponse, `inspect workspace ${workspace}`);
    }
    const qualifiedName = `${workspace}:${layer}`;
    const existing = await request(`${base}/rest/layers/${encodeURIComponent(qualifiedName)}.json`, credentials, signal, timeoutMs);
    if (existing.status >= 200 && existing.status < 300) {
        throw new Error(`GeoServer layer ${qualifiedName} already exists; automatic replacement is disabled`);
    }
    if (existing.status !== 404)
        expectSuccess(existing, `inspect layer ${qualifiedName}`);
    const storeKind = input.kind === 'raster' ? 'coveragestores' : 'datastores';
    const existingStore = await request(`${base}/rest/workspaces/${encodeURIComponent(workspace)}/${storeKind}/${encodeURIComponent(store)}.json`, credentials, signal, timeoutMs);
    if (existingStore.status >= 200 && existingStore.status < 300) {
        throw new Error(`GeoServer store ${workspace}/${store} already exists; automatic replacement is disabled`);
    }
    if (existingStore.status !== 404)
        expectSuccess(existingStore, `inspect store ${workspace}/${store}`);
    const uploadUrl = input.kind === 'raster'
        ? `${base}/rest/workspaces/${encodeURIComponent(workspace)}/coveragestores/${encodeURIComponent(store)}`
            + `/file.geotiff?configure=all&coverageName=${encodeURIComponent(layer)}`
        : `${base}/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(store)}`
            + '/file.shp?configure=all';
    const uploaded = await request(uploadUrl, credentials, signal, timeoutMs, {
        method: 'PUT',
        contentType: input.kind === 'raster' ? 'image/tiff' : 'application/zip',
        body: source.bytes,
    });
    expectSuccess(uploaded, `publish ${input.kind} layer ${qualifiedName}`);
    const detailResponse = await request(`${base}/rest/layers/${encodeURIComponent(qualifiedName)}.json`, credentials, signal, timeoutMs);
    const detail = parseRestLayerDetail(expectJson(detailResponse, `verify layer ${qualifiedName}`));
    const workspacePath = encodeURIComponent(workspace);
    const encodedLayer = encodeURIComponent(qualifiedName);
    const publication = {
        workspace,
        layer,
        qualifiedName,
        kind: input.kind,
        store,
        sourceName: source.name,
        createdWorkspace,
        ...(detail.srs !== undefined ? { srs: detail.srs } : {}),
        ...(detail.bbox !== undefined ? { bbox: detail.bbox } : {}),
        serviceUrls: {
            wms: `${base}/${workspacePath}/wms?service=WMS&request=GetMap&layers=${encodedLayer}`,
            ...(input.kind === 'vector'
                ? { wfs: `${base}/${workspacePath}/wfs?service=WFS&request=GetFeature&typeName=${encodedLayer}` }
                : { wcs: `${base}/${workspacePath}/wcs?service=WCS&request=GetCoverage&coverageId=${encodedLayer}` }),
        },
    };
    return { publication, metadata };
}
/**
 * Create a stable webhook payload after GeoServer publication succeeds.
 * @param publication - verified GeoServer result.
 * @param metadata - detached business metadata.
 * @returns the event payload.
 */
export function createPublicationEvent(publication, metadata) {
    return {
        type: 'geoserver.layer.published',
        version: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        publication,
        metadata,
    };
}
/**
 * Notify an optional business-system webhook without changing publication success.
 * @param url - administrator-configured webhook URL.
 * @param token - optional bearer token.
 * @param event - canonical publication event.
 * @param signal - caller cancellation.
 * @param timeoutMs - webhook timeout.
 * @returns delivery status; failures are represented, not thrown.
 */
export async function deliverPublicationWebhook(url, token, event, signal, timeoutMs) {
    if (url === undefined || url.trim() === '')
        return { status: 'not_configured' };
    try {
        const endpoint = new URL(url);
        if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
            throw new Error('webhook URL must use HTTP or HTTPS');
        }
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-dsh-event-id': event.eventId,
                'x-dsh-event-type': event.type,
                ...(token === undefined || token === '' ? {} : { authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify(event),
            signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        });
        if (response.status >= 200 && response.status < 300) {
            await response.arrayBuffer();
            return { status: 'delivered', httpStatus: response.status };
        }
        const body = await response.text();
        return {
            status: 'failed',
            httpStatus: response.status,
            error: `webhook returned HTTP ${response.status}: ${body.slice(0, 300)}`,
        };
    }
    catch (error) {
        return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
}
async function readPublicationSource(sourcePath, kind, policy, signal) {
    if (policy.allowedRoots.length === 0) {
        throw new Error('GeoServer publication is disabled until config.publishRoots contains at least one allowed directory');
    }
    if (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes <= 0) {
        throw new Error('config.publishMaxBytes must be a positive safe integer');
    }
    const actualPath = await realpath(resolve(sourcePath));
    const roots = await Promise.all(policy.allowedRoots.map(async (root) => realpath(resolve(root))));
    if (!roots.some(root => isWithin(root, actualPath))) {
        throw new Error(`sourcePath is outside config.publishRoots: ${actualPath}`);
    }
    const info = await stat(actualPath);
    if (!info.isFile())
        throw new Error(`sourcePath is not a regular file: ${actualPath}`);
    if (info.size <= 0)
        throw new Error(`source file is empty: ${actualPath}`);
    if (info.size > policy.maxBytes) {
        throw new Error(`source file is ${info.size} bytes, exceeding config.publishMaxBytes (${policy.maxBytes})`);
    }
    const extension = extname(actualPath).toLowerCase();
    if (kind === 'raster' && extension !== '.tif' && extension !== '.tiff') {
        throw new Error('raster publication requires a .tif or .tiff source file');
    }
    if (kind === 'vector' && extension !== '.zip') {
        throw new Error('vector publication requires a .zip containing one SHP dataset');
    }
    const name = basename(actualPath);
    const defaultName = name.slice(0, -extension.length);
    return { bytes: await readFile(actualPath, { signal }), name, defaultName };
}
function isWithin(root, candidate) {
    const child = relative(root, candidate);
    return child === '' || (!child.startsWith('..') && !isAbsolute(child));
}
function validateName(value, field) {
    const name = value.trim();
    if (name === '' || !NAME_PATTERN.test(name)) {
        throw new Error(`${field} must contain only letters, numbers, underscore, dot, or hyphen`);
    }
    return name;
}
async function request(url, credentials, signal, timeoutMs, init) {
    const response = await fetch(url, {
        method: init?.method ?? 'GET',
        headers: {
            accept: 'application/json, text/plain, */*;q=0.5',
            ...(init === undefined ? {} : { 'content-type': init.contentType }),
            ...(credentials.username !== undefined && credentials.password !== undefined
                ? { authorization: basicAuthHeader(credentials.username, credentials.password) }
                : {}),
        },
        ...(init === undefined ? {} : { body: new Uint8Array(init.body) }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    return {
        status: response.status,
        body: await response.text(),
        contentType: response.headers.get('content-type') ?? '',
    };
}
function expectSuccess(response, operation) {
    if (response.status >= 200 && response.status < 300)
        return response.body;
    throw new Error(`${operation} failed with HTTP ${response.status}: ${response.body.slice(0, 300)}`);
}
function expectJson(response, operation) {
    const body = expectSuccess(response, operation);
    if (!/json/i.test(response.contentType)) {
        throw new Error(`${operation} did not return JSON (content-type ${response.contentType || 'none'})`);
    }
    try {
        return JSON.parse(body);
    }
    catch {
        throw new Error(`${operation} returned unparsable JSON`);
    }
}
//# sourceMappingURL=publishing.js.map