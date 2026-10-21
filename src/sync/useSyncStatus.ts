import { useSyncExternalStore } from 'react'
import { getSyncState, subscribeSyncState, type SyncState } from './sync'

export function useSyncStatus(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState)
}
