// Reads go through the one resilient surface-client VaultClient.
import type { Note } from '@openparachute/surface-client'
import { getLiveClient } from './surface'

export type { Note }

export interface NotesQuery {
  tag?: string
  path_prefix?: string
  search?: string
  limit?: number
  include_content?: boolean
}

export async function queryNotes(q: NotesQuery): Promise<Note[]> {
  const client = getLiveClient()
  if (!client) throw new Error('Not signed in')
  const params: Record<string, string> = { include_metadata: 'true' }
  if (q.tag) params.tag = q.tag
  if (q.path_prefix) params.path_prefix = q.path_prefix
  if (q.search) params.search = q.search
  if (q.limit) params.limit = String(q.limit)
  if (q.include_content) params.include_content = 'true'
  return client.queryNotes(params)
}

export async function getNote(idOrPath: string): Promise<Note | null> {
  const client = getLiveClient()
  if (!client) throw new Error('Not signed in')
  return client.getNote(idOrPath)
}
