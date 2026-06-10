import { Link } from 'react-router-dom'
import { byMetaDesc, meta, names, summaryOf } from '../lib/domain'
import { fmtDate, noteHref, title } from '../lib/format'
import { useNotes } from '../vault/useNotes'

export function Today() {
  const initiatives = useNotes({ tag: 'initiative', limit: 50, include_content: true })
  const meetings = useNotes({ tag: 'meeting', limit: 200 })
  const decisions = useNotes({ tag: 'decision', limit: 100 })
  const reports = useNotes({ tag: 'report', limit: 30 })

  const latestMeetings = [...meetings.notes].sort(byMetaDesc('held_on')).slice(0, 4)
  const latestDecisions = [...decisions.notes].sort(byMetaDesc('held_on')).slice(0, 4)
  const latestReport = [...reports.notes]
    .filter((n) => (n.path ?? '').includes('/daily/'))
    .sort((a, b) => (b.path ?? '').localeCompare(a.path ?? ''))[0]
  const err = initiatives.error || meetings.error || decisions.error

  return (
    <div className="page">
      <h1 className="northstar">
        The team's <em>shared brain</em>.
      </h1>
      <p className="thesis">
        A living center for the work on <strong>rebuild.how</strong> — organized around the
        initiatives we're building, fed by everyone's context. Browse it here, or plug the vault
        into your own Claude and just ask.
      </p>

      {err && <div className="error-note">{err}</div>}

      <div className="statrow">
        <Link className="stat" to="/initiatives">
          <div className="num">{initiatives.notes.length}</div>
          <div className="label mono-tag">initiatives</div>
        </Link>
        <Link className="stat" to="/meetings">
          <div className="num">{meetings.notes.length}</div>
          <div className="label mono-tag">meetings</div>
        </Link>
        <Link className="stat" to="/decisions">
          <div className="num">{decisions.notes.length}</div>
          <div className="label mono-tag">decisions</div>
        </Link>
        <Link className="stat" to="/people">
          <div className="num teal">graph</div>
          <div className="label mono-tag">people · linked</div>
        </Link>
      </div>

      <div>
        <div className="section-head">
          <span className="pip teal" />
          <span className="mono-tag">initiatives</span>
        </div>
        <div className="grid2">
          {initiatives.notes.map((n) => (
            <Link key={n.id} className="card" to={noteHref(n)}>
              <div className="cardmeta">
                <span className="pill">{meta(n, 'status') || 'active'}</span>
              </div>
              <h3>{title(n)}</h3>
              <p className="summary">{summaryOf(n)}</p>
              {meta(n, 'contributors') && (
                <div className="chips">
                  {names(meta(n, 'contributors')).slice(0, 3).map((c) => (
                    <span key={c} className="chip">{c.split('(')[0].trim()}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="cols2">
        <div>
          <div className="section-head">
            <span className="pip gold" />
            <span className="mono-tag">latest meetings</span>
          </div>
          <div className="stack">
            {latestMeetings.map((n) => (
              <Link key={n.id} className="card slim" to={noteHref(n)}>
                <div className="cardmeta">
                  <span className="mono-tag">{fmtDate(meta(n, 'held_on'))}</span>
                </div>
                <h4>{title(n)}</h4>
                <p className="summary tight">{meta(n, 'participants')}</p>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="section-head">
            <span className="pip ink" />
            <span className="mono-tag">recent decisions</span>
          </div>
          <div className="stack">
            {latestDecisions.map((n) => (
              <Link key={n.id} className="card slim" to={noteHref(n)}>
                <div className="cardmeta">
                  <span className="mono-tag">{fmtDate(meta(n, 'held_on'))}</span>
                  {meta(n, 'decision_count') && (
                    <span className="pill">{meta(n, 'decision_count')} decided</span>
                  )}
                </div>
                <h4>{title(n)}</h4>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {latestReport && (
        <div>
          <div className="section-head">
            <span className="pip ash" />
            <span className="mono-tag">kevin's latest daily brief</span>
          </div>
          <Link className="card" to={noteHref(latestReport)}>
            <h3>{title(latestReport)}</h3>
            <p className="summary">{summaryOf(latestReport)}</p>
          </Link>
        </div>
      )}
    </div>
  )
}
