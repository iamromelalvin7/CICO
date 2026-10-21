import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { ParsedTransaction } from '../../../shared/ai-contract'
import { PageHeader } from '../../components/PageHeader'
import { listCategories, type Category } from '../../db'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { toLocalDateTime } from '../../lib/format'
import { QuickEntryComposer } from './QuickEntryComposer'
import { emptyFormValues, type FormValues } from './form-values'
import { TransactionForm } from './TransactionForm'

type Mode = 'quick' | 'manual'

const TABS: Array<{ mode: Mode; label: string }> = [
  { mode: 'quick', label: 'Quick add' },
  { mode: 'manual', label: 'Manual' },
]

export function AddTransactionPage() {
  const uid = useId()
  const online = useOnlineStatus()
  const categories = useLiveQuery(listCategories)

  const [mode, setMode] = useState<Mode>('quick')
  const [quickText, setQuickText] = useState('')
  const [review, setReview] = useState<ParsedTransaction | null>(null)
  // Bumped after each manual save to reset the form for the next entry.
  const [manualKey, setManualKey] = useState(0)
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ quick: null, manual: null })

  function selectTab(next: Mode, focus = false) {
    setMode(next)
    if (focus) tabRefs.current[next]?.focus()
  }

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    selectTab(mode === 'quick' ? 'manual' : 'quick', true)
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader title="Add transaction" />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        {review ? (
          <ReviewPanel
            parsed={review}
            categories={categories}
            onBack={() => setReview(null)}
            onSaved={() => {
              setReview(null)
              setQuickText('')
            }}
          />
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Entry method"
              onKeyDown={handleTabKey}
              className="mb-5 grid grid-cols-2 gap-1 rounded-sm bg-surface-muted p-1"
            >
              {TABS.map((tab) => {
                const selected = mode === tab.mode
                return (
                  <button
                    key={tab.mode}
                    ref={(el) => {
                      tabRefs.current[tab.mode] = el
                    }}
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${tab.mode}`}
                    aria-selected={selected}
                    aria-controls={`${uid}-panel-${tab.mode}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(tab.mode)}
                    className={`min-h-10 rounded-[8px] text-sm font-medium transition-colors duration-150 ${
                      selected
                        ? 'bg-surface text-ink shadow-card'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div
              role="tabpanel"
              id={`${uid}-panel-${mode}`}
              aria-labelledby={`${uid}-tab-${mode}`}
            >
              {mode === 'quick' ? (
                <QuickEntryComposer
                  text={quickText}
                  onTextChange={setQuickText}
                  categoryNames={categories?.map((c) => c.name)}
                  online={online}
                  onParsed={setReview}
                  onEnterManually={() => selectTab('manual')}
                />
              ) : (
                <TransactionForm
                  key={manualKey}
                  initial={emptyFormValues()}
                  categories={categories}
                  autoFocus={manualKey > 0}
                  onSaved={() => setManualKey((k) => k + 1)}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

interface ReviewPanelProps {
  parsed: ParsedTransaction
  categories: Category[] | undefined
  onBack: () => void
  onSaved: () => void
}

function ReviewPanel({ parsed, categories, onBack, onSaved }: ReviewPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to entry"
          className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <div className="pt-1.5">
          <h2 className="text-base font-semibold text-ink">Review transaction</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Check each detail. Nothing is saved until you choose Save transaction.
          </p>
        </div>
      </div>
      <TransactionForm
        initial={toFormValues(parsed, categories ?? [])}
        categories={categories}
        proposedCategory={parsed.isNewCategory ? parsed.category : undefined}
        onSaved={onSaved}
        onCancel={onBack}
        cancelLabel="Back to entry"
      />
    </div>
  )
}

function toFormValues(parsed: ParsedTransaction, categories: Category[]): FormValues {
  const lower = parsed.category.toLowerCase()
  const match = categories.find((c) => c.name.toLowerCase() === lower)
  return {
    amount: parsed.amount.toFixed(2),
    direction: parsed.direction,
    category: match
      ? { kind: 'existing', id: match.id }
      : parsed.isNewCategory
        ? { kind: 'new', name: parsed.category }
        : null,
    description: parsed.description,
    occurredAt: parsed.occurredAt ?? toLocalDateTime(new Date()),
  }
}
