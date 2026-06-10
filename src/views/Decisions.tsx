import { Link } from 'react-router-dom'
import { byMetaDesc, meta } from '../lib/domain'
import { fmtDate, fmtMonth, noteHref, title } from '../lib/format'
import { useNotes } from '../vault/useNotes'

export function Decisions() {
  const { notes, loading, error } = useNotes({ tag: 'decision', limit: 300 })
  const sorted = [...notes].sort(byMetaDesc('held_on'))

  const groups: { month: string; items: typeof sorted }[] = []
  for (const n of sorted) {
    const m = meta(n, 'held_on').slice(0, 7) || 'undated'
    const g = groups.at(-1)
    if (g && g.month === m) g.items.push(n)
    else groups.push({ month: m, items: [n] })
  }

  return (
    <div className="page">
      <h1 className="page-title">Decisions</h1>
      <p className="page-sub">
        What's been decided, woven from the meetings — each record links back to its source call
        and to the people who own the follow-through.
      </p>
      {error && <div className="error-note">{error}</div>}
      {loading && !notes.length && <div className="loading-dots"><span /><span /><span /></div>}
      {!loading && !notes.length && <div className="empty">No decision records yet.</div>}
      <div className="timeline">
        {groups.map((g) => (
          <div key={g.month}>
            <div className="month-label mono-tag">
              {g.month === 'undated' ? 'undated' : fmtMonth(g.month)}
            </div>
            {g.items.map((n) => (
              <div className="t-item" key={n.id}>
                <span className="pip ink" />
                <Link className="card" to={noteHref(n)}>
                  <div className="cardmeta">
                    <span className="mono-tag">{fmtDate(meta(n, 'held_on'))}</span>
                    {meta(n, 'decision_count') && (
                      <span className="pill ink">{meta(n, 'decision_count')} decisions</span>
                    )}
                    {meta(n, 'action_count') && (
                      <span className="pill">{meta(n, 'action_count')} actions</span>
                    )}
                  </div>
                  <h3>{title(n)}</h3>
                  {meta(n, 'decided_by') && (
                    <p className="summary tight">decided by {meta(n, 'decided_by')}</p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
