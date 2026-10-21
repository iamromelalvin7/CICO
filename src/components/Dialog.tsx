import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// Modal on the native <dialog>, which traps focus and closes on Escape. A bottom sheet on
// phones, centred on wider screens. Content mounts only while open, so it starts fresh.
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-lg bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40 sm:m-auto sm:max-w-lg sm:rounded-lg"
    >
      {open && (
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 id={titleId} className="pt-2 text-lg font-semibold text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
