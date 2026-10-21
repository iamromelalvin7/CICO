import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export const inputClass =
  'block w-full min-h-11 rounded-sm border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-muted/70 transition-colors duration-150 hover:border-ink-muted/40 focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary aria-invalid:border-error-text'

interface FieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  // Rendered next to the label, e.g. a character count.
  aside?: ReactNode
  children: ReactNode
}

export function Field({ id, label, hint, error, aside, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs font-medium text-error-text">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
