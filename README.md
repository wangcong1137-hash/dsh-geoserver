# dsh-geoserver

Read GeoServer WMS services and render map images inside the dsh web GUI.

- **4 tools** for the agent: list workspaces/layers/styles, publish GeoTIFF/SHP ZIP data, fetch map images, and diagnose connectivity.
- **A settings card** in the GUI (Settings → Plugins → Plugin configuration) to configure the connection, publication limits, and business webhook without editing files.
- **Credentials never reach the browser**: the plugin holds Basic auth on the host, fetches images itself, and serves them from the same origin as the GUI through `ctx.webServer`.

## Tools

| Tool | Purpose |
|---|---|
| `geoserver_list` | Enumerate workspaces, layers (title/bbox/SRS/styles) and image formats via the GeoServer REST API, falling back to the WMS GetCapabilities document. |
| `geoserver_publish` | Upload one local GeoTIFF or one ZIP containing a single SHP dataset. Optionally notify a configured business-system webhook after GeoServer verifies the layer. |
| `geoserver_map` | Fetch one WMS GetMap image server-side and return an in-origin display URL (`/geoserver-image/<token>`). The agent replies with the rendered markdown image. |
| `geoserver_probe` | Connectivity/authentication diagnostics: reachability, auth state, WMS title, and a small render test. |

## Installation

Install the package into the Web profile; the command appends `dsh-geoserver` to that profile's `dsh.profile.bundles` list automatically:

```sh
dsh plugin --profile web add dsh-geoserver
```

For a local checkout, pass its path instead of the package name. The bundle's `cordis.patch.yml` inserts the `geoserver` plugin row:

```yaml
# profile cordis.yml patch layer — e.g. ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: geoserver
      name: dsh-geoserver
```

Restart `dsh web`. A missing server URL does not prevent Harness from starting, so a first-time user can open the settings card. GeoServer tools report a configuration error until a URL is saved. The plugin is configurable in two ways:

1. **Settings UI** — Settings → Plugins → Plugin configuration → GeoServer: configure the server URL, credentials, publication directories/size limit, and optional webhook, then Save. Changes take effect immediately, without a restart. Publication directories are entered one per line. The webhook token field stores only an environment-variable name, never the token itself.
2. **Environment credentials** — configure `env` (see below) to read `GEOSERVER_USER` / `GEOSERVER_PASS` from the process environment.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `baseUrl` | `''` | GeoServer base URL, e.g. `http://host:8080/geoserver`. An empty value permits first boot; tool calls reject it with setup instructions. |
| `env` | `[]` | Environment-variable names for credentials. The first name matching `/user/i` is the username, the first matching `/pass\|pwd\|token/i` the password. Direct `username`/`password` fields take precedence. |
| `username` / `password` | — | Direct Basic-auth credentials (alternative to `env`). The settings card stores the username in settings and the password in the credentials domain, not in `settings.yaml`. |
| `cacheTtlMs` | 600000 | Image cache TTL. |
| `cacheMaxEntries` | 50 | Max cached images before eviction. |
| `publicBaseUrl` | `http://127.0.0.1:<webServer.port>` | Externally reachable GUI URL for LAN access; the display URL prefix. |
| `connectTimeoutMs` | 15000 | Per-request HTTP timeout. |
| `publishRoots` | `[]` | Local directories from which `geoserver_publish` may read files. An empty list disables publication. Editable in the settings card. |
| `defaultWorkspace` | `''` | Workspace used when `geoserver_publish` omits `workspace`. A request-level workspace overrides it. Editable in the settings card. |
| `publishMaxBytes` | 536870912 | Maximum TIF or ZIP upload size in bytes. Editable in the settings card. |
| `webhookUrl` | — | Optional business-system endpoint called after publication succeeds. Editable in the settings card. |
| `webhookTokenEnv` | — | Optional environment variable containing the webhook Bearer token. The settings card stores the variable name only. |
| `webhookTimeoutMs` | 5000 | Business webhook timeout. Editable in the settings card. |

Example with credentials from `$DSH_HOME/.env` (`GEOSERVER_USER`, `GEOSERVER_PASS`):

```yaml
- insert:
    - id: geoserver
      name: dsh-geoserver
      config:
        baseUrl: http://host:8080/geoserver
        env: [GEOSERVER_USER, GEOSERVER_PASS]
        publishRoots: [D:/data]
        defaultWorkspace: demo
        webhookUrl: https://business.example.com/api/geoserver/published
        webhookTokenEnv: GEOSERVER_WEBHOOK_TOKEN
```

`geoserver_publish` accepts `kind: raster` for `.tif`/`.tiff` and `kind: vector` for a `.zip` containing one same-named SHP dataset. `workspace` is optional when `defaultWorkspace` is configured; an explicit request value overrides the default. Existing layers are rejected rather than replaced. Optional flat `metadata` fields such as `projectId` and `datasetId` are returned by the tool and forwarded to the webhook.

GeoServer publication and webhook delivery have separate statuses. A failed webhook does not turn an already-created GeoServer layer into a failed publication; this first version reports the delivery failure and does not retry automatically.

Example tool arguments:

```json
{
  "kind": "raster",
  "sourcePath": "D:/data/dem.tif",
  "workspace": "demo",
  "metadata": {
    "projectId": "project-123",
    "datasetId": "dataset-456"
  }
}
```

After GeoServer verifies `demo:dem`, the webhook receives an event with `type: "geoserver.layer.published"` and `version: 1`, containing a unique `eventId`, the workspace/layer/store, WMS and WCS/WFS URLs, discovered SRS/bounds, and the same metadata. Any HTTP 2xx response counts as delivered. When `webhookTokenEnv` is configured, the request carries `Authorization: Bearer <value>`; a missing environment value reports a failed notification without sending an unauthenticated request.

### Local webhook receiver

Run `pnpm webhook:receiver` to start the bundled test receiver at `http://127.0.0.1:3900`. Set the settings-card webhook URL to `http://127.0.0.1:3900/geoserver/published` and leave the token environment-variable field blank. Received events are printed to the terminal and available from `GET http://127.0.0.1:3900/events`; `GET /health` reports readiness. Set `GEOSERVER_WEBHOOK_TEST_TOKEN` before starting the receiver to require a Bearer token.

## Development

```sh
pnpm install      # dev dependencies: typescript, tsdown, lightningcss
pnpm build        # tsc (host) + type-check (client) + tsdown (client bundle)
pnpm test         # node --test against lib/
```

## Model Experience

- `geoserver_list` costs 2 REST calls plus one per layer (skippable with `skipDetails`), or one GetCapabilities round-trip on fallback.
- `geoserver_map` adds one GetMap round-trip and one small in-memory image per request; the image lives in the bounded TTL cache.
- `geoserver_publish` performs workspace/layer checks, one file upload, and one verification request. The source must resolve inside `publishRoots` and fit `publishMaxBytes`.
- Credentials resolve per tool call from the settings section (or the composition entry); the settings card's password is written through the credentials domain, never into the settings document or any response.

## Known Limitations and Deferred Work

- The GetCapabilities fallback parses layer names/titles/styles only; CRS and bounds come from the REST path.
- Images are cached in host memory; very large raster requests are bounded by the tool's width/height clamp (4096 px) and HTTP timeout.
- WFS/WMTS service listing is not yet exposed; the REST enumeration covers WMS layers and styles.
- The settings card reads and writes through the plugin's own `/geoserver/config` route, so it renders on any host without the `geoserver` settings namespace being allowlisted in the api-proxy. The password always travels through the credentials domain, never through a response.
