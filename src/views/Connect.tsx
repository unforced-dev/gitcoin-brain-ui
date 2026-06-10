import { useState } from 'react'
import { useSession } from '../vault/Session'

export function Connect() {
  const { login } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await login() // navigates away to the hub consent page
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="connect-wrap">
      <div className="connect">
        <span className="mark big" />
        <div className="eyebrow mono-tag">the gitcoin brain</div>
        <h1>The team's shared brain.</h1>
        <p>
          A living center for the work on rebuild.how — initiatives, meetings, decisions, people.
          Sign in through the Parachute hub to open the vault. Or plug it into your own Claude over
          MCP and just ask.
        </p>
        {error && <div className="error-note">{error}</div>}
        <button type="button" onClick={go} disabled={busy}>
          {busy ? 'Heading to the hub…' : 'Sign in to the vault'}
        </button>
        <p className="fineprint mono-tag">oauth · your token stays in your browser</p>
      </div>
    </div>
  )
}
