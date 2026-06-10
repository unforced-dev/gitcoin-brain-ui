import { NavLink, Route, Routes } from 'react-router-dom'
import { useSession } from './vault/Session'
import { Connect } from './views/Connect'
import { Decisions } from './views/Decisions'
import { Initiatives } from './views/Initiatives'
import { Meetings } from './views/Meetings'
import { NoteView } from './views/NoteView'
import { OAuthCallback } from './views/OAuthCallback'
import { People } from './views/People'
import { Today } from './views/Today'

function Shell() {
  const { signedIn, logout } = useSession()

  if (!signedIn) return <Connect />

  return (
    <div className="shell">
      <header className="masthead">
        <NavLink to="/" className="wordmark">
          <span className="mark" />
          the gitcoin brain
        </NavLink>
        <span className="mono-tag">shared · team</span>
        <nav>
          <NavLink to="/" end>Today</NavLink>
          <NavLink to="/initiatives">Initiatives</NavLink>
          <NavLink to="/meetings">Meetings</NavLink>
          <NavLink to="/decisions">Decisions</NavLink>
          <NavLink to="/people">People</NavLink>
          <button type="button" className="disconnect mono-tag" onClick={logout}>
            sign out
          </button>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/initiatives" element={<Initiatives />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/decisions" element={<Decisions />} />
        <Route path="/people" element={<People />} />
        <Route path="/n/*" element={<NoteView />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* always reachable — completes the OAuth dance */}
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  )
}
