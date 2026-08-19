/** GeoServer file publication and post-publication webhook delivery. */
/** Credentials used for GeoServer REST requests. */
export interface PublicationCredentials {
    readonly username?: string;
    readonly password?: string;
}
/** Flat caller-owned fields forwarded to a business webhook. */
export type PublicationMetadata = Record<string, string | number | boolean>;
/** Input for one TIF or SHP ZIP publication. */
export interface PublishLayerInput {
    readonly kind: 'raster' | 'vector';
    readonly sourcePath: string;
    readonly workspace: string;
    readonly layerName?: string;
    readonly storeName?: string;
    readonly metadata?: Record<string, unknown>;
}
/** Configuration that controls local file access and upload size. */
export interface PublicationPolicy {
    readonly allowedRoots: readonly string[];
    readonly maxBytes: number;
}
/** A successfully published GeoServer layer. */
export interface PublishedLayer {
    readonly workspace: string;
    readonly layer: string;
    readonly qualifiedName: string;
    readonly kind: 'raster' | 'vector';
    readonly store: string;
    readonly sourceName: string;
    readonly createdWorkspace: boolean;
    readonly srs?: string;
    readonly bbox?: readonly [number, number, number, number];
    readonly serviceUrls: {
        readonly wms: string;
        readonly wfs?: string;
        readonly wcs?: string;
    };
}
/** Stable event sent to an external business application. */
export interface PublicationEvent {
    readonly type: 'geoserver.layer.published';
    readonly version: 1;
    readonly eventId: string;
    readonly occurredAt: string;
    readonly publication: PublishedLayer;
    readonly metadata: PublicationMetadata;
}
/** Result of the optional business webhook call. */
export interface WebhookDelivery {
    readonly status: 'not_configured' | 'delivered' | 'failed';
    readonly httpStatus?: number;
    readonly error?: string;
}
/**
 * Validate and detach business metadata before it crosses the webhook boundary.
 * @param value - model-supplied metadata.
 * @returns a flat scalar-only record.
 */
export declare function resolvePublicationMetadata(value: Record<string, unknown> | undefined): PublicationMetadata;
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
export declare function publishLayerFile(baseUrl: string, credentials: PublicationCredentials, input: PublishLayerInput, policy: PublicationPolicy, signal: AbortSignal, timeoutMs: number): Promise<{
    publication: PublishedLayer;
    metadata: PublicationMetadata;
}>;
/**
 * Create a stable webhook payload after GeoServer publication succeeds.
 * @param publication - verified GeoServer result.
 * @param metadata - detached business metadata.
 * @returns the event payload.
 */
export declare function createPublicationEvent(publication: PublishedLayer, metadata: PublicationMetadata): PublicationEvent;
/**
 * Notify an optional business-system webhook without changing publication success.
 * @param url - administrator-configured webhook URL.
 * @param token - optional bearer token.
 * @param event - canonical publication event.
 * @param signal - caller cancellation.
 * @param timeoutMs - webhook timeout.
 * @returns delivery status; failures are represented, not thrown.
 */
export declare function deliverPublicationWebhook(url: string | undefined, token: string | undefined, event: PublicationEvent, signal: AbortSignal, timeoutMs: number): Promise<WebhookDelivery>;
//# sourceMappingURL=publishing.d.ts.map