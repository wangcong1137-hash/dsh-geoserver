# dsh-geoserver

Read GeoServer WMS services and render map images inside the dsh web GUI.

- **3 tools** for the agent: list workspaces/layers/styles, fetch map images, and diagnose connectivity.
- **A settings card** in the GUI (Settings → Plugins → Plugin configuration) to configure the server URL, username, and password without editing files.
- **Credentials never reach the browser**: the plugin holds Basic auth on the host, fetches images itself, and serves them from the same origin as the GUI through `ctx.webServer`.

## Tools

| Tool | Purpose |
|---|---|
| `geoserver_list` | Enumerate workspaces, layers (title/bbox/SRS/styles) and image formats via the GeoServer REST API, falling back to the WMS GetCapabilities document. |
| `geoserver_map` | Fetch one WMS GetMap image server-side and return an in-origin display URL (`/geoserver-image/<token>`). The agent replies with the rendered markdown image. |
| `geoserver_probe` | Connectivity/authentication diagnostics: reachability, auth state, WMS title, and a small render test. |

## Installation

Install the package into a profile and append `dsh-geoserver` to that profile's `dsh.profile.bundles` list. `cordis.patch.yml` inserts the `geoserver` plugin row.

```yaml
# profile cordis.yml patch layer — e.g. ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: geoserver
      name: dsh-geoserver
```

Restart `dsh web`. The plugin is then usable in two ways:

1. **Settings UI** — Settings → Plugins → Plugin configuration → GeoServer: fill in the server URL, username, and password, then Save. Changes take effect immediately, without a restart.
2. **Environment credentials** — configure `env` (see below) to read `GEOSERVER_USER` / `GEOSERVER_PASS` from the process environment.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `baseUrl` | — (required) | GeoServer base URL, e.g. `http://host:8080/geoserver`. |
| `env` | `[]` | Environment-variable names for credentials. The first name matching `/user/i` is the username, the first matching `/pass\|pwd\|token/i` the password. Direct `username`/`password` fields take precedence. |
| `username` / `password` | — | Direct Basic-auth credentials (alternative to `env`). The settings card writes these. |
| `cacheTtlMs` | 600000 | Image cache TTL. |
| `cacheMaxEntries` | 50 | Max cached images before eviction. |
| `publicBaseUrl` | `http://127.0.0.1:<webServer.port>` | Externally reachable GUI URL for LAN access; the display URL prefix. |
| `connectTimeoutMs` | 15000 | Per-request HTTP timeout. |

Example with credentials from `$DSH_HOME/.env` (`GEOSERVER_USER`, `GEOSERVER_PASS`):

```yaml
- insert:
    - id: geoserver
      name: dsh-geoserver
      config:
        baseUrl: http://host:8080/geoserver
        env: [GEOSERVER_USER, GEOSERVER_PASS]
```

## Development

```sh
pnpm install      # dev dependencies: typescript, tsdown, lightningcss
pnpm build        # tsc (host) + type-check (client) + tsdown (client bundle)
pnpm test         # node --test against lib/
```

## Model Experience

- `geoserver_list` costs 2 REST calls plus one per layer (skippable with `skipDetails`), or one GetCapabilities round-trip on fallback.
- `geoserver_map` adds one GetMap round-trip and one small in-memory image per request; the image lives in the bounded TTL cache.
- Credentials resolve per tool call from the settings section (or the composition entry); the settings card's password is written through the credentials domain, never into the settings document or any response.

## Known Limitations and Deferred Work

- The GetCapabilities fallback parses layer names/titles/styles only; CRS and bounds come from the REST path.
- Images are cached in host memory; very large raster requests are bounded by the tool's width/height clamp (4096 px) and HTTP timeout.
- WFS/WMTS service listing is not yet exposed; the REST enumeration covers WMS layers and styles.
- The settings card reads and writes through the plugin's own `/geoserver/config` route, so it renders on any host without the `geoserver` settings namespace being allowlisted in the api-proxy. The password always travels through the credentials domain, never through a response.
