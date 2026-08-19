/** Locale bundles for the GeoServer configuration card. */

/** Locale keys these surfaces render. */
export type PluginsSettingsLocaleKey =
  | 'overridden' | 'reset' | 'readOnly' | 'expand' | 'collapse'
  | 'save' | 'saving' | 'discard' | 'unsaved' | 'saveFailed' | 'invalidNumber' | 'invalidPositiveInteger'
  | 'geoserverTitle' | 'geoserverDescription'
  | 'geoserverBaseUrl' | 'geoserverBaseUrlHint'
  | 'geoserverUsername' | 'geoserverUsernameHint'
  | 'geoserverPassword' | 'geoserverPasswordHint'
  | 'geoserverPasswordSet' | 'geoserverPasswordUnset'
  | 'geoserverPublishRoots' | 'geoserverPublishRootsHint'
  | 'geoserverDefaultWorkspace' | 'geoserverDefaultWorkspaceHint'
  | 'geoserverPublishMaxBytes' | 'geoserverPublishMaxBytesHint'
  | 'geoserverWebhookUrl' | 'geoserverWebhookUrlHint'
  | 'geoserverWebhookTokenEnv' | 'geoserverWebhookTokenEnvHint'
  | 'geoserverWebhookTimeoutMs' | 'geoserverWebhookTimeoutMsHint'

/** English copy. */
export const en: Record<PluginsSettingsLocaleKey, string> = {
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  save: 'Save',
  saving: 'Saving…',
  discard: 'Discard',
  unsaved: 'Unsaved',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
  invalidPositiveInteger: 'Enter a positive whole number, or leave blank to use the default.',
  geoserverTitle: 'GeoServer',
  geoserverDescription: 'Connection, publication, and business notification settings for the geoserver tools.',
  geoserverBaseUrl: 'Server URL',
  geoserverBaseUrlHint: 'GeoServer base URL, e.g. http://host:8080/geoserver.',
  geoserverUsername: 'Username',
  geoserverUsernameHint: 'Basic-auth user; leave blank for anonymous access.',
  geoserverPassword: 'Password',
  geoserverPasswordHint: 'Stored outside the settings file. Leave blank to keep the current password.',
  geoserverPasswordSet: 'A password is configured.',
  geoserverPasswordUnset: 'No password is configured; anonymous access only.',
  geoserverPublishRoots: 'Publication source directories',
  geoserverPublishRootsHint: 'One local directory per line. Publication is disabled while this list is empty.',
  geoserverDefaultWorkspace: 'Default publication workspace',
  geoserverDefaultWorkspaceHint: 'Used when a publication request does not name a workspace. A request can override it.',
  geoserverPublishMaxBytes: 'Maximum source file size (bytes)',
  geoserverPublishMaxBytesHint: 'Largest GeoTIFF or SHP ZIP accepted; default 536870912 (512 MiB).',
  geoserverWebhookUrl: 'Business webhook URL',
  geoserverWebhookUrlHint: 'Optional endpoint that receives confirmed publication results and caller metadata.',
  geoserverWebhookTokenEnv: 'Webhook token environment variable',
  geoserverWebhookTokenEnvHint: 'Name only, for example BUSINESS_WEBHOOK_TOKEN. The token itself stays on the server.',
  geoserverWebhookTimeoutMs: 'Webhook timeout (milliseconds)',
  geoserverWebhookTimeoutMsHint: 'Maximum wait for the business webhook; default 5000.',
}

/** Simplified Chinese copy. */
export const zh: Record<PluginsSettingsLocaleKey, string> = {
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  expand: '展开设置',
  collapse: '收起设置',
  save: '保存',
  saving: '保存中…',
  discard: '放弃修改',
  unsaved: '未保存',
  saveFailed: '部署未接受这些值，已保留供你修改。',
  invalidNumber: '请输入数字，或留空使用默认值。',
  invalidPositiveInteger: '请输入正整数，或留空使用默认值。',
  geoserverTitle: 'GeoServer',
  geoserverDescription: 'geoserver 工具的连接、发布和业务通知设置。',
  geoserverBaseUrl: '服务器地址',
  geoserverBaseUrlHint: 'GeoServer 基础地址，例如 http://host:8080/geoserver。',
  geoserverUsername: '用户名',
  geoserverUsernameHint: 'Basic 认证用户名；留空表示匿名访问。',
  geoserverPassword: '密码',
  geoserverPasswordHint: '存储在设置文件之外。留空则保留当前密码。',
  geoserverPasswordSet: '已配置密码。',
  geoserverPasswordUnset: '未配置密码，仅匿名访问。',
  geoserverPublishRoots: '发布源目录',
  geoserverPublishRootsHint: '每行填写一个本地目录；列表为空时禁用发布能力。',
  geoserverDefaultWorkspace: '默认发布工作区',
  geoserverDefaultWorkspaceHint: '发布命令未指定工作区时使用；命令中指定的工作区会覆盖此值。',
  geoserverPublishMaxBytes: '源文件最大字节数',
  geoserverPublishMaxBytesHint: '允许上传的最大 GeoTIFF 或 SHP ZIP；默认 536870912（512 MiB）。',
  geoserverWebhookUrl: '业务回调地址',
  geoserverWebhookUrlHint: '可选；图层确认发布成功后，将结果和调用方元数据发送到这里。',
  geoserverWebhookTokenEnv: '回调令牌环境变量名',
  geoserverWebhookTokenEnvHint: '只填变量名，例如 BUSINESS_WEBHOOK_TOKEN；真正的令牌仅保存在服务器。',
  geoserverWebhookTimeoutMs: '回调超时（毫秒）',
  geoserverWebhookTimeoutMsHint: '等待业务回调的最长时间；默认 5000。',
}
