import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  getBalance,
  getTotalsByCategory,
  getTotalsForPeriod,
  INVESTMENTS_CATEGORY_ID,
  listRecentTransactions,
  netMovedInto,
  SAVINGS_CATEGORY_ID,
  type CategoryTotal,
} from '../../db'
import { monthRange, previousComparableRange, toLocalDate } from '../../lib/dates'

// Everything the dashboard shows, from the shared query layer. Re-runs whenever
// local data changes. `undefined` while loading.
export function useDashboardData(month: Date) {
  const key = toLocalDate(month)
  return useLiveQuery(async () => {
    const range = monthRange(month)
    const previousRange = previousComparableRange(month)
    const [balance, period, previous, byCategory, recent, categories] = await Promise.all([
      getBalance(),
      getTotalsForPeriod(range.start, range.end),
      getTotalsForPeriod(previousRange.start, previousRange.end),
      getTotalsByCategory(range.start, range.end),
      listRecentTransactions(5),
      // Includes deleted categories so older rows still show their name.
      db.categories.toArray(),
    ])
    const isSavingsOrInvestment = (c: CategoryTotal) =>
      c.category_id === SAVINGS_CATEGORY_ID || c.category_id === INVESTMENTS_CATEGORY_ID

    const spending = byCategory.filter((c) => c.direction === 'expense' && !isSavingsOrInvestment(c))
    const movedOut = byCategory
      .filter((c) => c.direction === 'expense' && isSavingsOrInvestment(c))
      .reduce((sum, c) => sum + Math.round(c.total * 100), 0) / 100

    return {
      range,
      previousRange,
      balance,
      period,
      previous,
      savings: netMovedInto(byCategory, SAVINGS_CATEGORY_ID),
      investments: netMovedInto(byCategory, INVESTMENTS_CATEGORY_ID),
      // Portion of this period's expenses that went into savings/investments.
      movedToSavingsAndInvestments: movedOut,
      spending,
      recent,
      categories: new Map(categories.map((c) => [c.id, c])),
    }
  }, [key])
}

export type DashboardData = NonNullable<ReturnType<typeof useDashboardData>>
