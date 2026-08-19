# dsh-geoserver

在 dsh web GUI 中读取 GeoServer WMS 服务并渲染地图图像。

- **4 个工具**：列出工作区/图层/样式、发布 GeoTIFF/SHP ZIP 数据、抓取地图图像、诊断连通性。
- **设置卡片**（设置 → 插件 → 插件配置）：配置连接信息、发布限制和业务回调，无需改文件。
- **凭据永不进入浏览器**：插件在宿主侧持有 Basic 认证、自行抓取图像，并通过 `ctx.webServer` 以 GUI 同源 URL 提供图片。

## 工具

| 工具 | 功能 |
|---|---|
| `geoserver_list` | 通过 GeoServer REST API 枚举工作区、图层（标题/边界/SRS/样式）与图片格式；REST 不可用时回退到 WMS GetCapabilities 文档。 |
| `geoserver_publish` | 上传一个本地 GeoTIFF，或一个包含单份 SHP 数据的 ZIP。GeoServer 验证图层后，可选通知已配置的业务系统 webhook。 |
| `geoserver_map` | 服务端抓取一张 WMS GetMap 图片，返回同源展示 URL（`/geoserver-image/<token>`）。agent 回复时直接渲染 markdown 图片。 |
| `geoserver_probe` | 连通性/认证诊断：可达性、认证状态、WMS 标题与一次小型渲染测试。 |

## 安装

将包安装进 Web profile；该命令会自动把 `dsh-geoserver` 追加到 profile 的 `dsh.profile.bundles` 列表：

```sh
dsh plugin --profile web add dsh-geoserver
```

安装本地 checkout 时，用目录路径替换包名。组合包的 `cordis.patch.yml` 会插入 `geoserver` 插件行：

```yaml
# profile cordis.yml 补丁层 —— 例如 ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: geoserver
      name: dsh-geoserver
```

重启 `dsh web` 后，即使还没有服务器地址，Harness 也能正常启动，首次安装的用户可以进入设置卡片完成配置。在保存 URL 前，GeoServer 工具会返回明确的配置错误。插件支持两种配置方式：

1. **设置界面** —— 设置 → 插件 → 插件配置 → GeoServer：填写服务器地址、凭据、发布目录/大小限制及可选业务回调后保存。发布目录每行一个。回调令牌项只保存环境变量名，不保存真正的令牌。改动立即生效，无需重启。
2. **环境变量凭据** —— 配置 `env`（见下表）从进程环境读取 `GEOSERVER_USER` / `GEOSERVER_PASS`。

## 配置项

| 键 | 默认值 | 含义 |
|---|---|---|
| `baseUrl` | `''` | GeoServer 基础地址，例如 `http://host:8080/geoserver`。空值允许首次启动；调用工具时会返回配置指引。 |
| `env` | `[]` | 读取凭据的环境变量名。第一个匹配 `/user/i` 的是用户名，第一个匹配 `/pass\|pwd\|token/i` 的是密码。直接配置的 `username`/`password` 优先。 |
| `username` / `password` | — | 直接配置的 Basic 认证凭据（`env` 的替代）。设置卡片把用户名写入设置区，把密码写入凭据域，不会写入 `settings.yaml`。 |
| `cacheTtlMs` | 600000 | 图片缓存 TTL（毫秒）。 |
| `cacheMaxEntries` | 50 | 缓存图片上限，超限淘汰最旧。 |
| `publicBaseUrl` | `http://127.0.0.1:<webServer.port>` | GUI 的外部可达地址（用于局域网访问）；展示 URL 前缀。 |
| `connectTimeoutMs` | 15000 | 单请求 HTTP 超时（毫秒）。 |
| `publishRoots` | `[]` | `geoserver_publish` 允许读取的本地目录。空列表会禁用发布。可在设置卡片中编辑。 |
| `defaultWorkspace` | `''` | `geoserver_publish` 未传 `workspace` 时使用的工作区；命令中的工作区优先。可在设置卡片中编辑。 |
| `publishMaxBytes` | 536870912 | TIF 或 ZIP 上传的最大字节数。可在设置卡片中编辑。 |
| `webhookUrl` | — | 发布成功后调用的可选业务系统接口。可在设置卡片中编辑。 |
| `webhookTokenEnv` | — | 可选的环境变量名，其值作为 webhook Bearer token。设置卡片只保存变量名。 |
| `webhookTimeoutMs` | 5000 | 业务 webhook 超时时间。可在设置卡片中编辑。 |

从 `$DSH_HOME/.env`（`GEOSERVER_USER`、`GEOSERVER_PASS`）读取凭据的示例：

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

`geoserver_publish` 使用 `kind: raster` 发布 `.tif`/`.tiff`，使用 `kind: vector` 发布包含一份同名 SHP 数据的 `.zip`。配置 `defaultWorkspace` 后，命令可以省略 `workspace`；命令显式指定的工作区优先。已有图层会直接报错，不会自动覆盖。可选的扁平 `metadata` 字段（如 `projectId`、`datasetId`）会同时出现在工具结果和 webhook 请求中。

GeoServer 发布与 webhook 通知分别返回状态。webhook 失败不会把已经创建的 GeoServer 图层改判为发布失败；第一版会报告通知错误，但不自动重试。

工具调用示例：

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

GeoServer 验证 `demo:dem` 后，webhook 会收到 `type: "geoserver.layer.published"`、`version: 1` 的事件，其中包含唯一 `eventId`、工作区/图层/存储名、WMS 和 WCS/WFS 地址、识别到的 SRS/边界，以及原样附带的 metadata。业务系统返回任意 HTTP 2xx 即视为通知成功。配置 `webhookTokenEnv` 后，请求会附带 `Authorization: Bearer <value>`；如果该环境变量不存在，插件会报告通知失败，而不是发送未认证请求。

### 本地测试回调服务

运行 `pnpm webhook:receiver`，测试服务会监听 `http://127.0.0.1:3900`。在设置卡片中把业务回调地址填为 `http://127.0.0.1:3900/geoserver/published`，回调令牌环境变量名先留空。收到的事件会打印到终端，也可通过 `GET http://127.0.0.1:3900/events` 查看；`GET /health` 用于检查服务是否正常。启动前设置 `GEOSERVER_WEBHOOK_TEST_TOKEN` 可要求 Bearer token。

## 开发

```sh
pnpm install      # 开发依赖：typescript、tsdown、lightningcss
pnpm build        # tsc（宿主侧）+ 类型检查（客户端）+ tsdown（客户端 bundle）
pnpm test         # node --test 针对 lib/
```

## 模型体验

- `geoserver_list` 消耗 2 次 REST 调用，另有每个图层 1 次（`skipDetails` 可跳过）；回退路径为 1 次 GetCapabilities 往返。
- `geoserver_map` 每次请求增加 1 次 GetMap 往返与一张内存小图；图片存于有界 TTL 缓存。
- `geoserver_publish` 会检查工作区和图层、上传一个文件，再验证发布结果。源文件必须位于 `publishRoots` 中，且不得超过 `publishMaxBytes`。
- 凭据在每次工具调用时从设置区（或组合配置）解析；设置卡片的密码通过凭据域写入，永不进入设置文档或任何响应。

## 已知限制与待办

- GetCapabilities 回退路径只解析图层名/标题/样式；CRS 与边界来自 REST 路径。
- 图片缓存在宿主内存；超大栅格请求受工具宽高上限（4096 像素）与 HTTP 超时约束。
- 暂未提供 WFS/WMTS 服务列表；REST 枚举覆盖 WMS 图层与样式。
- 设置卡片通过插件自有的 `/geoserver/config` 路由读写，任何宿主版本都能渲染，无需把 `geoserver` 设置命名空间加入 api-proxy 白名单。密码始终走凭据域，从不经响应回传。
