import { endSession } from './pin'

// Lets the rest of the app (Settings) lock the screen immediately.
const listeners = new Set<() => void>()

export function onLock(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function lockNow(): Promise<void> {
  await endSession()
  listeners.forEach((l) => l())
}
