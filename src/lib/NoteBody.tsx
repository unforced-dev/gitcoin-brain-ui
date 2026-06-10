/**
 * Renders a vault note body with surface-render's NoteRenderer:
 *  - linkComponent → react-router <Link> (client-side nav)
 *  - resolve       → [[wikilink]] → /n/<path>
 *  - fetchBlob     → auth'd media via the live VaultClient
 */
import type { Note } from '@openparachute/surface-client'
import { useVaultFetchBlob } from '@openparachute/surface-render/embed'
import { NoteRenderer } from '@openparachute/surface-render/note'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getLiveClient } from '../vault/surface'

const linkComponent = ({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children?: ReactNode
}) => {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

function resolveWikilink(target: string) {
  const clean = target.trim().replace(/^\[\[|\]\]$/g, '')
  return { href: `/n/${encodeURI(clean)}`, exists: true }
}

export function NoteBody({ note, mono = false }: { note: Note; mono?: boolean }) {
  const fetchBlob = useVaultFetchBlob(getLiveClient())
  return (
    <div className={mono ? 'prose transcript' : 'prose'}>
      <NoteRenderer
        note={note}
        linkComponent={linkComponent}
        resolve={resolveWikilink}
        fetchBlob={fetchBlob}
      />
    </div>
  )
}
