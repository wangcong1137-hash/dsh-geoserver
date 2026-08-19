/**
 * Browser half of the dsh-geoserver package: the GeoServer card inside the
 * Plugins settings section. It reads and writes its section fields through
 * the host plugin's `/geoserver/config` route (no settings RPC, so no
 * api-proxy allowlist is needed), and writes the password through the
 * credentials domain (reference `GEOSERVER_PASS`, the same one the host
 * resolves from the environment when no section value exists).
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry)
// and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { GeoserverCard } from './GeoserverCard.tsx'
import { GEOSERVER_NS, GeoserverCardController } from './geo-server-card-controller.ts'
import { en, zh } from './locales.ts'

export type { GeoserverCardProps } from './GeoserverCard.tsx'
export type { GeoserverCardFace, GeoserverCardState, GeoserverSettings } from './geo-server-card-controller.ts'
export type { SettingsPluginItemOwnerProps } from './slot-contract.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'geoserver'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** GeoServer card copy, registered on its own namespace to stay independent of the section's dictionary. */
    geoserver: import('./locales.ts').PluginsSettingsLocaleKey
  }
}

/** The subset of the slots service the settings card registration touches. */
interface SettingsScopeHostSlots {
  inject(name: string, register: () => unknown): void
  register(options: Record<string, unknown>, render: (props: never) => unknown): unknown
}

/** The settings-scope host face the nested inject observes. */
interface SettingsScopeHost {
  slots: SettingsScopeHostSlots
}

/** Required services (cordis fiber inject). `settingsScope` is deliberately
 * NOT here: naming it at module level would keep this whole plugin unmounted
 * on any host without that service. It is probed with a nested inject instead
 * (same pattern as dsh-market), so the card simply never appears on hosts
 * without the plugin configuration page. */
export const inject = ['slots', 'locale', 'connection']

/**
 * Mount the GeoServer card into the plugin configuration section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-geoserver: section dictionaries')

  const card = new GeoserverCardController(api)

  const settingsCtx = ctx as unknown as {
    inject(services: string[], callback: (scoped: SettingsScopeHost) => void): void
  }
  settingsCtx.inject(['settingsScope'], (scoped) => {
    scoped.slots.inject('settings.plugin.item', () => scoped.slots.register({
      name: 'settings.plugin.item',
      id: GEOSERVER_NS,
      order: 30,
      locale: NS,
      inject: () => card.inject(),
    }, GeoserverCard))
  })
}
