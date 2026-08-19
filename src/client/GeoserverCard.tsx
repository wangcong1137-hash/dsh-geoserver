/**
 * The GeoServer provider's card: its server URL, its Basic-auth username, and
 * the password — which is written through the credentials domain, never into
 * the settings section, so the literal never rides a response.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SecretField, TextAreaField, ValueField } from './fields.tsx'
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
      <TextAreaField
        id="plugin-config-geoserver-publish-roots"
        label={t('geoserverPublishRoots')}
        hint={t('geoserverPublishRootsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.publishRoots}
        onEdit={(text) => { props.edit('publishRoots', text) }}
        onReset={() => { props.resetField('publishRoots') }}
      />
      <ValueField
        id="plugin-config-geoserver-default-workspace"
        label={t('geoserverDefaultWorkspace')}
        hint={t('geoserverDefaultWorkspaceHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.defaultWorkspace}
        onEdit={(text) => { props.edit('defaultWorkspace', text) }}
        onReset={() => { props.resetField('defaultWorkspace') }}
      />
      <ValueField
        id="plugin-config-geoserver-publish-max-bytes"
        label={t('geoserverPublishMaxBytes')}
        hint={t('geoserverPublishMaxBytesHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidPositiveInteger')}
        disabled={disabled}
        numeric
        {...state.publishMaxBytes}
        onEdit={(text) => { props.edit('publishMaxBytes', text) }}
        onReset={() => { props.resetField('publishMaxBytes') }}
      />
      <ValueField
        id="plugin-config-geoserver-webhook-url"
        label={t('geoserverWebhookUrl')}
        hint={t('geoserverWebhookUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.webhookUrl}
        onEdit={(text) => { props.edit('webhookUrl', text) }}
        onReset={() => { props.resetField('webhookUrl') }}
      />
      <ValueField
        id="plugin-config-geoserver-webhook-token-env"
        label={t('geoserverWebhookTokenEnv')}
        hint={t('geoserverWebhookTokenEnvHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.webhookTokenEnv}
        onEdit={(text) => { props.edit('webhookTokenEnv', text) }}
        onReset={() => { props.resetField('webhookTokenEnv') }}
      />
      <ValueField
        id="plugin-config-geoserver-webhook-timeout-ms"
        label={t('geoserverWebhookTimeoutMs')}
        hint={t('geoserverWebhookTimeoutMsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidPositiveInteger')}
        disabled={disabled}
        numeric
        {...state.webhookTimeoutMs}
        onEdit={(text) => { props.edit('webhookTimeoutMs', text) }}
        onReset={() => { props.resetField('webhookTimeoutMs') }}
      />
    </PluginCard>
  )
}
