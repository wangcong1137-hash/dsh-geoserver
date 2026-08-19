/**
 * The GeoServer card's staged form over the `geoserver` settings namespace.
 *
 * The password is the one control that does not live in the section: its
 * literal never rides a response, so the card learns only whether one is
 * configured and writes it through the credentials domain, addressed by the
 * fixed reference the host plugin resolves. It is still staged with the rest
 * of the form, so one save covers everything the card shows.
 */

import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  CardForm, textField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'

/**
 * Namespace of the geoserver consumer. Spelled here rather than imported: a
 * client package must not depend on a Host package.
 */
export const GEOSERVER_NS = 'geoserver'

/** Credential reference the host plugin resolves for Basic-auth. */
export const GEOSERVER_PASSWORD_REF = 'GEOSERVER_PASS'

/** Form field the credential control stages under. */
const PASSWORD_FIELD = 'password'

/** The geoserver fields this card edits. */
export interface GeoserverSettings {
  /** GeoServer base URL. */
  baseUrl?: string
  /** Basic-auth username; blank means anonymous access. */
  username?: string
}

/** What the credentials domain last reported for the password reference. */
interface CredentialState {
  /** Reference this answer describes; a stale response for another one is dropped. */
  ref: string
  /** Whether any layer supplies a value for it. */
  configured: boolean
  /** Whether `credentials.set` can affect it; false disables the control. */
  writable: boolean
}

/** What the GeoServer card renders. */
export interface GeoserverCardState extends CardShell {
  /** Server URL. */
  baseUrl: CardFieldState
  /** Basic-auth username. */
  username: CardFieldState
  /** The staged password, which starts blank on every load. */
  password: CardFieldState
  /** Whether the Host reports a credential configured for the password reference. */
  passwordConfigured: boolean
  /** Whether the credentials domain accepts a write for it; false disables the control. */
  passwordWritable: boolean
}

/** The registration-side face the card's slot entry injects. */
export interface GeoserverCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useGeoserverCard. */
    geoserverCard: SnapshotStore<GeoserverCardState>
  }
}

/** Bridges the `geoserver` scope and the credentials domain onto the card. */
export class GeoserverCardController {
  private readonly form: CardForm<GeoserverSettings>
  private readonly store: SnapshotStore<GeoserverCardState>
  private credential: CredentialState = { ref: GEOSERVER_PASSWORD_REF, configured: false, writable: true }

  /**
   * @param scope - the bound settings scope for the `geoserver` namespace.
   * @param api - wire face used for the password the section references.
   */
  constructor(
    private readonly scope: SettingsScope<GeoserverSettings>,
    private readonly api: Pick<IApiClient, 'credentials'>,
  ) {
    this.form = new CardForm(
      scope,
      [textField('baseUrl'), textField('username')],
      [{ field: PASSWORD_FIELD, write: text => this.writePassword(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  private projection(): GeoserverCardState {
    return {
      ...this.form.shell(),
      baseUrl: this.form.field('baseUrl'),
      username: this.form.field('username'),
      password: this.form.field(PASSWORD_FIELD),
      passwordConfigured: this.credential.configured,
      passwordWritable: this.credential.writable,
    }
  }

  /**
   * Ask the credentials domain about the password reference.
   *
   * The answer is stored with the reference it describes; the reference is
   * fixed for this card, so an out-of-order response cannot mislead.
   */
  private async readCredential(): Promise<void> {
    let response: Awaited<ReturnType<IApiClient['credentials']['describe']>>
    try {
      response = await this.api.credentials.describe({ refs: [GEOSERVER_PASSWORD_REF] })
    } catch (_credentialReadFailure) {
      // The card stays usable without this: the control simply reports the
      // last state it knew, and a write still reaches the Host.
      return
    }
    if (!response.result.ok) return
    const view = response.result.value.credentials[GEOSERVER_PASSWORD_REF]
    const next: CredentialState = {
      ref: GEOSERVER_PASSWORD_REF,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the card guessing a refusal.
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): GeoserverCardFace {
    return { hooks: { geoserverCard: this.store }, ...this.form.actions() }
  }

  /**
   * Write the staged password, then re-read whether the Host now holds one.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  private async writePassword(value: string): Promise<boolean> {
    try {
      await this.api.credentials.set({ ref: GEOSERVER_PASSWORD_REF, value })
    } catch (_credentialWriteFailure) {
      // Refusals surface through the re-read below: the Host is the only
      // authority on whether the password now exists.
    }
    await this.readCredential()
    return this.credential.configured
  }
}

export type { SettingsScopeSnapshot }
