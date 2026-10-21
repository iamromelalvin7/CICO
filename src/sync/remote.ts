// Minimal client for Supabase's REST API (PostgREST). Plain fetch keeps the bundle small;
// sync only needs upsert and an ordered, paged select.

import type { Category, Transaction } from '../db'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const remoteConfigured = Boolean(URL && KEY)

export type TableName = 'categories' | 'transactions'

// Server rows: the local shape without `synced`, plus the server's own write time.
export type RemoteRow<T> = Omit<T, 'synced'> & { server_updated_at: string }
export type RemoteCategory = RemoteRow<Category>
export type RemoteTransaction = RemoteRow<Transaction>

export class RemoteError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'RemoteError'
    this.status = status
  }
}

const TIMEOUT_MS = 20_000

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!URL || !KEY) throw new RemoteError(0, 'Supabase is not configured.')
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new RemoteError(res.status, `${init.method ?? 'GET'} ${path.split('?')[0]} failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return res
}

// Insert or update by id. The server keeps whichever version has the newer updated_at and
// skips the rest; returns the ids it accepted.
export async function upsertRows(table: TableName, rows: Array<{ id: string }>): Promise<Set<string>> {
  if (rows.length === 0) return new Set()
  const res = await request(`${table}?on_conflict=id&select=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })
  const accepted = (await res.json()) as Array<{ id: string }>
  return new Set(accepted.map((r) => r.id))
}

export async function fetchRowsById<T>(table: TableName, ids: string[]): Promise<RemoteRow<T>[]> {
  if (ids.length === 0) return []
  const params = new URLSearchParams({ select: '*', id: `in.(${ids.join(',')})` })
  const res = await request(`${table}?${params}`)
  return (await res.json()) as RemoteRow<T>[]
}

export interface Cursor {
  // The server's timestamp exactly as it returned it (microsecond precision).
  ts: string
  id: string
}

// One page of changed rows, oldest first, ordered by (server_updated_at, id) so paging is
// stable even when many rows share a timestamp. Give `since` (inclusive) for the first page
// and `after` (the last row seen) for the pages that follow.
export async function fetchChangedRows<T>(
  table: TableName,
  from: { since: string } | { after: Cursor } | null,
  limit: number,
): Promise<RemoteRow<T>[]> {
  const params = new URLSearchParams({
    select: '*',
    order: 'server_updated_at.asc,id.asc',
    limit: String(limit),
  })
  // Timestamps contain "." and ":", which PostgREST needs quoted inside filters.
  if (from && 'since' in from) {
    params.set('server_updated_at', `gte.${from.since}`)
  } else if (from) {
    const { ts, id } = from.after
    params.set('or', `(server_updated_at.gt."${ts}",and(server_updated_at.eq."${ts}",id.gt.${id}))`)
  }
  const res = await request(`${table}?${params}`)
  return (await res.json()) as RemoteRow<T>[]
}
