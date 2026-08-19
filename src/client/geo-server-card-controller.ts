/**
 * The GeoServer card's staged form over the plugin's own config route.
 *
 * The card reads and writes its two section fields through the host plugin's
 * `/geoserver/config` route instead of the settings RPC, so it renders on any
 * host without the `geoserver` namespace being allowlisted in the api-proxy
 * settings gate. The password is the one control that does not live in the
 * section: its literal never rides a response, so the card learns only whether
 * one is configured and writes it through the credentials domain, addressed by
 * the fixed reference the host plugin resolves. It is still staged with the
 * rest of the form, so one save covers everything the card shows.
 */

import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  CardForm, textField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'

/**
 * Namespace of the geoserver consumer. Spelled here rather than imported: a
 * client package must not depend on a Host package. The card registration keys
 * itself to this string.
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

/**
 * A `SettingsScope` backed by the plugin's own `/geoserver/config` route.
 *
 * Implements the same contract the settings RPC scope does — sync snapshot,
 * subscribe, `set`, `unset` — so `CardForm` is reused unchanged. Writes land
 * through a same-origin POST the host plugin serves; the host writes them into
 * the `geoserver` settings namespace directly, so the values still live in the
 * settings document (profile backup and uninstall cleanup recognize them).
 */
class RouteSettingsScope implements SettingsScope<GeoserverSettings> {
  private snapshot: SettingsScopeSnapshot<GeoserverSettings> = {
    status: 'ready',
    value: {},
    base: undefined,
    user: {},
    revision: undefined,
    writable: true,
    mode: 'host',
  }
  private readonly listeners = new Set<() => void>()

  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): SettingsScopeSnapshot<GeoserverSettings> {
    return this.snapshot
  }

  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Queue one field write through the route.
   * @param field - scalar field inside the section.
   * @param value - JSON-shaped value selected by the user.
   */
  async set(field: string, value: unknown): Promise<void> {
    await this.post({ [field]: value })
  }

  /**
   * Queue one field clear through the route, so the field re-inherits the
   * composition layer.
   * @param field - scalar field inside the section.
   */
  async unset(field: string): Promise<void> {
    await this.post({ unset: [field] })
  }

  /** POST one write and re-read the section the host now serves. */
  private async post(body: unknown): Promise<void> {
    const response = await fetch('/geoserver/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`geoserver config write failed (${response.status})`)
    await this.reload()
  }

  /** Re-read the section from the route and publish the new snapshot. */
  private async reload(): Promise<void> {
    try {
      const response = await fetch('/geoserver/config')
      if (!response.ok) throw new Error(`geoserver config read failed (${response.status})`)
      const value = await response.json() as GeoserverSettings
      this.snapshot = {
        status: 'ready',
        value,
        base: undefined,
        user: value,
        revision: undefined,
        writable: true,
        mode: 'host',
      }
    } catch {
      this.snapshot = {
        status: 'unavailable',
        value: undefined,
        base: undefined,
        user: undefined,
        revision: undefined,
        writable: false,
        mode: 'host',
      }
    }
    for (const listener of this.listeners) listener()
  }
}

/** Bridges the config route and the credentials domain onto the card. */
export class GeoserverCardController {
  private readonly form: CardForm<GeoserverSettings>
  private readonly store: SnapshotStore<GeoserverCardState>
  private credential: CredentialState = { ref: GEOSERVER_PASSWORD_REF, configured: false, writable: true }

  /**
   * @param api - wire face used for the password the section references.
   */
  constructor(private readonly api: Pick<IApiClient, 'credentials'>) {
    this.form = new CardForm(
      new RouteSettingsScope(),
      [textField('baseUrl'), textField('username')],
      [{ field: PASSWORD_FIELD, write: text => this.writePassword(text) }],
    )
    this.store = this.form.bind(() => this.projection())
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
