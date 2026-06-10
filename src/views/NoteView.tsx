import type { Note } from '@openparachute/surface-client'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NoteBody } from '../lib/NoteBody'
import { getNote } from '../vault/api'

// Top-level folders aren't notes — route them to their section views.
const SECTION: Record<string, string> = {
  initiatives: '/initiatives',
  meetings: '/meetings',
  decisions: '/decisions',
  people: '/people',
}

export function NoteView() {
  const params = useParams()
  const idOrPath = decodeURIComponent(params['*'] ?? '')
  const [note, setNote] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setNote(null)
    setError(null)
    getNote(idOrPath)
      .then((n) => {
        if (alive) setNote(n)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [idOrPath])

  const isTranscript = idOrPath.endsWith('/transcript')
  const segments = (note?.path ?? idOrPath).split('/')

  return (
    <div className="page notepage">
      <div className="breadcrumb">
        <Link to="/">brain</Link>
        {segments.map((s, i) => {
          const last = i === segments.length - 1
          const href = i === 0 ? SECTION[s] : `/n/${encodeURIComponent(segments.slice(0, i + 1).join('/'))}`
          return (
            <span key={`${s}-${i}`}>
              /{' '}
              {!last && href ? <Link to={href}>{s}</Link> : s}
            </span>
          )
        })}
      </div>
      {error && <div className="error-note">{error}</div>}
      {!note && !error && <div className="loading-dots"><span /><span /><span /></div>}
      {note && <NoteBody note={note} mono={isTranscript} />}
    </div>
  )
}
