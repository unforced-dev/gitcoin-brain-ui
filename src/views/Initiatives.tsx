import { Link } from 'react-router-dom'
import { INITIATIVE_PIP, meta, names, summaryOf } from '../lib/domain'
import { noteHref, title } from '../lib/format'
import { useNotes } from '../vault/useNotes'

export function Initiatives() {
  const { notes, loading, error } = useNotes({ tag: 'initiative', limit: 100, include_content: true })

  return (
    <div className="page">
      <h1 className="page-title">Initiatives</h1>
      <p className="page-sub">
        What the team is building and pursuing — each a living "where it stands / open loops"
        entity, fed by everyone's context.
      </p>
      {error && <div className="error-note">{error}</div>}
      {loading && !notes.length && <div className="loading-dots"><span /><span /><span /></div>}
      {!loading && !notes.length && <div className="empty">No initiatives yet.</div>}
      <div className="grid2">
        {notes.map((n) => (
          <Link key={n.id} className="card initiative" to={noteHref(n)}>
            <div className="role-line">
              <span className={`pip ${INITIATIVE_PIP[meta(n, 'status')] ?? 'teal'}`} />
              <span className="mono-tag">{meta(n, 'status') || 'active'}</span>
            </div>
            <h3>{title(n)}</h3>
            <p className="summary">{summaryOf(n)}</p>
            {meta(n, 'contributors') && (
              <div className="chips">
                {names(meta(n, 'contributors')).map((c) => (
                  <span key={c} className="chip">{c.split('(')[0].trim()}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
