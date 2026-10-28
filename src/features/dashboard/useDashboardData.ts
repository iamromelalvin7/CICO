import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  getBalance,
  getBalanceThrough,
  getDailyBalances,
  getTotalsByCategory,
  getTotalsForPeriod,
  INVESTMENTS_CATEGORY_ID,
  listRecentTransactions,
  SAVINGS_CATEGORY_ID,
  type CategoryTotal,
} from '../../db'
import { addMonths, monthRange, previousComparableRange, toLocalDate } from '../../lib/dates'

const CASH_FLOW_MONTHS = 6

const isSavingsOrInvestment = (c: CategoryTotal) =>
  c.category_id === SAVINGS_CATEGORY_ID || c.category_id === INVESTMENTS_CATEGORY_ID

// Everything the dashboard shows, from the shared query layer. Re-runs whenever
// local data changes. `undefined` while loading.
export function useDashboardData(month: Date) {
  const key = toLocalDate(month)
  return useLiveQuery(async () => {
    const range = monthRange(month)
    const previousRange = previousComparableRange(month)
    const cashFlowMonths = Array.from({ length: CASH_FLOW_MONTHS }, (_, i) =>
      addMonths(month, i - (CASH_FLOW_MONTHS - 1)),
    )

    const [balance, period, previous, byCategory, recent, categories, daily, previousBalance, cashFlow] =
      await Promise.all([
        getBalance(),
        getTotalsForPeriod(range.start, range.end),
        getTotalsForPeriod(previousRange.start, previousRange.end),
        getTotalsByCategory(range.start, range.end),
        listRecentTransactions(6),
        // Includes deleted categories so older rows still show their name.
        db.categories.toArray(),
        getDailyBalances(range.start, range.end),
        getBalanceThrough(previousRange.end),
        Promise.all(
          cashFlowMonths.map(async (m) => {
            const r = monthRange(m)
            return { month: m, totals: await getTotalsForPeriod(r.start, r.end) }
          }),
        ),
      ])

    const spending = byCategory.filter((c) => c.direction === 'expense' && !isSavingsOrInvestment(c))

    return {
      range,
      previousRange,
      balance,
      // Balance at the end of the selected period, and at the end of the comparable one.
      balanceAtEnd: daily.length > 0 ? daily[daily.length - 1].balance : balance.balance,
      previousBalance,
      // True when there was any recorded activity before the comparison point.
      hasPreviousBalance: (await db.transactions.where('occurred_at').below(endOfDayIso(previousRange.end)).filter((t) => t.deleted_at === null).count()) > 0,
      daily,
      period,
      previous,
      spending,
      cashFlow,
      recent,
      categories: new Map(categories.map((c) => [c.id, c])),
    }
  }, [key])
}

function endOfDayIso(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d + 1).toISOString()
}

export type DashboardData = NonNullable<ReturnType<typeof useDashboardData>>
