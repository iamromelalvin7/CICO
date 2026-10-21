import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { Category, Transaction } from '../db'
import { formatDateTime, formatSignedMoney } from '../lib/format'

interface TransactionRowProps {
  transaction: Transaction
  category: Category | undefined
}

// Direction is shown by sign and icon, not colour alone.
export function TransactionRow({ transaction: t, category }: TransactionRowProps) {
  const income = t.direction === 'income'
  const Icon = income ? ArrowDownLeft : ArrowUpRight
  const colour = category?.color_or_icon ?? '#60716C'
  const categoryName = category?.name ?? 'Deleted category'

  return (
    <div className="flex items-center gap-3 py-3">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${colour} 14%, white)`, color: colour }}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{t.description || categoryName}</p>
        <p className="truncate text-xs text-ink-muted">
          {categoryName} · {formatDateTime(t.occurred_at)}
        </p>
      </div>
      <p
        className={`shrink-0 text-sm font-semibold tabular-nums ${income ? 'text-positive' : 'text-expense-text'}`}
      >
        <span className="sr-only">{income ? 'Income' : 'Expense'}: </span>
        {formatSignedMoney(t.amount, t.direction)}
      </p>
    </div>
  )
}
