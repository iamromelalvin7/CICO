// Local PIN lock. Deters casual access to this device; it is not account security.
// The PIN never leaves the device: only a salted PBKDF2 hash is stored, in IndexedDB.

import { db } from '../db'

const PIN_KEY = 'lock:pin'
const SESSION_KEY = 'lock:sessionUntil'
const SESSION_MS = 3 * 24 * 60 * 60 * 1000
const ITERATIONS = 200_000

export const PIN_PATTERN = /^\d{4,6}$/

interface StoredPin {
  salt: string
  hash: string
  iterations: number
}

export async function hasPin(): Promise<boolean> {
  return (await db.meta.get(PIN_KEY)) !== undefined
}

export async function setPin(pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new RangeError('PIN must be 4 to 6 digits.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const value: StoredPin = {
    salt: toBase64(salt),
    hash: await derive(pin, salt, ITERATIONS),
    iterations: ITERATIONS,
  }
  await db.meta.put({ key: PIN_KEY, value })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = (await db.meta.get(PIN_KEY))?.value as StoredPin | undefined
  if (!stored || !PIN_PATTERN.test(pin)) return false
  const hash = await derive(pin, fromBase64(stored.salt), stored.iterations)
  return hash === stored.hash
}

// Removes the PIN and ends the session. Transactions and categories are untouched.
export async function clearPin(): Promise<void> {
  await db.meta.bulkDelete([PIN_KEY, SESSION_KEY])
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
