import { Link } from 'react-router-dom'
import { byMetaDesc, meta } from '../lib/domain'
import { fmtDate, fmtMonth, noteHref, title } from '../lib/format'
import { useNotes } from '../vault/useNotes'

export function Meetings() {
  const { notes, loading, error } = useNotes({ tag: 'meeting', limit: 300 })
  const sorted = [...notes].sort(byMetaDesc('held_on'))

  // Group by month of held_on, newest first.
  const groups: { month: string; items: typeof sorted }[] = []
  for (const n of sorted) {
    const m = meta(n, 'held_on').slice(0, 7) || 'undated'
    const g = groups.at(-1)
    if (g && g.month === m) g.items.push(n)
    else groups.push({ month: m, items: [n] })
  }

  return (
    <div className="page">
      <h1 className="page-title">Meetings</h1>
      <p className="page-sub">
        The team's working memory — every call digested (summary · action items · decisions),
        participants linked to people, the transcript kept verbatim underneath.
      </p>
      {error && <div className="error-note">{error}</div>}
      {loading && !notes.length && <div className="loading-dots"><span /><span /><span /></div>}
      {!loading && !notes.length && <div className="empty">No meetings yet.</div>}
      <div className="timeline">
        {groups.map((g) => (
          <div key={g.month}>
            <div className="month-label mono-tag">
              {g.month === 'undated' ? 'undated' : fmtMonth(g.month)}
            </div>
            {g.items.map((n) => (
              <div className="t-item" key={n.id}>
                <span className="pip gold" />
                <Link className="card" to={noteHref(n)}>
                  <div className="cardmeta">
                    <span className="mono-tag">{fmtDate(meta(n, 'held_on'))}</span>
                    {meta(n, 'platform') && <span className="pill">{meta(n, 'platform')}</span>}
                  </div>
                  <h3>{title(n)}</h3>
                  <p className="summary tight">{meta(n, 'participants')}</p>
                </Link>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
