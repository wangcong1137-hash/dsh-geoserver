/**
 * Pure GeoServer REST / WMS helpers: URL construction and payload parsing
 * over HTTP responses. No I/O here — every function is a deterministic
 * function of its arguments, so the tool layer and tests share one code path.
 */
/** Common GeoServer image formats served by GetMap. */
export const WMS_IMAGE_FORMATS = [
    'image/png',
    'image/png8',
    'image/jpeg',
    'image/gif',
    'image/tiff',
    'image/vnd.jpeg-png',
];
/** An HTTP Basic authorization header value for the given credentials. */
export function basicAuthHeader(username, password) {
    const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
    return `Basic ${token}`;
}
/** Normalize a base URL: strip trailing slashes and a possible path prefix guard. */
export function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, '');
}
/**
 * Build a WMS 1.1.1 GetMap request URL for the given parameters.
 * @param baseUrl - GeoServer base URL, e.g. `http://host:8080/geoserver`.
 * @param params - GetMap parameters.
 * @returns the absolute GetMap URL.
 */
export function buildGetMapUrl(baseUrl, params) {
    const url = new URL(`${normalizeBaseUrl(baseUrl)}/wms`);
    url.searchParams.set('service', 'WMS');
    url.searchParams.set('version', params.version ?? '1.1.1');
    url.searchParams.set('request', 'GetMap');
    url.searchParams.set('layers', params.layers);
    url.searchParams.set('styles', params.styles ?? '');
    url.searchParams.set('srs', params.srs ?? 'EPSG:4326');
    url.searchParams.set('bbox', params.bbox.join(','));
    url.searchParams.set('width', String(params.width));
    url.searchParams.set('height', String(params.height));
    url.searchParams.set('format', params.format);
    url.searchParams.set('transparent', params.transparent === undefined ? 'FALSE' : params.transparent ? 'TRUE' : 'FALSE');
    return url.toString();
}
/**
 * Normalize a possibly-singular GeoServer REST collection into a list.
 * GeoServer returns an empty string for an empty collection and a bare
 * object for a one-element collection.
 * @param value - the collection field value.
 * @returns a plain array, empty for missing/empty collections.
 */
export function asList(value) {
    if (value === undefined || value === null || value === '')
        return [];
    return Array.isArray(value) ? value : [value];
}
/**
 * Parse one GeoServer REST list response (workspaces / layers / styles).
 * @param json - parsed JSON body.
 * @param kind - the collection kind, matching the JSON wrapper key.
 * @returns the entity names, in document order.
 */
export function parseRestList(json, kind) {
    const root = json;
    if (root === undefined)
        return [];
    const collection = root[kind === 'workspace' ? 'workspaces' : kind === 'layer' ? 'layers' : 'styles'];
    if (collection === undefined || typeof collection !== 'object' || collection === null)
        return [];
    const items = asList(collection[kind]);
    return items
        .map(item => (typeof item?.name === 'string' ? item.name : ''))
        .filter(name => name.length > 0);
}
/**
 * Parse one GeoServer REST layer-detail response.
 * @param json - parsed JSON body of `/rest/layers/{layer}.json`.
 * @returns title, declared SRS, and the latLon bounding box when present.
 */
export function parseRestLayerDetail(json) {
    const root = json;
    const layer = root?.['layer'];
    if (layer === undefined || typeof layer !== 'object' || layer === null)
        return {};
    const record = layer;
    const title = typeof record['title'] === 'string' ? record['title'] : undefined;
    const srs = typeof record['srs'] === 'string' ? record['srs'] : undefined;
    const bbox = parseBoundingBox(record['latLonBoundingBox'] ?? record['nativeBoundingBox']);
    // GeoServer wraps style references as `styles: { style: [...] }`.
    const stylesField = record['styles'];
    const styleList = stylesField !== null && typeof stylesField === 'object' && !Array.isArray(stylesField)
        ? stylesField['style']
        : stylesField;
    const styles = asList(styleList)
        .map(style => (typeof style?.name === 'string' ? style.name : ''))
        .filter(name => name.length > 0);
    return {
        ...(title !== undefined ? { title } : {}),
        ...(srs !== undefined ? { srs } : {}),
        ...(bbox !== undefined ? { bbox } : {}),
        ...(styles.length > 0 ? { styles: styles.map(name => ({ name })) } : {}),
    };
}
function parseBoundingBox(value) {
    if (value === undefined || typeof value !== 'object' || value === null)
        return undefined;
    const box = value;
    const minx = Number(box['minx']);
    const miny = Number(box['miny']);
    const maxx = Number(box['maxx']);
    const maxy = Number(box['maxy']);
    if (![minx, miny, maxx, maxy].every(Number.isFinite))
        return undefined;
    return [minx, miny, maxx, maxy];
}
/**
 * Lightweight WMS GetCapabilities XML parser: extracts the service title and
 * every named Layer's name/title/styles without a full XML dependency. The
 * capability document nests an aggregate Layer tree; only layers that carry a
 * `<Name>` are real data layers.
 * @param xml - the GetCapabilities XML document.
 * @returns service title and the named layers in document order.
 */
export function parseCapabilitiesXml(xml) {
    const layers = [];
    const stack = [];
    let title;
    const events = [];
    const layerTag = /<\/?(?:Layer)\b[^>]*>/g;
    let match;
    while ((match = layerTag.exec(xml)) !== null) {
        events.push({
            kind: match[0].startsWith('</') ? 'close' : 'open',
            index: match.index,
        });
    }
    const textTag = /<(?:Name|Title)\b[^>]*>([\s\S]*?)<\/(?:Name|Title)>/g;
    while ((match = textTag.exec(xml)) !== null) {
        events.push({
            kind: 'text',
            tag: match[0].startsWith('<Name') ? 'Name' : 'Title',
            content: unescapeXml(match[1]).trim(),
            index: match.index,
        });
    }
    const styleTag = /<Style\b[^>]*>\s*<Name>([\s\S]*?)<\/Name>/g;
    while ((match = styleTag.exec(xml)) !== null) {
        events.push({ kind: 'style', name: unescapeXml(match[1]).trim(), index: match.index });
    }
    events.sort((a, b) => a.index - b.index);
    for (const event of events) {
        if (event.kind === 'open') {
            stack.push({ styles: [] });
            continue;
        }
        if (event.kind === 'close') {
            const ctx = stack.pop();
            if (ctx === undefined)
                continue;
            if (ctx.name !== undefined && ctx.name.length > 0) {
                layers.push({
                    name: ctx.name,
                    ...(ctx.title !== undefined && ctx.title.length > 0 ? { title: ctx.title } : {}),
                    ...(ctx.styles.length > 0 ? { styles: ctx.styles } : {}),
                });
            }
            continue;
        }
        if (event.kind === 'style') {
            const ctx = stack[stack.length - 1];
            if (ctx !== undefined)
                ctx.styles.push({ name: event.name });
            continue;
        }
        // text event
        const ctx = stack[stack.length - 1];
        if (event.tag === 'Name') {
            if (ctx !== undefined && ctx.name === undefined)
                ctx.name = event.content;
        }
        else if (event.tag === 'Title') {
            // The document title lives either in the `<Service>` block (stack empty)
            // or on the aggregate root `<Layer>` (stack depth 1); either is a valid
            // fallback for the other. Per-layer titles only apply below the root.
            if (stack.length <= 1) {
                if (title === undefined && event.content.length > 0)
                    title = event.content;
            }
            else if (ctx !== undefined && ctx.title === undefined) {
                ctx.title = event.content;
            }
        }
    }
    return { ...(title !== undefined ? { title } : {}), layers };
}
/** Decode the XML entities a capabilities document may contain. */
function unescapeXml(value) {
    return value
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&');
}
//# sourceMappingURL=geoserver.js.map