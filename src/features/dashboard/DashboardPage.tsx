import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  PiggyBank,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CashFlowBars, type CashFlowMonth } from '../../components/charts/CashFlowBars'
import { DonutChart, type DonutSegment } from '../../components/charts/DonutChart'
import { TrendArea } from '../../components/charts/TrendArea'
import { TransactionRow } from '../../components/TransactionRow'
import { routeHref } from '../../hooks/useHashRoute'
import { addMonths, formatRange, isSameMonth, monthName, startOfMonth } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { useDisplayName } from '../../lib/profile'
import { useDashboardData, type DashboardData } from './useDashboardData'

const SHORT_DAY = new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short' })
const SHORT_MONTH = new Intl.DateTimeFormat('en-GH', { month: 'short' })
// Donuts stay readable with five slices at most; the rest are grouped as "Other".
const MAX_SLICES = 5
const OTHER_COLOUR = '#A9B6B1'

export function DashboardPage() {
  // Captured once per visit; reopening the page picks up a new month.
  const [thisMonth] = useState(() => startOfMonth(new Date()))
  const [month, setMonth] = useState(thisMonth)
  const data = useDashboardData(month)
  const name = useDisplayName()
  const isCurrent = isSameMonth(month, thisMonth)
  const label = monthName(month, month.getFullYear() !== thisMonth.getFullYear())

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-6 sm:px-6 lg:gap-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Here's your financial overview for {isCurrent ? 'this month' : label}.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-sm border border-border bg-surface p-1 shadow-card">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Previous month"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="flex min-w-32 items-center justify-center gap-2 text-sm font-medium text-ink" aria-live="polite">
            <CalendarDays aria-hidden className="size-4 text-ink-muted" />
            {isCurrent ? 'This month' : label}
          </span>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={isCurrent}
            aria-label="Next month"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
        <DashboardContent data={data} isCurrent={isCurrent} monthLabel={label} />
      )}
    </div>
  )
}

function DashboardContent({ data, isCurrent, monthLabel }: { data: DashboardData; isCurrent: boolean; monthLabel: string }) {
  const { period, previous, range, previousRange, balance } = data
  return (
    <>
      <BalanceCard data={data} isCurrent={isCurrent} monthLabel={monthLabel} />

      <section aria-label={`Totals for ${formatRange(range)}`}>
        <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          <MetricCard
            label="Income"
            icon={ArrowDownLeft}
            tint="var(--cico-positive)"
            value={period.income}
            change={<Change current={period.income} previous={previous.income} against={previousRange.end} />}
          />
          <MetricCard
            label="Expenses"
            icon={ArrowUpRight}
            tint="var(--cico-expense)"
            value={period.expense}
            change={<Change current={period.expense} previous={previous.expense} against={previousRange.end} />}
          />
          <MetricCard
            label="Savings"
            icon={PiggyBank}
            tint="var(--cico-amber)"
            value={period.net_moved_to_savings}
            change={<Change current={period.net_moved_to_savings} previous={previous.net_moved_to_savings} against={previousRange.end} />}
            note={`Net moved in · ${formatMoney(balance.in_savings)} in total`}
          />
          <MetricCard
            label="Investments"
            icon={ChartLine}
            tint="var(--cico-violet)"
            value={period.net_moved_to_investments}
            change={<Change current={period.net_moved_to_investments} previous={previous.net_moved_to_investments} against={previousRange.end} />}
            note={`Net moved in · ${formatMoney(balance.in_investments)} in total`}
          />
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <SpendingByCategory data={data} />
        <RecentTransactions data={data} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <CashFlow data={data} />
        <WhereMoneyWent data={data} />
      </div>

      <a
        href={routeHref('ask')}
        className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-5 py-4 shadow-card transition-colors duration-150 hover:border-primary/30 sm:px-6"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MessagesSquare aria-hidden className="size-[18px]" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Ask about your spending</span>
            <span className="block text-sm text-ink-muted">“How much did I spend on food this month?”</span>
          </span>
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
      </a>
    </>
  )
}

function BalanceCard({ data, isCurrent, monthLabel }: { data: DashboardData; isCurrent: boolean; monthLabel: string }) {
  const { daily, period, range, previousRange } = data
  const shown = isCurrent ? data.balance.balance : data.balanceAtEnd
  const canCompare = data.hasPreviousBalance && data.previousBalance > 0
  const pct = canCompare ? Math.round(((data.balanceAtEnd - data.previousBalance) / data.previousBalance) * 100) : 0
  const points = daily.map((d) => {
    const [y, m, day] = d.date.split('-').map(Number)
    return { label: SHORT_DAY.format(new Date(y, m - 1, day)), value: d.balance }
  })
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <section
      aria-labelledby="balance-label"
      className="grid gap-4 overflow-hidden rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center md:gap-8 lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
    >
      <div>
        <h2 id="balance-label" className="text-sm font-medium text-ink-muted">
          {isCurrent ? 'Total balance' : `Balance at the end of ${monthLabel}`}
        </h2>
        <p className="mt-2 text-[32px] leading-tight font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums min-[400px]:text-[34px] sm:text-[40px]">
          {formatMoney(shown)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {canCompare && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                pct >= 0 ? 'bg-positive-soft text-positive' : 'bg-expense-soft text-expense-text'
              }`}
            >
              {pct !== 0 && (pct > 0 ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />)}
              {pct === 0 ? 'No change' : `${Math.abs(pct)}%`}
              <span className="font-normal text-ink-muted">vs {SHORT_DAY.format(parseDay(previousRange.end))}</span>
            </span>
          )}
          <span className="text-ink-muted">
            Change for {formatRange(range)}:{' '}
            <span className="font-medium text-ink tabular-nums">
              {period.balance_change > 0 ? '+' : ''}
              {formatMoney(period.balance_change)}
            </span>
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-muted">Money you can spend: all-time income minus expenses, less what's in savings and investments.</p>
      </div>
      {points.length >= 2 && first && last && (
        <TrendArea
          points={points}
          formatValue={formatMoney}
          height={110}
          summary={`Balance trend: ${formatMoney(first.value)} on ${first.label}, ${formatMoney(last.value)} on ${last.label}.`}
        />
      )}
    </section>
  )
}

function MetricCard({
  label,
  icon: Icon,
  tint,
  value,
  change,
  note,
}: {
  label: string
  icon: LucideIcon
  tint: string
  value: number
  change?: ReactNode
  note?: string
}) {
  return (
    <li className="flex flex-col rounded-md border border-border bg-surface p-4 shadow-card">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${tint} 14%, white)`, color: tint }}
        >
          <Icon className="size-4" />
        </span>
        {label}
      </p>
      <p className="mt-3 text-base font-semibold whitespace-nowrap text-ink tabular-nums min-[400px]:text-lg sm:text-xl">{formatMoney(value)}</p>
      {change}
      {note && <p className="mt-1 text-xs leading-snug text-ink-muted">{note}</p>}
    </li>
  )
}

// Shown only when the comparison period has real data; otherwise nothing.
// Compares with the same stretch of last month (e.g. Sep 1–21 for Oct 1–21).
function Change({ current, previous, against }: { current: number; previous: number; against: string }) {
  if (previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const Icon = pct > 0 ? ArrowUp : ArrowDown
  const detail = `Compared with last month up to ${SHORT_DAY.format(parseDay(against))}`
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted" title={detail}>
      {pct !== 0 && <Icon aria-hidden className="size-3.5 shrink-0" />}
      <span>
        {pct === 0 ? 'No change' : `${Math.abs(pct)}% ${pct > 0 ? 'up' : 'down'}`} vs last month
        <span className="sr-only">. {detail}.</span>
      </span>
    </p>
  )
}

function Card({ id, title, subtitle, action, children }: { id: string; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SpendingByCategory({ data }: { data: DashboardData }) {
  const [active, setActive] = useState<string | null>(null)
  const total = data.spending.reduce((sum, c) => sum + Math.round(c.total * 100), 0) / 100
  const sorted = [...data.spending].sort((a, b) => b.total - a.total)
  const head = sorted.length > MAX_SLICES ? sorted.slice(0, MAX_SLICES - 1) : sorted
  const rest = sorted.slice(head.length)
  const segments: DonutSegment[] = head.map((c) => ({ key: c.category_id, label: c.category, value: c.total, color: c.color }))
  if (rest.length > 0) {
    segments.push({
      key: 'other',
      label: 'Other',
      value: rest.reduce((sum, c) => sum + Math.round(c.total * 100), 0) / 100,
      color: OTHER_COLOUR,
    })
  }

  return (
    <Card id="spending-heading" title="Spending by category" subtitle={`${formatRange(data.range)} · excludes savings and investments`}>
      {segments.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No spending recorded for this period.</p>
      ) : (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
          <DonutChart segments={segments} activeKey={active} onActiveChange={setActive}>
            <span className="text-xs text-ink-muted">Spent</span>
            <span className="text-base font-semibold text-ink tabular-nums">{formatMoney(total)}</span>
          </DonutChart>
          <Legend
            segments={segments}
            total={total}
            active={active}
            onActive={setActive}
            notes={rest.length > 0 ? { other: rest.map((c) => c.category).join(', ') } : undefined}
          />
        </div>
      )}
    </Card>
  )
}

function WhereMoneyWent({ data }: { data: DashboardData }) {
  const [active, setActive] = useState<string | null>(null)
  const { period } = data
  const leftOver = period.balance_change
  // Taken out of savings or investments on balance this period; it counts as money in here.
  const fromPots =
    (Math.round(Math.max(-period.net_moved_to_savings, 0) * 100) +
      Math.round(Math.max(-period.net_moved_to_investments, 0) * 100)) /
    100
  const segments: DonutSegment[] = [
    { key: 'spent', label: 'Spent', value: period.expense, color: 'var(--cico-expense)' },
    { key: 'savings', label: 'To savings', value: Math.max(period.net_moved_to_savings, 0), color: 'var(--cico-amber)' },
    { key: 'investments', label: 'To investments', value: Math.max(period.net_moved_to_investments, 0), color: 'var(--cico-violet)' },
    { key: 'left', label: 'Left over', value: Math.max(leftOver, 0), color: 'var(--cico-accent)' },
  ].filter((s) => s.value > 0)
  const total = segments.reduce((sum, s) => sum + Math.round(s.value * 100), 0) / 100
  const cameIn = (Math.round(period.income * 100) + Math.round(fromPots * 100)) / 100

  return (
    <Card id="went-heading" title="Where your money went" subtitle={`${formatRange(data.range)} · share of money in and out`}>
      {segments.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No money in or out for this period.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
            <DonutChart segments={segments} activeKey={active} onActiveChange={setActive} size={148} thickness={18}>
              <span className="text-xs text-ink-muted">Came in</span>
              <span className="text-sm font-semibold text-ink tabular-nums">{formatMoney(cameIn)}</span>
            </DonutChart>
            <Legend segments={segments} total={total} active={active} onActive={setActive} />
          </div>
          {fromPots > 0 && (
            <p className="mt-4 rounded-sm bg-surface-muted px-3 py-2 text-xs text-ink">
              Includes {formatMoney(fromPots)} taken out of savings and investments.
            </p>
          )}
          {leftOver < 0 && (
            <p className="mt-4 rounded-sm bg-surface-muted px-3 py-2 text-xs text-ink">
              {formatMoney(-leftOver)} more went out than came in this period.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

interface LegendProps {
  segments: DonutSegment[]
  total: number
  active: string | null
  onActive: (key: string | null) => void
  // Extra text per segment key, e.g. which categories "Other" holds.
  notes?: Record<string, string>
}

function Legend({ segments, total, active, onActive, notes }: LegendProps) {
  return (
    <ul className="flex w-full min-w-0 flex-1 flex-col gap-1">
      {segments.map((s) => {
        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
        return (
          <li
            key={s.key}
            onPointerEnter={() => onActive(s.key)}
            onPointerLeave={() => onActive(null)}
            title={notes?.[s.key]}
            className={`flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm transition-colors duration-150 ${
              active === s.key ? 'bg-surface-muted' : ''
            }`}
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink">
              {s.label}
              {notes?.[s.key] && <span className="sr-only"> ({notes[s.key]})</span>}
            </span>
            <span className="shrink-0 text-ink tabular-nums">{formatMoney(s.value)}</span>
            <span className="w-9 shrink-0 text-right text-xs text-ink-muted tabular-nums">{pct}%</span>
          </li>
        )
      })}
    </ul>
  )
}

function CashFlow({ data }: { data: DashboardData }) {
  const months: CashFlowMonth[] = data.cashFlow.map(({ month, totals }, i) => ({
    key: String(i),
    label: SHORT_MONTH.format(month),
    longLabel: monthName(month, true),
    income: totals.income,
    expense: totals.expense,
    current: i === data.cashFlow.length - 1,
  }))
  const hasAny = months.some((m) => m.income > 0 || m.expense > 0)

  return (
    <Card
      id="cashflow-heading"
      title="Cash flow"
      subtitle="Earned and spent over the last six months · excludes savings and investments"
      action={
        <div className="flex shrink-0 items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-accent" /> In
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-expense" /> Out
          </span>
        </div>
      }
    >
      {hasAny ? (
        <div className="mt-6">
          <CashFlowBars months={months} formatValue={formatMoney} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">No money in or out in these months.</p>
      )}
    </Card>
  )
}

function RecentTransactions({ data }: { data: DashboardData }) {
  return (
    <Card
      id="recent-heading"
      title="Recent transactions"
      action={
        <a
          href={routeHref('transactions')}
          className="-my-2 inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-primary hover:underline"
        >
          View all
        </a>
      }
    >
      <ul className="mt-2 divide-y divide-border">
        {data.recent.map((t) => (
          <li key={t.id}>
            <TransactionRow transaction={t} category={data.categories.get(t.category_id)} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function EmptyDashboard() {
  return (
    <section className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-16 text-center shadow-card">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <ChartLine aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">No transactions yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        Add your first transaction to see your balance and where your money goes.
      </p>
      <a
        href={routeHref('add')}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
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
      <div className={`${block} h-44`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-28 rounded-md`} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${block} h-72`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  )
}

function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
