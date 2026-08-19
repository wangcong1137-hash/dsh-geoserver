/**
 * Browser half of the dsh-geoserver package: the GeoServer card inside the
 * Plugins settings section. It edits the `geoserver` settings namespace that
 * the host half registers, and writes the password through the credentials
 * domain (reference `GEOSERVER_PASS`, the same one the host resolves from the
 * environment when no section value exists).
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

/** Required services (cordis fiber inject). `remote` is required by the
 * settings scope binder itself (`ctx.get('remote').$on(...)` for forwarded
 * settings invalidations), not just by this plugin's own event wiring. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

/**
 * Mount the GeoServer card into the plugin configuration section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-geoserver: section dictionaries')

  const card = new GeoserverCardController(ctx.settingsScope.bind({ namespace: GEOSERVER_NS }), api)

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    id: 'geoserver',
    order: 30,
    locale: NS,
    inject: () => card.inject(),
  }, GeoserverCard))
}
