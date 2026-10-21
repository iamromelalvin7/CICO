import { Pencil, Plus } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { InlineNotice } from '../../components/InlineNotice'
import { PageHeader } from '../../components/PageHeader'
import { TransactionRow } from '../../components/TransactionRow'
import type { Category, Transaction } from '../../db'
import { routeHref, useHashParam } from '../../hooks/useHashRoute'
import { CategoryIcon } from '../../components/CategoryIcon'
import { formatDateTime, formatSignedMoney } from '../../lib/format'
import { EditTransactionDialog } from './EditTransactionDialog'
import { applyFilters, EMPTY_FILTERS, type Filters } from './filters'
import { TransactionFilters } from './TransactionFilters'
import { useTransactionsData, type TransactionsData } from './useTransactionsData'

const PAGE_SIZE = 50

export function TransactionsPage() {
  const { data, retry } = useTransactionsData()
  // Set by the search box in the top bar; a new search starts from fresh filters.
  const search = useHashParam('q')

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Transactions" description="Everything saved on this device." />
      {!data ? (
        <ListSkeleton />
      ) : !data.ok ? (
        <InlineNotice
          tone="error"
          action={
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          }
        >
          Couldn't read transactions on this device.
        </InlineNotice>
      ) : data.transactions.length === 0 ? (
        <EmptyList />
      ) : (
        <TransactionsContent key={search} data={data} initialSearch={search} />
      )}
    </div>
  )
}

function TransactionsContent({ data, initialSearch }: { data: TransactionsData; initialSearch: string }) {
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, search: initialSearch }))
  const [limit, setLimit] = useState(PAGE_SIZE)
  // Edits always go to the stored row; the id is resolved against live data.
  const [editingId, setEditingId] = useState<string | null>(null)
  const deferredFilters = useDeferredValue(filters)

  const results = useMemo(
    () => applyFilters(data.transactions, data.categories, deferredFilters),
    [data, deferredFilters],
  )
  const shown = results.slice(0, limit)
  const total = data.transactions.length
  const editing = editingId ? (data.transactions.find((t) => t.id === editingId) ?? null) : null

  function updateFilters(next: Filters) {
    setFilters(next)
    setLimit(PAGE_SIZE)
  }

  return (
    <>
      <TransactionFilters
        filters={filters}
        onChange={updateFilters}
        activeCategories={data.activeCategories}
        categories={data.categories}
      />

      <section
        aria-labelledby="results-heading"
        className="rounded-lg border border-border bg-surface shadow-card"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3.5 sm:px-6">
          <h2 id="results-heading" className="text-sm font-semibold text-ink" aria-live="polite">
            {results.length === total
              ? countLabel(total)
              : `${results.length.toLocaleString('en-GH')} of ${countLabel(total)}`}
          </h2>
          <p className="text-xs text-ink-muted">Newest first</p>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <p className="text-base font-semibold text-ink">No transactions match these filters</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Try a different search or a wider date range.
            </p>
            <Button variant="secondary" onClick={() => updateFilters(EMPTY_FILTERS)} className="mt-5">
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <TransactionTable rows={shown} categories={data.categories} onEdit={setEditingId} />
            <ul className="divide-y divide-border px-4 md:hidden">
              {shown.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    className="-mx-4 block w-[calc(100%+2rem)] px-4 text-left hover:bg-surface-muted/60"
                  >
                    <span className="sr-only">Edit: </span>
                    <TransactionRow transaction={t} category={data.categories.get(t.category_id)} />
                  </button>
                </li>
              ))}
            </ul>
            {results.length > shown.length && (
              <div className="flex flex-col items-center gap-2 border-t border-border px-4 py-4">
                <p className="text-xs text-ink-muted tabular-nums">
                  Showing {shown.length.toLocaleString('en-GH')} of{' '}
                  {results.length.toLocaleString('en-GH')}
                </p>
                <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <EditTransactionDialog
        transaction={editing}
        activeCategories={data.activeCategories}
        categories={data.categories}
        onClose={() => setEditingId(null)}
      />
    </>
  )
}

interface TransactionTableProps {
  rows: Transaction[]
  categories: Map<string, Category>
  onEdit: (id: string) => void
}

// Wider screens. Rows open the editor on click; the edit button is the keyboard path.
function TransactionTable({ rows, categories, onEdit }: TransactionTableProps) {
  const th = 'px-3 py-2.5 text-left text-xs font-medium text-ink-muted first:pl-6 last:pr-6'
  return (
    <table className="hidden w-full table-fixed text-sm md:table">
      <caption className="sr-only">Transactions, newest first</caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={`${th} w-44`}>
            Date
          </th>
          <th scope="col" className={th}>
            Description
          </th>
          <th scope="col" className={`${th} w-48`}>
            Category
          </th>
          <th scope="col" className={`${th} w-40 text-right`}>
            Amount
          </th>
          <th scope="col" className={`${th} hidden w-28 lg:table-cell`}>
            Type
          </th>
          <th scope="col" className={`${th} w-16`}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((t) => {
          const category = categories.get(t.category_id)
          const categoryName = category?.name ?? 'Deleted category'
          const income = t.direction === 'income'
          return (
            <tr
              key={t.id}
              onClick={() => onEdit(t.id)}
              className="cursor-pointer transition-colors duration-150 hover:bg-surface-muted/60"
            >
              <td className="py-3 pr-3 pl-6 whitespace-nowrap text-ink-muted tabular-nums">
                {formatDateTime(t.occurred_at)}
              </td>
              <td className="truncate px-3 py-3 font-medium text-ink">
                {t.description || <span className="font-normal text-ink-muted">No description</span>}
              </td>
              <td className="px-3 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryIcon id={t.category_id} name={categoryName} color={category?.color_or_icon ?? '#60716C'} size="sm" />
                  <span className="truncate text-ink">{categoryName}</span>
                </span>
              </td>
              <td
                className={`px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums ${
                  income ? 'text-positive' : 'text-expense-text'
                }`}
              >
                <span className="sr-only">{income ? 'Income' : 'Expense'}: </span>
                {formatSignedMoney(t.amount, t.direction)}
              </td>
              <td className="hidden px-3 py-3 lg:table-cell">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    income ? 'bg-positive-soft text-positive' : 'bg-expense-soft text-expense-text'
                  }`}
                >
                  {income ? 'Income' : 'Expense'}
                </span>
              </td>
              <td className="py-1.5 pr-4 pl-1 text-right">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(t.id)
                  }}
                  aria-label={`Edit ${t.description || categoryName}, ${formatDateTime(t.occurred_at)}`}
                  className="inline-flex size-10 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
                >
                  <Pencil aria-hidden className="size-4" />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function countLabel(n: number): string {
  return `${n.toLocaleString('en-GH')} transaction${n === 1 ? '' : 's'}`
}

function EmptyList() {
  return (
    <section className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-14 text-center shadow-card">
      <h2 className="text-lg font-semibold text-ink">No transactions yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        Everything you add shows up here, newest first, ready to search and filter.
      </p>
      <a
        href={routeHref('add')}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus aria-hidden className="size-4" />
        Add your first transaction
      </a>
    </section>
  )
}

function ListSkeleton() {
  const block = 'animate-pulse rounded-sm bg-surface-muted'
  return (
    <div aria-busy="true" aria-label="Loading transactions" className="flex flex-col gap-6">
      <div className={`${block} h-[70px]`} />
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${block} h-12`} />
        ))}
      </div>
    </div>
  )
}
