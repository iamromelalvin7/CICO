// Runs the query functions the model asks for against local data, through the same query layer
// as the dashboard. Arguments come from the model, so they are validated like user input;
// bad arguments come back as an { error } result the model can correct.

import type { ChatFunctionCall, ChatFunctionResult } from '../../../shared/ai-contract'
import {
  comparePeriods,
  getBalance,
  getTotalsByCategory,
  getTotalsForPeriod,
  listLargestTransactions,
  type Direction,
} from '../../db'

// A period the answer drew on; `null` dates mean all time.
export interface SourceRange {
  start: string | null
  end: string | null
}

export async function runChatFunction(
  call: ChatFunctionCall,
  sources: SourceRange[],
): Promise<ChatFunctionResult> {
  try {
    return { name: call.name, result: await dispatch(call, sources) }
  } catch (err) {
    if (err instanceof ArgumentError) return { name: call.name, result: { error: err.message } }
    console.error(`Chat function ${call.name} failed`, err)
    return { name: call.name, result: { error: 'Could not read the data on this device.' } }
  }
}

async function dispatch(call: ChatFunctionCall, sources: SourceRange[]): Promise<unknown> {
  const a = call.args
  switch (call.name) {
    case 'get_totals_for_period': {
      const [start, end] = range(a.start_date, a.end_date)
      sources.push({ start, end })
      return getTotalsForPeriod(start, end)
    }
    case 'get_totals_by_category': {
      const [start, end] = range(a.start_date, a.end_date)
      sources.push({ start, end })
      return {
        start_date: start,
        end_date: end,
        categories: await getTotalsByCategory(start, end, direction(a.direction)),
      }
    }
    case 'compare_periods': {
      const [aStart, aEnd] = range(a.period_a_start, a.period_a_end)
      const [bStart, bEnd] = range(a.period_b_start, a.period_b_end)
      sources.push({ start: aStart, end: aEnd }, { start: bStart, end: bEnd })
      return comparePeriods(aStart, aEnd, bStart, bEnd)
    }
    case 'list_largest_transactions': {
      const [start, end] = range(a.start_date, a.end_date)
      sources.push({ start, end })
      const limit = a.limit === undefined ? undefined : Number(a.limit)
      if (limit !== undefined && !Number.isInteger(limit)) {
        throw new ArgumentError('limit must be a whole number.')
      }
      const category = a.category === undefined ? undefined : String(a.category)
      return {
        start_date: start,
        end_date: end,
        transactions: await listLargestTransactions(start, end, {
          direction: direction(a.direction),
          category,
          limit,
        }),
      }
    }
    case 'get_balance':
      sources.push({ start: null, end: null })
      return getBalance()
  }
}

class ArgumentError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function range(start: unknown, end: unknown): [string, string] {
  const s = date(start, 'start date')
  const e = date(end, 'end date')
  if (s > e) throw new ArgumentError('The start date is after the end date.')
  return [s, e]
}

function date(value: unknown, label: string): string {
  if (typeof value !== 'string' || !DATE.test(value)) {
    throw new ArgumentError(`The ${label} must be YYYY-MM-DD.`)
  }
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    throw new ArgumentError(`The ${label} is not a real date.`)
  }
  return value
}

function direction(value: unknown): Direction | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (value === 'income' || value === 'expense') return value
  throw new ArgumentError('direction must be "income" or "expense".')
}
