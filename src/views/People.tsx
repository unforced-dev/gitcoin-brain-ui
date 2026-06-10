import { Link } from 'react-router-dom'
import { meta } from '../lib/domain'
import { noteHref, title } from '../lib/format'
import { useNotes } from '../vault/useNotes'

const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function People() {
  const people = useNotes({ tag: 'person', limit: 300 })

  // Most-engaged first (by meeting_count); drop the synthetic aggregates.
  const sorted = [...people.notes]
    .filter((n) => !['Meeting', 'Participants'].includes(meta(n, 'name')))
    .sort((a, b) => num(meta(b, 'meeting_count')) - num(meta(a, 'meeting_count')))

  return (
    <div className="page">
      <h1 className="page-title">People</h1>
      <p className="page-sub">
        The stakeholder graph — {sorted.length} people, each linked to the meetings they were in.
        Sorted by how often they show up.
      </p>
      {people.error && <div className="error-note">{people.error}</div>}
      {people.loading && !people.notes.length && (
        <div className="loading-dots"><span /><span /><span /></div>
      )}
      <div className="roster">
        {sorted.map((n) => (
          <Link key={n.id} className="card player" to={noteHref(n)}>
            <div className="role-line">
              <span className="pip teal" />
              <span className="mono-tag">
                {meta(n, 'meeting_count') ? `${meta(n, 'meeting_count')} meetings` : 'person'}
                {meta(n, 'last_contact') ? ` · ${meta(n, 'last_contact')}` : ''}
              </span>
            </div>
            <h3>{meta(n, 'name') || title(n)}</h3>
            {meta(n, 'topics') && <p className="summary tight">{meta(n, 'topics')}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
