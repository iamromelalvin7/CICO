import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { ParsedTransaction } from '../../../shared/ai-contract'
import { PageHeader } from '../../components/PageHeader'
import { TransactionRow } from '../../components/TransactionRow'
import { db, listCategories, listRecentTransactions, type Category } from '../../db'
import { routeHref } from '../../hooks/useHashRoute'
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:max-w-5xl lg:px-8 lg:py-8">
      <PageHeader title="Add transaction" description="Describe it in plain words, or fill in the details yourself." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
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
        <RecentlyAdded />
      </div>
    </div>
  )
}

// Desktop only: the latest entries, so a save is visibly there without leaving the page.
function RecentlyAdded() {
  const data = useLiveQuery(async () => {
    const [recent, categories] = await Promise.all([listRecentTransactions(5), db.categories.toArray()])
    return { recent, categories: new Map(categories.map((c) => [c.id, c])) }
  })
  return (
    <section aria-labelledby="recently-added" className="hidden rounded-lg border border-border bg-surface p-5 shadow-card lg:block">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recently-added" className="text-base font-semibold text-ink">
          Latest transactions
        </h2>
        <a href={routeHref('transactions')} className="text-sm font-medium text-primary hover:underline">
          View all
        </a>
      </div>
      {!data ? (
        <div aria-busy="true" className="mt-4 h-40 animate-pulse rounded-sm bg-surface-muted" />
      ) : data.recent.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing yet. What you save here appears in this list.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {data.recent.map((t) => (
            <li key={t.id}>
              <TransactionRow transaction={t} category={data.categories.get(t.category_id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
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
