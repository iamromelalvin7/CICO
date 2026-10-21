import { CircleAlert, Info, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'info' | 'offline' | 'error'

const TONES: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-border bg-surface-muted text-ink', icon: Info },
  offline: { box: 'border-amber/30 bg-amber/10 text-ink', icon: WifiOff },
  error: { box: 'border-error/30 bg-error/5 text-ink', icon: CircleAlert },
}

const ICON_COLOUR: Record<Tone, string> = {
  info: 'text-ink-muted',
  offline: 'text-amber',
  error: 'text-error-text',
}

interface InlineNoticeProps {
  tone?: Tone
  children: ReactNode
  action?: ReactNode
}

export function InlineNotice({ tone = 'info', children, action }: InlineNoticeProps) {
  const { box, icon: Icon } = TONES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-start gap-3 rounded-sm border px-3.5 py-3 text-sm ${box}`}
    >
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${ICON_COLOUR[tone]}`} />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {action && <div className="basis-full pl-7 sm:basis-auto sm:pl-0">{action}</div>}
    </div>
  )
}
