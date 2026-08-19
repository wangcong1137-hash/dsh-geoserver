/**
 * Pure GeoServer REST / WMS helpers: URL construction and payload parsing
 * over HTTP responses. No I/O here — every function is a deterministic
 * function of its arguments, so the tool layer and tests share one code path.
 */
export interface WmsStyleInfo {
    /** Style name as accepted by GetMap `styles`. */
    readonly name: string;
    /** Optional human-readable style title. */
    readonly title?: string;
}
export interface WmsLayerInfo {
    /** Layer name, usually `workspace:layer`. */
    readonly name: string;
    /** Optional human-readable layer title. */
    readonly title?: string;
    /** Optional declared SRS, e.g. `EPSG:4326`. */
    readonly srs?: string;
    /** Optional geographic bounds [minx, miny, maxx, maxy]. */
    readonly bbox?: readonly [number, number, number, number];
    /** Optional styles available for this layer. */
    readonly styles?: readonly WmsStyleInfo[];
}
export interface WmsServiceInfo {
    /** Workspace or service name. */
    readonly name: string;
    /** Optional service title. */
    readonly title?: string;
    /** Service kind; always `wms` for now. */
    readonly type: 'wms';
    /** Layers advertised by the service. */
    readonly layers: readonly WmsLayerInfo[];
}
export interface CapabilitiesResult {
    /** Optional service title from the capabilities document. */
    readonly title?: string;
    /** Layers advertised by the document. */
    readonly layers: readonly WmsLayerInfo[];
}
/** Request parameters for one WMS GetMap call. */
export interface GetMapParams {
    readonly layers: string;
    readonly bbox: readonly [number, number, number, number];
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly srs?: string;
    readonly styles?: string;
    readonly transparent?: boolean;
    readonly version?: '1.1.1' | '1.3.0';
}
/** Common GeoServer image formats served by GetMap. */
export declare const WMS_IMAGE_FORMATS: readonly ["image/png", "image/png8", "image/jpeg", "image/gif", "image/tiff", "image/vnd.jpeg-png"];
/** An HTTP Basic authorization header value for the given credentials. */
export declare function basicAuthHeader(username: string, password: string): string;
/** Normalize a base URL: strip trailing slashes and a possible path prefix guard. */
export declare function normalizeBaseUrl(baseUrl: string): string;
/**
 * Build a WMS 1.1.1 GetMap request URL for the given parameters.
 * @param baseUrl - GeoServer base URL, e.g. `http://host:8080/geoserver`.
 * @param params - GetMap parameters.
 * @returns the absolute GetMap URL.
 */
export declare function buildGetMapUrl(baseUrl: string, params: GetMapParams): string;
/**
 * Normalize a possibly-singular GeoServer REST collection into a list.
 * GeoServer returns an empty string for an empty collection and a bare
 * object for a one-element collection.
 * @param value - the collection field value.
 * @returns a plain array, empty for missing/empty collections.
 */
export declare function asList<T>(value: unknown): T[];
/**
 * Parse one GeoServer REST list response (workspaces / layers / styles).
 * @param json - parsed JSON body.
 * @param kind - the collection kind, matching the JSON wrapper key.
 * @returns the entity names, in document order.
 */
export declare function parseRestList(json: unknown, kind: 'workspace' | 'layer' | 'style'): string[];
/**
 * Parse one GeoServer REST layer-detail response.
 * @param json - parsed JSON body of `/rest/layers/{layer}.json`.
 * @returns title, declared SRS, and the latLon bounding box when present.
 */
export declare function parseRestLayerDetail(json: unknown): {
    title?: string;
    srs?: string;
    bbox?: readonly [number, number, number, number];
};
/**
 * Lightweight WMS GetCapabilities XML parser: extracts the service title and
 * every named Layer's name/title/styles without a full XML dependency. The
 * capability document nests an aggregate Layer tree; only layers that carry a
 * `<Name>` are real data layers.
 * @param xml - the GetCapabilities XML document.
 * @returns service title and the named layers in document order.
 */
export declare function parseCapabilitiesXml(xml: string): CapabilitiesResult;
//# sourceMappingURL=geoserver.d.ts.map