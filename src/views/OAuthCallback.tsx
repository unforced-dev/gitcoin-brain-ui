/**
 * /oauth/callback — completes the OAuth dance, refreshes session state, routes
 * home. The ?code is single-use, so guard StrictMode's double-effect.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../vault/Session'
import { surface } from '../vault/surface'

export function OAuthCallback() {
  const navigate = useNavigate()
  const { refresh } = useSession()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    surface
      .handleCallback()
      .then(() => {
        refresh() // before navigating — avoids the "log in twice" bounce
        navigate('/', { replace: true })
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Sign-in could not be completed.')
      })
  }, [navigate, refresh])

  if (error) {
    return (
      <div className="connect-wrap">
        <div className="connect">
          <h1>Sign-in didn't complete</h1>
          <p>{error}</p>
          <button type="button" onClick={() => navigate('/', { replace: true })}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="connect-wrap">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )
}
