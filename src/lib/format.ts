export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtMonth(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-15T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function noteHref(n: { path?: string | null; id: string }): string {
  return `/n/${encodeURIComponent(n.path ?? n.id)}`
}

export function title(n: { path?: string | null; content?: string; preview?: string }): string {
  const body = n.content ?? n.preview ?? ''
  const h1 = body.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].replace(/\s+—.*$/, '')
  if (n.path) return n.path.split('/').pop() ?? n.path
  return 'untitled'
}
