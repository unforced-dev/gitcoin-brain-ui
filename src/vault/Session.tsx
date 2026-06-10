/**
 * Session context. Signed-in means hasStoredSession() — session material
 * exists even if the access token is expired (the live client refreshes it
 * on first use). refresh() re-reads after the OAuth callback so the gate
 * doesn't bounce on stale state.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { hasStoredSession, surface } from './surface'

interface Session {
  signedIn: boolean
  login: () => Promise<void>
  logout: () => void
  refresh: () => void
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(() => hasStoredSession())

  const login = useCallback(async () => {
    await surface.login()
  }, [])

  const refresh = useCallback(() => setHasToken(hasStoredSession()), [])

  const logout = useCallback(() => {
    surface.logout()
    setHasToken(false)
  }, [])

  const value = useMemo<Session>(
    () => ({ signedIn: hasToken, login, logout, refresh }),
    [hasToken, login, logout, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): Session {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}
