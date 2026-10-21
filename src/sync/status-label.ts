import type { SyncPhase } from './sync'

// Plain-language sync state, shared by the status indicator and Settings.
export function statusLabel(phase: SyncPhase, pending: number, online: boolean): string {
  switch (phase) {
    case 'local-only':
      return online ? 'Online · Saved on this device' : 'Offline · Saved on this device'
    case 'offline':
      return pending > 0
        ? `Offline · ${pending} ${pending === 1 ? 'change' : 'changes'} saved on this device`
        : 'Offline · Saved on this device'
    case 'syncing':
      return 'Syncing…'
    case 'synced':
      return 'Online · Synced'
    case 'error':
      return 'Sync needs attention'
  }
}
