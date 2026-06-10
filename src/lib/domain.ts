// Thin domain helpers — read metadata straight off notes, no model layer.
import type { Note } from '@openparachute/surface-client'

export function meta(n: Note, key: string): string {
  const v = (n.metadata as Record<string, unknown> | undefined)?.[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

export function byMetaDesc(key: string) {
  return (a: Note, b: Note) => meta(b, key).localeCompare(meta(a, key))
}

// Many entities carry a `summary` in metadata; meetings/decisions don't yet, so
// fall back to the note preview (first content the API returns for a list).
export function summaryOf(n: Note & { preview?: string }): string {
  const s = meta(n, 'summary')
  if (s) return s
  const p = (n as { preview?: string }).preview ?? ''
  // strip a leading "# Heading" line from the preview
  return p.replace(/^#\s+[^\n]+\s*/, '').slice(0, 240)
}

// First names of participants/contributors, for compact chips.
export function names(csv: string): string[] {
  return csv.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
}

export const INITIATIVE_PIP: Record<string, string> = {
  active: 'teal',
  incubating: 'gold',
  paused: 'ash',
  shipped: 'teal',
}
