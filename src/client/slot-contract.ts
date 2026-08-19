/**
 * The `settings.plugin.item` slot type — one plugin's card inside the plugin
 * configuration section. Options: `id` (card key), `order` (card position).
 * A card draws its own internals; the section only stacks them and reports
 * how many there are.
 *
 * This client half registers its card into the slot the ui-settings-plugins
 * section declares at runtime; the type merges into the shared SlotMap.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One plugin's card inside the plugin configuration section (see module JSDoc). */
    'settings.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}
