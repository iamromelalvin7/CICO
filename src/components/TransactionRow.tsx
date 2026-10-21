import type { Category, Transaction } from '../db'
import { formatDateTime, formatSignedMoney } from '../lib/format'
import { CategoryIcon } from './CategoryIcon'

interface TransactionRowProps {
  transaction: Transaction
  category: Category | undefined
}

// Direction is shown by sign and wording, not colour alone. Built from spans so it can sit
// inside a button.
export function TransactionRow({ transaction: t, category }: TransactionRowProps) {
  const income = t.direction === 'income'
  const categoryName = category?.name ?? 'Deleted category'

  return (
    <span className="flex items-center gap-3 py-3">
      <CategoryIcon id={t.category_id} name={categoryName} color={category?.color_or_icon ?? '#60716C'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{t.description || categoryName}</span>
        <span className="block truncate text-xs text-ink-muted">{categoryName}</span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={`block text-sm font-semibold tabular-nums ${income ? 'text-positive' : 'text-expense-text'}`}
        >
          <span className="sr-only">{income ? 'Income' : 'Expense'}: </span>
          {formatSignedMoney(t.amount, t.direction)}
        </span>
        <span className="block text-xs text-ink-muted tabular-nums">{formatDateTime(t.occurred_at)}</span>
      </span>
    </span>
  )
}
