/**
 * The GeoServer provider's card: its server URL, its Basic-auth username, and
 * the password — which is written through the credentials domain, never into
 * the settings section, so the literal never rides a response.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SecretField, ValueField } from './fields.tsx'
import { PluginCard } from './PluginCard.tsx'
import type { GeoserverCardFace } from './geo-server-card-controller.ts'
import type {} from './slot-contract.ts'

/** Props the renderer binds for the GeoServer card. */
export type GeoserverCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'geoserver'>
  & InjectFace<GeoserverCardFace>

/**
 * Render the GeoServer card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function GeoserverCard(props: GeoserverCardProps) {
  const { t } = props
  const state = props.useGeoserverCard(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <PluginCard
      t={t}
      titleKey="geoserverTitle"
      descriptionKey="geoserverDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <ValueField
        id="plugin-config-geoserver-base-url"
        label={t('geoserverBaseUrl')}
        hint={t('geoserverBaseUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.baseUrl}
        onEdit={(text) => { props.edit('baseUrl', text) }}
        onReset={() => { props.resetField('baseUrl') }}
      />
      <ValueField
        id="plugin-config-geoserver-username"
        label={t('geoserverUsername')}
        hint={t('geoserverUsernameHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.username}
        onEdit={(text) => { props.edit('username', text) }}
        onReset={() => { props.resetField('username') }}
      />
      <SecretField
        id="plugin-config-geoserver-password"
        label={t('geoserverPassword')}
        hint={t('geoserverPasswordHint')}
        disabled={!state.passwordWritable}
        text={state.password.text}
        configured={state.passwordConfigured}
        stateLabel={state.passwordConfigured ? t('geoserverPasswordSet') : t('geoserverPasswordUnset')}
        onEdit={(text) => { props.edit('password', text) }}
      />
    </PluginCard>
  )
}
