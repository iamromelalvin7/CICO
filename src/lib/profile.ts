import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const NAME_KEY = 'profile:name'
export const NAME_MAX = 40

// The name used in the greeting. Stored on this device only.
export async function getDisplayName(): Promise<string> {
  const value = (await db.meta.get(NAME_KEY))?.value
  return typeof value === 'string' ? value : ''
}

export async function setDisplayName(name: string): Promise<void> {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  if (clean) await db.meta.put({ key: NAME_KEY, value: clean })
  else await db.meta.delete(NAME_KEY)
}

export function useDisplayName(): string | undefined {
  return useLiveQuery(getDisplayName)
}
