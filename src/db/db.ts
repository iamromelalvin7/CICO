import Dexie, { type EntityTable } from 'dexie'
import type { Category, Transaction } from './types'

// IndexedDB is the source of truth on the device; the UI never waits on the network.
export const db = new Dexie('cico') as Dexie & {
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
}

// Only indexed fields are listed. `synced` is a boolean, which IndexedDB cannot index,
// so unsynced rows are found by filtering.
db.version(1).stores({
  categories: 'id, name, updated_at',
  transactions: 'id, category_id, occurred_at, updated_at',
})

// Seed categories use fixed IDs so every device creates the same rows and sync
// merges them instead of producing duplicates.
const SEED_CATEGORIES: Array<Pick<Category, 'id' | 'name' | 'color_or_icon'>> = [
  { id: 'fe23e89c-0b86-4464-9027-92525681e009', name: 'Income', color_or_icon: '#237B58' },
  { id: 'cea4fe4b-9359-492f-a62b-fcb82b766afc', name: 'Savings', color_or_icon: '#176B5B' },
  { id: '89eb5e09-b849-4016-8892-83ec577c698b', name: 'Investments', color_or_icon: '#8171BD' },
  { id: '98c609bf-eb66-4ec7-8337-0bd7ea60da04', name: 'Transport', color_or_icon: '#B7792B' },
  { id: '602b8a77-3b3c-42a9-8b84-468f3d2d76d1', name: 'Food', color_or_icon: '#C75C52' },
  { id: 'd38867a1-f80b-41d3-a28e-0bc89241ed99', name: 'Subscriptions', color_or_icon: '#10B981' },
  { id: 'c4568ee2-18a8-4cfe-86f8-362a1eb34e94', name: 'Gifts', color_or_icon: '#B5658F' },
  { id: 'a8ef6482-d7cf-4765-b8e9-d24c5725032f', name: 'Clothes', color_or_icon: '#0F4C3A' },
  { id: 'b3be51f6-d163-48c7-b965-6f023a049983', name: 'Miscellaneous', color_or_icon: '#60716C' },
]

// Runs once, when the database is first created on this device.
db.on('populate', (tx) => {
  const now = new Date().toISOString()
  return tx.table<Category>('categories').bulkAdd(
    SEED_CATEGORIES.map((c) => ({
      ...c,
      is_default: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced: false,
    })),
  )
})
