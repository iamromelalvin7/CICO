// The one calculation layer for every financial figure in the app. The dashboard and
// the chat functions both call these, so numbers always agree. Results use snake_case
// because they are also sent to the model as function results.
//
// Transfers (decided): money moved into Savings or Investments is recorded as an expense in
// that category, and money taken back out as income in it. These are transfers between the
// user's own pots, not earning or spending, so income and expense totals leave them out.
// Balance is the spendable money: every income minus every expense, transfers included
// (= income − expenses − net moved into savings and investments).

import { db } from './db'
import type { Category, Direction, Transaction } from './types'

// Fixed seed IDs (see db.ts), so these stay correct if the categories are renamed.
export const SAVINGS_CATEGORY_ID = 'cea4fe4b-9359-492f-a62b-fcb82b766afc'
export const INVESTMENTS_CATEGORY_ID = '89eb5e09-b849-4016-8892-83ec577c698b'

export interface PeriodTotals {
  start_date: string
  end_date: string
  // Earned and spent; both exclude transfers to and from savings and investments.
  income: number
  expense: number
  // income − expense for the period.
  net: number
  // Put in minus taken out over the period; negative when more came out.
  net_moved_to_savings: number
  net_moved_to_investments: number
  // How much the balance changed: net − both net amounts moved.
  balance_change: number
  // Every transaction in the period, transfers included.
  transaction_count: number
}

export interface CategoryTotal {
  category_id: string
  category: string
  color: string
  direction: Direction
  total: number
  transaction_count: number
}

export interface Balance {
  // All-time earned and spent, excluding transfers.
  income: number
  expense: number
  // Spendable money: income − expense − in_savings − in_investments.
  balance: number
  // All-time net moved in (put in minus taken out). Starts from zero when tracking began,
  // so it can be negative if money saved earlier was taken out.
  in_savings: number
  in_investments: number
  transaction_count: number
}

// Dates are local calendar days, "YYYY-MM-DD", inclusive at both ends.
export async function getTotalsForPeriod(start_date: string, end_date: string): Promise<PeriodTotals> {
  const rows = await transactionsBetween(start_date, end_date)
  const t = summarize(rows)
  return {
    start_date,
    end_date,
    income: t.income,
    expense: t.expense,
    net: t.net,
    net_moved_to_savings: t.savings,
    net_moved_to_investments: t.investments,
    balance_change: t.balance,
    transaction_count: t.count,
  }
}

// Sorted largest first.
export async function getTotalsByCategory(
  start_date: string,
  end_date: string,
  direction?: Direction,
): Promise<CategoryTotal[]> {
  const rows = (await transactionsBetween(start_date, end_date)).filter(
    (t) => !direction || t.direction === direction,
  )
  const categories = await categoryMap()
  const groups = new Map<string, { direction: Direction; cents: number; count: number; id: string }>()
  for (const t of rows) {
    const key = `${t.category_id}:${t.direction}`
    const g = groups.get(key) ?? { direction: t.direction, cents: 0, count: 0, id: t.category_id }
    g.cents += toCents(t.amount)
    g.count += 1
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({
      category_id: g.id,
      category: categories.get(g.id)?.name ?? 'Deleted category',
      color: categories.get(g.id)?.color_or_icon ?? '#60716C',
      direction: g.direction,
      total: fromCents(g.cents),
      transaction_count: g.count,
    }))
    .sort((a, b) => b.total - a.total)
}

export async function comparePeriods(
  period_a_start: string,
  period_a_end: string,
  period_b_start: string,
  period_b_end: string,
) {
  const [a, aCategories, b, bCategories] = await Promise.all([
    getTotalsForPeriod(period_a_start, period_a_end),
    getTotalsByCategory(period_a_start, period_a_end),
    getTotalsForPeriod(period_b_start, period_b_end),
    getTotalsByCategory(period_b_start, period_b_end),
  ])
  return {
    period_a: { ...a, by_category: aCategories },
    period_b: { ...b, by_category: bCategories },
  }
}

export interface LargestTransaction {
  id: string
  amount: number
  direction: Direction
  category: string
  description: string
  occurred_at: string
}

export async function listLargestTransactions(
  start_date: string,
  end_date: string,
  options: { direction?: Direction; category?: string; limit?: number } = {},
): Promise<LargestTransaction[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 5), 1), 20)
  const categories = await categoryMap()
  const wanted = options.category?.trim().toLowerCase()
  return (await transactionsBetween(start_date, end_date))
    .filter((t) => !options.direction || t.direction === options.direction)
    .filter((t) => !wanted || categories.get(t.category_id)?.name.toLowerCase() === wanted)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      amount: t.amount,
      direction: t.direction,
      category: categories.get(t.category_id)?.name ?? 'Deleted category',
      description: t.description,
      occurred_at: t.occurred_at,
    }))
}

// All-time balance across every active transaction.
export async function getBalance(): Promise<Balance> {
  const rows = (await db.transactions.toArray()).filter((t) => t.deleted_at === null)
  const t = summarize(rows)
  return {
    income: t.income,
    expense: t.expense,
    balance: t.balance,
    in_savings: t.savings,
    in_investments: t.investments,
    transaction_count: t.count,
  }
}

// All-time balance at the end of a local day (inclusive).
export async function getBalanceThrough(end_date: string): Promise<number> {
  const to = localDayStart(end_date)
  to.setDate(to.getDate() + 1)
  const rows = (await db.transactions.where('occurred_at').below(to.toISOString()).toArray()).filter(
    (t) => t.deleted_at === null,
  )
  return summarize(rows).balance
}

export interface DailyBalance {
  date: string
  balance: number
}

// The all-time balance at the end of each day in the range, for the balance trend.
export async function getDailyBalances(start_date: string, end_date: string): Promise<DailyBalance[]> {
  const from = localDayStart(start_date)
  const before = (await db.transactions.where('occurred_at').below(from.toISOString()).toArray()).filter(
    (t) => t.deleted_at === null,
  )
  let cents = toCents(summarize(before).balance)

  const byDay = new Map<string, number>()
  for (const t of await transactionsBetween(start_date, end_date)) {
    const key = localDateKey(new Date(t.occurred_at))
    const delta = t.direction === 'income' ? toCents(t.amount) : -toCents(t.amount)
    byDay.set(key, (byDay.get(key) ?? 0) + delta)
  }

  const out: DailyBalance[] = []
  const end = localDayStart(end_date)
  for (const d = new Date(from); d <= end; d.setDate(d.getDate() + 1)) {
    const key = localDateKey(d)
    cents += byDay.get(key) ?? 0
    out.push({ date: key, balance: fromCents(cents) })
  }
  return out
}

function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function listRecentTransactions(limit = 5): Promise<Transaction[]> {
  const rows: Transaction[] = []
  await db.transactions
    .orderBy('occurred_at')
    .reverse()
    .until(() => rows.length >= limit)
    .each((t) => {
      if (t.deleted_at === null) rows.push(t)
    })
  return rows
}

async function transactionsBetween(start_date: string, end_date: string): Promise<Transaction[]> {
  const from = localDayStart(start_date)
  const to = localDayStart(end_date)
  to.setDate(to.getDate() + 1)
  const rows = await db.transactions
    .where('occurred_at')
    .between(from.toISOString(), to.toISOString(), true, false)
    .toArray()
  return rows.filter((t) => t.deleted_at === null)
}

function localDayStart(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${date}"`)
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid date "${date}"`)
  return d
}

async function categoryMap(): Promise<Map<string, Category>> {
  // Includes deleted categories so older transactions still show a name.
  return new Map((await db.categories.toArray()).map((c) => [c.id, c]))
}

// Sum in integer cents so totals don't pick up floating-point drift.
function summarize(rows: Transaction[]) {
  let income = 0
  let expense = 0
  let savings = 0
  let investments = 0
  for (const t of rows) {
    const cents = toCents(t.amount)
    // Into a pot is an expense there; out of it is income.
    const moved = t.direction === 'expense' ? cents : -cents
    if (t.category_id === SAVINGS_CATEGORY_ID) savings += moved
    else if (t.category_id === INVESTMENTS_CATEGORY_ID) investments += moved
    else if (t.direction === 'income') income += cents
    else expense += cents
  }
  return {
    income: fromCents(income),
    expense: fromCents(expense),
    net: fromCents(income - expense),
    savings: fromCents(savings),
    investments: fromCents(investments),
    balance: fromCents(income - expense - savings - investments),
    count: rows.length,
  }
}

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}
