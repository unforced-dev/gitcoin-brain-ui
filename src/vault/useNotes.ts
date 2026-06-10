import { useEffect, useState } from 'react'
import { type Note, type NotesQuery, queryNotes } from './api'

interface State {
  notes: Note[]
  loading: boolean
  error: string | null
}

// Tiny query hook with an in-memory session cache so view switches feel instant.
const cache = new Map<string, Note[]>()

export function useNotes(q: NotesQuery): State {
  const key = JSON.stringify(q)
  const [state, setState] = useState<State>(() => ({
    notes: cache.get(key) ?? [],
    loading: !cache.has(key),
    error: null,
  }))

  useEffect(() => {
    let alive = true
    const cached = cache.get(key)
    setState({ notes: cached ?? [], loading: !cached, error: null })
    queryNotes(JSON.parse(key) as NotesQuery)
      .then((notes) => {
        cache.set(key, notes)
        if (alive) setState({ notes, loading: false, error: null })
      })
      .catch((e) => {
        if (alive)
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          }))
      })
    return () => {
      alive = false
    }
  }, [key])

  return state
}
