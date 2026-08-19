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
 * reads and writes its fields through this plugin's `/geoserver/config` route
 * (registered on `ctx.webServer` below); the route persists into the
 * `geoserver` settings namespace, so a saved change takes effect immediately
 * and needs no settings-RPC allowlist on any host.
 *
 * The `/geoserver-image/<token>` route is registered on `ctx.webServer` when
 * the web surface is composed; tokens are random UUIDs bound to a short TTL
 * cache, so the browser never sees GeoServer credentials.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { GetMapParams, WmsLayerInfo, WmsServiceInfo, WmsStyleInfo } from './geoserver.ts';
export declare const name = "geoserver";
export declare const inject: string[];
declare module '@deepseek-ai/cordis' {
    interface Context {
        webServer: WebServerLike;
    }
}
/** Credentials resolved from config fields or the configured environment variables. */
export interface ResolvedCredentials {
    /** Basic-auth username; absent means anonymous access. */
    readonly username?: string;
    /** Basic-auth password; absent means anonymous access. */
    readonly password?: string;
}
/** Plugin configuration. */
export interface Config {
    /** GeoServer base URL, e.g. `http://host:8080/geoserver`. */
    baseUrl: string;
    /** Optional direct Basic-auth username. */
    username?: string;
    /** Optional direct Basic-auth password. */
    password?: string;
    /**
     * Environment-variable names to read credentials from. The first name
     * matching `/user/i` supplies the username and the first matching
     * `/pass|pwd|token/i` the password; direct `username`/`password` fields
     * take precedence. Typical value: `['GEOSERVER_USER', 'GEOSERVER_PASS']`.
     */
    env?: string[];
    /** Image cache TTL in milliseconds; default 10 minutes. */
    cacheTtlMs?: number;
    /** Maximum cached images before the oldest entries are evicted; default 50. */
    cacheMaxEntries?: number;
    /**
     * Externally reachable base URL of this dsh web GUI, e.g. for LAN access.
     * Defaults to `http://127.0.0.1:<webServer.port>`.
     */
    publicBaseUrl?: string;
    /** Per-request HTTP timeout in milliseconds; default 15 seconds. */
    connectTimeoutMs?: number;
}
/** Schemastery configuration for the geoserver consumer. */
export declare const Config: z<Config>;
/** Settings namespace carrying the configured server, username, and password. */
export declare const GEOSERVER_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Merge direct config credentials with environment-provided ones. */
export declare function resolveCredentials(config: Config): ResolvedCredentials;
interface ImageCacheEntry {
    bytes: Buffer;
    mime: string;
    expires: number;
}
/** Bounded TTL cache keyed by random image token. */
declare class ImageCache {
    private readonly entries;
    private readonly ttlMs;
    private readonly maxEntries;
    constructor(ttlMs: number, maxEntries: number);
    /** Store an image and return its token. */
    put(bytes: Buffer, mime: string): string;
    /** Read an unexpired entry by token; expired entries are removed. */
    get(token: string): ImageCacheEntry | undefined;
    /** Drop expired entries. */
    prune(): void;
    /** Number of live entries (diagnostics). */
    get size(): number;
}
/** Minimal structural view of the `webServer` service; avoids a host-package dependency. */
interface WebServerLike {
    /** The listening port. */
    readonly port: number;
    /** The configured bind host. */
    readonly host: string;
    /**
     * Register a named route.
     * @param route - kind, path, and the owning handler.
     * @returns the disposer removing the route.
     */
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
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
export declare function listServices(baseUrl: string, credentials: ResolvedCredentials, signal: AbortSignal, timeoutMs: number, skipDetails: boolean): Promise<{
    services: WmsServiceInfo[];
    styles: string[];
    formats: string[];
}>;
/** Fallback enumeration over the standard WMS GetCapabilities document. */
export declare function listServicesFromCapabilities(baseUrl: string, credentials: ResolvedCredentials, signal: AbortSignal, timeoutMs: number): Promise<{
    services: WmsServiceInfo[];
    styles: string[];
    formats: string[];
}>;
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
export declare function fetchMapImage(baseUrl: string, params: GetMapParams, credentials: ResolvedCredentials, signal: AbortSignal, timeoutMs: number, cache: ImageCache, imageBase: string): Promise<{
    url: string;
    layer: string;
    bbox: string;
    width: number;
    height: number;
    format: string;
    srs: string;
    mime: string;
}>;
/**
 * Register the three geoserver tools plus the image route.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - plugin configuration.
 */
export declare function apply(ctx: Context, config: Config): void;
/** Run the connectivity/authentication/image diagnostics. */
export declare function probeServer(baseUrl: string, credentials: ResolvedCredentials, signal: AbortSignal, timeoutMs: number, testLayer?: string): Promise<{
    baseUrl: string;
    reachable: boolean;
    httpStatus: number;
    authRequired: boolean;
    authConfigured: boolean;
    wmsTitle?: string;
    error?: string;
    imageTest?: {
        ok: boolean;
        mime: string;
        bytes: number;
    };
}>;
export type { ImageCacheEntry };
export type { WmsLayerInfo, WmsServiceInfo, WmsStyleInfo };
//# sourceMappingURL=index.d.ts.map