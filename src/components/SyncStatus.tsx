import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { syncNow, type SyncPhase } from '../sync/sync'
import { useSyncStatus } from '../sync/useSyncStatus'

const DOT: Record<SyncPhase, string> = {
  'local-only': 'bg-accent',
  offline: 'bg-amber',
  syncing: 'bg-ink-muted/50 motion-safe:animate-pulse',
  synced: 'bg-accent',
  error: 'bg-amber',
}

// Never says "Synced" until the server has confirmed every local change.
export function SyncStatus({ className = '' }: { className?: string }) {
  const { phase, pending } = useSyncStatus()
  const online = useOnlineStatus()

  const label =
    phase === 'local-only'
      ? online
        ? 'Online · Saved on this device'
        : 'Offline · Saved on this device'
      : phase === 'offline'
        ? pending > 0
          ? `Offline · ${pending} ${pending === 1 ? 'change' : 'changes'} saved on this device`
          : 'Offline · Saved on this device'
        : phase === 'syncing'
          ? 'Syncing…'
          : phase === 'synced'
            ? 'Online · Synced'
            : 'Sync needs attention'

  return (
    <div className={`flex items-center gap-2 text-xs text-ink-muted ${className}`}>
      <p role="status" className="flex min-w-0 items-center gap-2">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[phase]}`} />
        <span className="truncate">{label}</span>
      </p>
      {phase === 'error' && (
        <button
          type="button"
          onClick={() => void syncNow()}
          title="Couldn't reach the server. Everything is still saved on this device."
          className="-my-2 inline-flex min-h-9 shrink-0 items-center rounded-sm px-1.5 font-medium text-primary hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}
