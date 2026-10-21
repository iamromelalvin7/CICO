// Local record shapes. Field names mirror the Supabase columns so sync can map 1:1.
// All timestamps are UTC ISO strings (Date#toISOString), which sort correctly as text.

import type { Direction } from '../../shared/ai-contract'

export type { Direction }

interface SyncedRecord {
  id: string
  created_at: string
  // Bumped on every local change; last write wins when syncing.
  updated_at: string
  // Soft delete, so a delete made offline still reaches Supabase.
  deleted_at: string | null
  // Local only, never sent to Supabase. False until the server confirms the write.
  synced: boolean
}

export interface Category extends SyncedRecord {
  name: string
  // Hex colour for the category dot.
  color_or_icon: string
  is_default: boolean
}

export interface Transaction extends SyncedRecord {
  amount: number
  direction: Direction
  category_id: string
  description: string
  occurred_at: string
}
