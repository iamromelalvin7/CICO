// PIN lock. Deters casual access; it is not account security. Only a salted PBKDF2 hash is
// stored: in IndexedDB, and in Supabase (when configured) so one PIN unlocks every device,
// including the installed app, which has its own storage. Last write wins on updated_at.

import { db } from '../db'
import { fetchSetting, putSetting, remoteConfigured } from '../sync/remote'

const PIN_KEY = 'lock:pin'
// Set while the local PIN hasn't reached the server yet: 'create' for a first PIN, which
// must not replace one another device already set; 'replace' for a change or a reset.
const UNSYNCED_KEY = 'lock:pinUnsynced'
const REMOTE_KEY = 'pin'
const SESSION_KEY = 'lock:sessionUntil'
const SESSION_MS = 3 * 24 * 60 * 60 * 1000
const ITERATIONS = 200_000

export const PIN_PATTERN = /^\d{4,6}$/

interface StoredPin {
  salt: string
  hash: string
  iterations: number
  // Missing on PINs saved before sync; those count as oldest.
  updated_at?: string
}

type PinWrite = 'create' | 'replace'

export async function hasPin(): Promise<boolean> {
  return (await db.meta.get(PIN_KEY)) !== undefined
}

// `create` for the first PIN on a device, `replace` for a change or a reset.
export async function setPin(pin: string, mode: PinWrite): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new RangeError('PIN must be 4 to 6 digits.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const value: StoredPin = {
    salt: toBase64(salt),
    hash: await derive(pin, salt, ITERATIONS),
    iterations: ITERATIONS,
    updated_at: new Date().toISOString(),
  }
  await db.meta.bulkPut([
    { key: PIN_KEY, value },
    { key: UNSYNCED_KEY, value: mode },
  ])
  // Best effort; the background sync retries.
  void syncPin().catch((err) => console.error('PIN sync failed', err))
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = (await db.meta.get(PIN_KEY))?.value as StoredPin | undefined
  if (!stored || !PIN_PATTERN.test(pin)) return false
  const hash = await derive(pin, fromBase64(stored.salt), stored.iterations)
  return hash === stored.hash
}

// Removes the PIN from this device and ends the session. Transactions and categories are
// untouched, and so is the server's copy until a new PIN replaces it.
export async function clearPin(): Promise<void> {
  await db.meta.bulkDelete([PIN_KEY, UNSYNCED_KEY, SESSION_KEY])
}

// Pushes a local PIN the server hasn't seen, then adopts the server's if it is newer (or if
// this device's first PIN lost to one set elsewhere). Throws on network errors.
export async function syncPin(): Promise<void> {
  if (!remoteConfigured) return
  const local = (await db.meta.get(PIN_KEY))?.value as StoredPin | undefined
  const mode = (await db.meta.get(UNSYNCED_KEY))?.value as PinWrite | undefined
  if (local && mode) {
    const { updated_at = new Date(0).toISOString(), ...value } = local
    await putSetting(REMOTE_KEY, { value, updated_at }, { replace: mode === 'replace' })
    await db.transaction('rw', db.meta, async () => {
      // Only clear the flag if the PIN wasn't changed again meanwhile.
      const current = (await db.meta.get(PIN_KEY))?.value as StoredPin | undefined
      if (current?.updated_at === local.updated_at) await db.meta.delete(UNSYNCED_KEY)
    })
  }

  const remote = await fetchSetting<Omit<StoredPin, 'updated_at'>>(REMOTE_KEY)
  if (!remote) return
  await db.transaction('rw', db.meta, async () => {
    const current = (await db.meta.get(PIN_KEY))?.value as StoredPin | undefined
    if ((await db.meta.get(UNSYNCED_KEY)) !== undefined) return
    const remoteTime = Date.parse(remote.updated_at)
    const localTime = current?.updated_at ? Date.parse(current.updated_at) : -Infinity
    const lostCreate = mode === 'create' && current?.hash !== remote.value.hash
    if (!current || remoteTime > localTime || lostCreate) {
      await db.meta.put({
        key: PIN_KEY,
        value: { ...remote.value, updated_at: new Date(remoteTime).toISOString() } satisfies StoredPin,
      })
    }
  })
}

export async function startSession(): Promise<void> {
  await db.meta.put({ key: SESSION_KEY, value: new Date(Date.now() + SESSION_MS).toISOString() })
}

export async function endSession(): Promise<void> {
  await db.meta.delete(SESSION_KEY)
}

export async function sessionValid(): Promise<boolean> {
  const until = (await db.meta.get(SESSION_KEY))?.value
  return typeof until === 'string' && Date.parse(until) > Date.now()
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}
