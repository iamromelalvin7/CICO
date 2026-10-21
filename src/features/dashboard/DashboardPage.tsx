import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { TransactionRow } from '../../components/TransactionRow'
import { routeHref } from '../../hooks/useHashRoute'
import {
  addMonths,
  formatRange,
  isSameMonth,
  monthName,
  startOfMonth,
  type DateRange,
} from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { useDashboardData, type DashboardData } from './useDashboardData'

export function DashboardPage() {
  // Captured once per visit; reopening the page picks up a new month.
  const [thisMonth] = useState(() => startOfMonth(new Date()))
  const [month, setMonth] = useState(thisMonth)
  const data = useDashboardData(month)
  const isCurrent = isSameMonth(month, thisMonth)
  const title = `${monthName(month, month.getFullYear() !== thisMonth.getFullYear())} overview`

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">{greeting()}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        </div>
        <div className="flex items-center gap-1 rounded-sm border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Previous month"
            className="flex size-9 items-center justify-center rounded-[8px] text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-ink tabular-nums" aria-live="polite">
            {data ? formatRange(data.range) : ' '}
          </span>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={isCurrent}
            aria-label="Next month"
            className="flex size-9 items-center justify-center rounded-[8px] text-ink-muted hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </header>

      {!data ? (
        <DashboardSkeleton />
      ) : data.balance.transaction_count === 0 ? (
        <EmptyDashboard />
      ) : (
        <DashboardContent data={data} />
      )}
    </div>
  )
}

function DashboardContent({ data }: { data: DashboardData }) {
  const { balance, period, previous, range, previousRange } = data
  return (
    <>
      <section
        aria-labelledby="balance-label"
        className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="balance-label" className="text-sm font-medium text-ink-muted">
          Total balance
        </h2>
        <p className="mt-2 text-[34px] leading-tight font-semibold tracking-tight text-ink tabular-nums sm:text-[40px]">
          {formatMoney(balance.balance)}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          All-time income minus expenses.{' '}
          <span className="block text-ink sm:inline">
            Net for <span className="whitespace-nowrap">{formatRange(range)}</span>:{' '}
            <span className="font-medium tabular-nums">
              {period.net > 0 ? '+' : ''}
              {formatMoney(period.net)}
            </span>
          </span>
        </p>
      </section>

      <section aria-label={`Totals for ${formatRange(range)}`}>
        <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <MetricCard
            label="Income"
            value={period.income}
            change={<Change current={period.income} previous={previous.income} range={previousRange} />}
          />
          <MetricCard
            label="Expenses"
            value={period.expense}
            change={<Change current={period.expense} previous={previous.expense} range={previousRange} />}
            note={
              data.movedToSavingsAndInvestments > 0
                ? `Includes ${formatMoney(data.movedToSavingsAndInvestments)} moved to savings and investments`
                : undefined
            }
          />
          <MetricCard label="Savings" value={data.savings} note="Net moved into savings" />
          <MetricCard label="Investments" value={data.investments} note="Net moved into investments" />
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SpendingByCategory data={data} />
        <RecentTransactions data={data} />
      </div>
    </>
  )
}

function MetricCard({
  label,
  value,
  change,
  note,
}: {
  label: string
  value: number
  change?: ReactNode
  note?: string
}) {
  return (
    <li className="flex flex-col rounded-md border border-border bg-surface p-4 shadow-card">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-ink tabular-nums sm:text-xl">{formatMoney(value)}</p>
      {change}
      {note && <p className="mt-1 text-xs leading-snug text-ink-muted">{note}</p>}
    </li>
  )
}

// Shown only when the comparison period has real data; otherwise nothing.
function Change({ current, previous, range }: { current: number; previous: number; range: DateRange }) {
  if (previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const Icon = pct > 0 ? ArrowUp : ArrowDown
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-ink-muted">
      {pct !== 0 && <Icon aria-hidden className="mt-px size-3.5 shrink-0" />}
      <span>
        {pct === 0 ? 'Same as' : `${Math.abs(pct)}% ${pct > 0 ? 'more than' : 'less than'}`}{' '}
        <span className="whitespace-nowrap">{formatRange(range)}</span>
      </span>
    </p>
  )
}

function SpendingByCategory({ data }: { data: DashboardData }) {
  const total = data.spending.reduce((sum, c) => sum + c.total, 0)
  return (
    <section
      aria-labelledby="spending-heading"
      className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 id="spending-heading" className="text-base font-semibold text-ink">
        Spending by category
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatRange(data.range)} · excludes money moved to savings and investments
      </p>
      {data.spending.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No spending recorded for this period.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-4">
          {data.spending.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0
            return (
              <li key={c.category_id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="truncate font-medium text-ink">{c.category}</span>
                  </span>
                  <span className="shrink-0 text-ink tabular-nums">
                    {formatMoney(c.total)}
                    <span className="ml-2 inline-block w-10 text-right text-xs text-ink-muted">
                      {Math.round(pct)}%
                    </span>
                  </span>
                </div>
                <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: c.color }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RecentTransactions({ data }: { data: DashboardData }) {
  return (
    <section
      aria-labelledby="recent-heading"
      className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 id="recent-heading" className="text-base font-semibold text-ink">
        Recent transactions
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {data.recent.map((t) => (
          <li key={t.id}>
            <TransactionRow transaction={t} category={data.categories.get(t.category_id)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmptyDashboard() {
  return (
    <section className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-14 text-center shadow-card">
      <h2 className="text-lg font-semibold text-ink">No transactions yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        Add your first transaction to see your balance and where your money goes.
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

function DashboardSkeleton() {
  const block = 'animate-pulse rounded-lg bg-surface-muted'
  return (
    <div aria-busy="true" aria-label="Loading overview" className="flex flex-col gap-6">
      <div className={`${block} h-36`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-24 rounded-md`} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${block} h-64`} />
        <div className={`${block} h-64`} />
      </div>
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
