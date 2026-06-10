/**
 * Module-scope auth wiring for the Gitcoin team brain. Built ONCE.
 * Pattern lifted from games-coop / parachute-brain: surface-client 0.2.0 needs
 * two app-side fixes for return visits — cold-load client_id seeding and a
 * single-flight token refresh (both filed upstream).
 */
import {
  createVaultSurface,
  loadToken,
  VaultClient,
} from '@openparachute/surface-client'

const HUB_URL = 'https://gitcoin-parachute.unforced.dev'
const VAULT_NAME = 'default'
// Must match the factory's internal derivation: slugify("Gitcoin Brain").
const APP_NAME = 'gitcoin-brain'
const DCR_CACHE_KEY = `parachute_surface_dcr:${APP_NAME}`

export const surface = createVaultSurface({
  clientName: 'Gitcoin Brain',
  hubUrl: HUB_URL,
  vaultName: VAULT_NAME,
  redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}oauth/callback`,
})

/** Session material exists (an expired-but-refreshable token still counts). */
export function hasStoredSession(): boolean {
  return loadToken(APP_NAME, VAULT_NAME) !== null
}

// ---- cold-load client_id seeding ----
let seeded = false

function ensureClientIdSeeded(): void {
  if (seeded) return
  try {
    const raw = window.localStorage.getItem(DCR_CACHE_KEY)
    if (!raw) return
    const cached = JSON.parse(raw) as { clientId?: string }
    if (!cached.clientId) return
    const stored = loadToken(APP_NAME, VAULT_NAME)
    surface.oauth.useClientId({
      client_id: cached.clientId,
      scopes: (stored?.scope ?? 'vault:read vault:write').split(/\s+/).filter(Boolean),
    })
    seeded = true
  } catch {
    // Leave unseeded — refresh fails and surfaces as signed-out.
  }
}

// ---- single-flight refresh ----
let refreshInFlight: Promise<string | null> | null = null

function singleFlightRefresh(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      ensureClientIdSeeded()
      const refreshToken = loadToken(APP_NAME, VAULT_NAME)?.refreshToken
      if (!refreshToken) return null
      const { token } = await surface.oauth.refreshAccessToken(refreshToken, VAULT_NAME)
      return token.access_token
    } catch (e) {
      console.error('[gitcoin-brain] token refresh failed:', e)
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

// ---- the one live client ----
let liveClient: VaultClient | null = null

export function getLiveClient(): VaultClient | null {
  if (!hasStoredSession()) return null
  liveClient ??= VaultClient.fromHub({
    hubOrigin: HUB_URL,
    vaultName: VAULT_NAME,
    tokenProvider: () => loadToken(APP_NAME, VAULT_NAME)?.accessToken ?? '',
    onAuthError: singleFlightRefresh,
  })
  return liveClient
}
