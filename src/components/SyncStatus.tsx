import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { statusLabel } from '../sync/status-label'
import { syncNow, type SyncPhase } from '../sync/sync'
import { useSyncStatus } from '../sync/useSyncStatus'

const DOT: Record<SyncPhase, string> = {
  'local-only': 'bg-accent',
  offline: 'bg-amber',
  syncing: 'bg-ink-muted/50 motion-safe:animate-pulse',
  synced: 'bg-accent',
  error: 'bg-amber',
}

interface SyncStatusProps {
  className?: string
  // Dot only (collapsed sidebar); the label stays available to screen readers and as a tooltip.
  compact?: boolean
}

// Never says "Synced" until the server has confirmed every local change.
export function SyncStatus({ className = '', compact = false }: SyncStatusProps) {
  const { phase, pending } = useSyncStatus()
  const online = useOnlineStatus()
  const label = statusLabel(phase, pending, online)

  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        {phase === 'error' ? (
          <button
            type="button"
            onClick={() => void syncNow()}
            title={`${label}. Select to retry.`}
            aria-label={`${label}. Retry sync`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-muted"
          >
            <span aria-hidden className={`size-2.5 rounded-full ${DOT[phase]}`} />
          </button>
        ) : (
          <p role="status" title={label} className="flex size-11 items-center justify-center">
            <span aria-hidden className={`size-2.5 rounded-full ${DOT[phase]}`} />
            <span className="sr-only">{label}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-ink-muted ${className}`}>
      <p role="status" className="flex min-w-0 items-center gap-2">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[phase]}`} />
        <span className="truncate">{label}</span>
      </p>
      {phase === 'error' && (
        <button
          type="button"
          onClick={() => void syncNow()}
          title="Couldn't reach the server. Everything is still saved on this device."
          className="-my-2 inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-sm px-1.5 font-medium text-primary hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}
