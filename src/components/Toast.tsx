import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ToastContext } from './toast-context'

interface ToastMessage {
  id: number
  title: string
  detail?: string
}

const VISIBLE_MS = 4000

// Quiet, self-dismissing confirmation. One at a time; a new toast replaces the old one.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const show = useCallback((title: string, detail?: string) => {
    setToast({ id: Date.now(), title, detail })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 sm:justify-end sm:px-6 lg:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md bg-ink px-4 py-3 text-sm text-white shadow-lg motion-safe:animate-[toast-in_180ms_ease-out]"
          >
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-mint" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{toast.title}</p>
              {toast.detail && <p className="mt-0.5 truncate text-white/75">{toast.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="-m-1.5 rounded-sm p-1.5 text-white/70 hover:text-white"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

