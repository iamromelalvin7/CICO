import { useOnlineStatus } from '../hooks/useOnlineStatus'

// Connectivity only for now. Sync (step 6) will add "Synced" / "Syncing…" states;
// until then nothing claims to be synced.
export function SyncStatus({ className = '' }: { className?: string }) {
  const online = useOnlineStatus()
  return (
    <p className={`flex items-center gap-2 text-xs text-ink-muted ${className}`}>
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${online ? 'bg-accent' : 'bg-amber'}`}
      />
      {online ? 'Online · Saved on this device' : 'Offline · Saved on this device'}
    </p>
  )
}
