# dsh-geoserver

在 dsh web GUI 中读取 GeoServer WMS 服务并渲染地图图像。

- **3 个工具**：列出工作区/图层/样式、抓取地图图像、诊断连通性。
- **设置卡片**（设置 → 插件 → 插件配置）：配置服务器地址、用户名、密码，无需改文件。
- **凭据永不进入浏览器**：插件在宿主侧持有 Basic 认证、自行抓取图像，并通过 `ctx.webServer` 以 GUI 同源 URL 提供图片。

## 工具

| 工具 | 功能 |
|---|---|
| `geoserver_list` | 通过 GeoServer REST API 枚举工作区、图层（标题/边界/SRS/样式）与图片格式；REST 不可用时回退到 WMS GetCapabilities 文档。 |
| `geoserver_map` | 服务端抓取一张 WMS GetMap 图片，返回同源展示 URL（`/geoserver-image/<token>`）。agent 回复时直接渲染 markdown 图片。 |
| `geoserver_probe` | 连通性/认证诊断：可达性、认证状态、WMS 标题与一次小型渲染测试。 |

## 安装

将包安装进 profile，并把 `dsh-geoserver` 追加到该 profile 的 `dsh.profile.bundles` 列表。`cordis.patch.yml` 会插入 `geoserver` 插件行。

```yaml
# profile cordis.yml 补丁层 —— 例如 ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: geoserver
      name: dsh-geoserver
```

重启 `dsh web` 后可用两种方式配置：

1. **设置界面** —— 设置 → 插件 → 插件配置 → GeoServer：填写服务器地址、用户名、密码后保存。改动立即生效，无需重启。
2. **环境变量凭据** —— 配置 `env`（见下表）从进程环境读取 `GEOSERVER_USER` / `GEOSERVER_PASS`。

## 配置项

| 键 | 默认值 | 含义 |
|---|---|---|
| `baseUrl` | —（必填） | GeoServer 基础地址，例如 `http://host:8080/geoserver`。 |
| `env` | `[]` | 读取凭据的环境变量名。第一个匹配 `/user/i` 的是用户名，第一个匹配 `/pass\|pwd\|token/i` 的是密码。直接配置的 `username`/`password` 优先。 |
| `username` / `password` | — | 直接配置的 Basic 认证凭据（`env` 的替代）。设置卡片写入的就是这两个。 |
| `cacheTtlMs` | 600000 | 图片缓存 TTL（毫秒）。 |
| `cacheMaxEntries` | 50 | 缓存图片上限，超限淘汰最旧。 |
| `publicBaseUrl` | `http://127.0.0.1:<webServer.port>` | GUI 的外部可达地址（用于局域网访问）；展示 URL 前缀。 |
| `connectTimeoutMs` | 15000 | 单请求 HTTP 超时（毫秒）。 |

从 `$DSH_HOME/.env`（`GEOSERVER_USER`、`GEOSERVER_PASS`）读取凭据的示例：

```yaml
- insert:
    - id: geoserver
      name: dsh-geoserver
      config:
        baseUrl: http://host:8080/geoserver
        env: [GEOSERVER_USER, GEOSERVER_PASS]
```

## 开发

```sh
pnpm install      # 开发依赖：typescript、tsdown、lightningcss
pnpm build        # tsc（宿主侧）+ 类型检查（客户端）+ tsdown（客户端 bundle）
pnpm test         # node --test 针对 lib/
```

## 模型体验

- `geoserver_list` 消耗 2 次 REST 调用，另有每个图层 1 次（`skipDetails` 可跳过）；回退路径为 1 次 GetCapabilities 往返。
- `geoserver_map` 每次请求增加 1 次 GetMap 往返与一张内存小图；图片存于有界 TTL 缓存。
- 凭据在每次工具调用时从设置区（或组合配置）解析；设置卡片的密码通过凭据域写入，永不进入设置文档或任何响应。

## 已知限制与待办

- GetCapabilities 回退路径只解析图层名/标题/样式；CRS 与边界来自 REST 路径。
- 图片缓存在宿主内存；超大栅格请求受工具宽高上限（4096 像素）与 HTTP 超时约束。
- 暂未提供 WFS/WMTS 服务列表；REST 枚举覆盖 WMS 图层与样式。
- 设置卡片通过插件自有的 `/geoserver/config` 路由读写，任何宿主版本都能渲染，无需把 `geoserver` 设置命名空间加入 api-proxy 白名单。密码始终走凭据域，从不经响应回传。
