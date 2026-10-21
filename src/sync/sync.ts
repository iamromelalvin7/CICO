// Background sync between IndexedDB (always written first) and Supabase.
//
// One run: push unsynced categories, then transactions (categories first so foreign keys
// resolve), then pull everything changed on the server since the last pull. Conflicts are
// last-write-wins on updated_at, enforced by the server (supabase/schema.sql) and mirrored
// here when merging pulled rows. A row is marked synced only after the server confirms it.

import { liveQuery, type Table } from 'dexie'
import { db, type Category, type Transaction } from '../db'
import {
  fetchChangedRows,
  fetchRowsById,
  remoteConfigured,
  upsertRows,
  type Cursor,
  type RemoteRow,
  type TableName,
} from './remote'

const PUSH_BATCH = 200
const FETCH_BY_ID_BATCH = 100
const PULL_PAGE = 500
// Each pull re-reads this much before the cursor, so a row committed a moment late on
// another device is not skipped. Re-reading is harmless: merging is idempotent.
const PULL_OVERLAP_MS = 10_000
// Waits for a burst of local edits to settle before pushing.
const PUSH_DELAY_MS = 1_500
const POLL_MS = 60_000
const LAST_SYNCED_KEY = 'sync:lastSyncedAt'

export type SyncPhase = 'local-only' | 'offline' | 'syncing' | 'synced' | 'error'

export interface SyncState {
  phase: SyncPhase
  // Local changes not yet confirmed by the server.
  pending: number
  lastSyncedAt: string | null
}

// ---- State, read by the UI through useSyncStatus ----

let online = typeof navigator === 'undefined' ? true : navigator.onLine
let running = false
let failed = false
let pending = 0
let lastSyncedAt: string | null = null
let state: SyncState = derive()
const listeners = new Set<() => void>()

function derive(): SyncState {
  const phase: SyncPhase = !remoteConfigured
    ? 'local-only'
    : !online
      ? 'offline'
      : running
        ? 'syncing'
        : failed
          ? 'error'
          : pending > 0 || !lastSyncedAt
            ? 'syncing'
            : 'synced'
  return { phase, pending, lastSyncedAt }
}

function publish() {
  const next = derive()
  if (
    next.phase !== state.phase ||
    next.pending !== state.pending ||
    next.lastSyncedAt !== state.lastSyncedAt
  ) {
    state = next
    listeners.forEach((l) => l())
  }
}

export function getSyncState(): SyncState {
  return state
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---- Scheduling ----

let inFlight: Promise<void> | null = null
let rerun = false
let pushTimer: number | undefined

// Runs a sync now, or once more after the current one finishes.
export function syncNow(): Promise<void> {
  if (!remoteConfigured || !online) return Promise.resolve()
  if (inFlight) {
    rerun = true
    return inFlight
  }
  inFlight = (async () => {
    do {
      rerun = false
      if (!(await runOnce())) break
    } while (rerun && online)
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

function schedulePush() {
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => void syncNow(), PUSH_DELAY_MS)
}

let started = false

// Starts background sync for the app's lifetime. Safe to call more than once.
export function startSync() {
  if (started || !remoteConfigured) return
  started = true

  void db.meta.get(LAST_SYNCED_KEY).then((row) => {
    lastSyncedAt = typeof row?.value === 'string' ? row.value : null
    publish()
  })

  // Any local write leaves rows unsynced; push them shortly after.
  liveQuery(async () => {
    const [c, t] = await Promise.all([
      db.categories.filter((r) => !r.synced).count(),
      db.transactions.filter((r) => !r.synced).count(),
    ])
    return c + t
  }).subscribe({
    next: (count) => {
      pending = count
      publish()
      if (count > 0) schedulePush()
    },
    error: (err) => console.error('Sync: could not count unsynced rows', err),
  })

  window.addEventListener('online', () => {
    online = true
    publish()
    void syncNow()
  })
  window.addEventListener('offline', () => {
    online = false
    publish()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, POLL_MS)

  void syncNow()
}

// ---- One sync run ----

async function runOnce(): Promise<boolean> {
  running = true
  publish()
  try {
    await push('categories')
    await push('transactions')
    await pull('categories')
    await pull('transactions')
    lastSyncedAt = new Date().toISOString()
    await db.meta.put({ key: LAST_SYNCED_KEY, value: lastSyncedAt })
    failed = false
    return true
  } catch (err) {
    // Local data is untouched; the next trigger (timer, reconnect, new edit) retries.
    console.error('Sync failed', err)
    failed = true
    return false
  } finally {
    running = false
    publish()
  }
}

type SyncedRow = Category | Transaction

// Both tables share the sync fields, which is all push/pull/merge touch.
function tableFor(name: TableName): Table<SyncedRow, string> {
  return (name === 'categories' ? db.categories : db.transactions) as unknown as Table<SyncedRow, string>
}

async function push(name: TableName) {
  const table = tableFor(name)
  const unsynced = await table.filter((r) => !r.synced).toArray()
  for (let i = 0; i < unsynced.length; i += PUSH_BATCH) {
    const batch = unsynced.slice(i, i + PUSH_BATCH)
    const accepted = await upsertRows(
      name,
      batch.map(({ synced: _synced, ...row }) => row),
    )

    // The server skipped rows it already had a newer (or the same) version of. Fetch its
    // version so this device converges instead of keeping a copy no one else has.
    const skipped = batch.filter((r) => !accepted.has(r.id)).map((r) => r.id)
    for (let j = 0; j < skipped.length; j += FETCH_BY_ID_BATCH) {
      await merge(table, await fetchRowsById<SyncedRow>(name, skipped.slice(j, j + FETCH_BY_ID_BATCH)))
    }

    // Mark synced only if the row wasn't edited again while the request was in flight.
    await db.transaction('rw', table, async () => {
      for (const sent of batch) {
        if (!accepted.has(sent.id)) continue
        const current = await table.get(sent.id)
        if (current && !current.synced && current.updated_at === sent.updated_at) {
          await table.put({ ...current, synced: true })
        }
      }
    })
  }
}

async function pull(name: TableName) {
  const table = tableFor(name)
  const key = `sync:cursor:${name}`
  const saved = (await db.meta.get(key))?.value as Cursor | undefined
  let from: { since: string } | { after: Cursor } | null = saved
    ? { since: new Date(Date.parse(toIso(saved.ts)) - PULL_OVERLAP_MS).toISOString() }
    : null

  for (;;) {
    const rows = await fetchChangedRows<SyncedRow>(name, from, PULL_PAGE)
    if (rows.length === 0) break
    await merge(table, rows)
    const last = rows[rows.length - 1]
    // Saved per page so an interrupted pull resumes near where it stopped. A finished pull
    // always ends at or past the old cursor, since server_updated_at only increases.
    const cursor: Cursor = { ts: last.server_updated_at, id: last.id }
    await db.meta.put({ key, value: cursor })
    if (rows.length < PULL_PAGE) break
    from = { after: cursor }
  }
}

// Last write wins: a server row replaces the local one only if it is newer. A local row
// with unpushed newer edits is kept and pushed on the next run.
async function merge(table: Table<SyncedRow, string>, remote: RemoteRow<SyncedRow>[]) {
  if (remote.length === 0) return
  await db.transaction('rw', table, async () => {
    const locals = await table.bulkGet(remote.map((r) => r.id))
    const writes: SyncedRow[] = []
    remote.forEach((r, i) => {
      const incoming = toLocal(r)
      const local = locals[i]
      if (!local || incoming.updated_at > local.updated_at) writes.push(incoming)
      else if (incoming.updated_at === local.updated_at && !local.synced) {
        writes.push({ ...local, synced: true })
      }
    })
    if (writes.length > 0) await table.bulkPut(writes)
  })
}

// Postgres returns "2026-10-21T08:30:00.123456+00:00"; locally every timestamp is
// Date#toISOString ("2026-10-21T08:30:00.123Z") so they compare correctly as text.
function toLocal(row: RemoteRow<SyncedRow>): SyncedRow {
  const { server_updated_at: _server, ...rest } = row
  const local: Record<string, unknown> = { ...rest, synced: true }
  for (const field of ['created_at', 'updated_at', 'deleted_at', 'occurred_at']) {
    const value = local[field]
    if (typeof value === 'string') local[field] = toIso(value)
  }
  if ('amount' in local) local.amount = Number(local.amount)
  return local as unknown as SyncedRow
}

function toIso(timestamp: string): string {
  // Trim sub-millisecond digits, which Date parsing doesn't reliably accept.
  return new Date(timestamp.replace(/(\.\d{3})\d+/, '$1')).toISOString()
}
