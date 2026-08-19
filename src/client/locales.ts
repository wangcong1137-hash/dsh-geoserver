/** Locale bundles for the GeoServer configuration card. */

/** Locale keys these surfaces render. */
export type PluginsSettingsLocaleKey =
  | 'overridden' | 'reset' | 'readOnly' | 'expand' | 'collapse'
  | 'save' | 'saving' | 'discard' | 'unsaved' | 'saveFailed' | 'invalidNumber'
  | 'geoserverTitle' | 'geoserverDescription'
  | 'geoserverBaseUrl' | 'geoserverBaseUrlHint'
  | 'geoserverUsername' | 'geoserverUsernameHint'
  | 'geoserverPassword' | 'geoserverPasswordHint'
  | 'geoserverPasswordSet' | 'geoserverPasswordUnset'

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
  geoserverTitle: 'GeoServer',
  geoserverDescription: 'The GeoServer WMS services the geoserver tools read and render.',
  geoserverBaseUrl: 'Server URL',
  geoserverBaseUrlHint: 'GeoServer base URL, e.g. http://host:8080/geoserver.',
  geoserverUsername: 'Username',
  geoserverUsernameHint: 'Basic-auth user; leave blank for anonymous access.',
  geoserverPassword: 'Password',
  geoserverPasswordHint: 'Stored outside the settings file. Leave blank to keep the current password.',
  geoserverPasswordSet: 'A password is configured.',
  geoserverPasswordUnset: 'No password is configured; anonymous access only.',
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
  geoserverTitle: 'GeoServer',
  geoserverDescription: 'geoserver 工具读取和渲染的 GeoServer WMS 服务。',
  geoserverBaseUrl: '服务器地址',
  geoserverBaseUrlHint: 'GeoServer 基础地址，例如 http://host:8080/geoserver。',
  geoserverUsername: '用户名',
  geoserverUsernameHint: 'Basic 认证用户名；留空表示匿名访问。',
  geoserverPassword: '密码',
  geoserverPasswordHint: '存储在设置文件之外。留空则保留当前密码。',
  geoserverPasswordSet: '已配置密码。',
  geoserverPasswordUnset: '未配置密码，仅匿名访问。',
}
