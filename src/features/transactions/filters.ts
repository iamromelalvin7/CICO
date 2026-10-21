import type { Category, Direction, Transaction } from '../../db'
import {
  addMonths,
  formatLocalDate,
  fullMonthRange,
  monthName,
  startOfMonth,
  toLocalDate,
} from '../../lib/dates'

export type DatePreset = 'all' | 'this-month' | 'last-month' | 'custom'

export interface Filters {
  search: string
  datePreset: DatePreset
  // Local "YYYY-MM-DD", inclusive; used only with the custom preset. Empty means open-ended.
  from: string
  to: string
  categoryId: string
  // Empty means both directions.
  direction: Direction | ''
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  datePreset: 'all',
  from: '',
  to: '',
  categoryId: '',
  direction: '',
}

export const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
]

interface Bounds {
  start: string | null
  end: string | null
}

export function dateBounds(filters: Filters, today = new Date()): Bounds {
  switch (filters.datePreset) {
    case 'this-month':
    case 'last-month': {
      const month = addMonths(startOfMonth(today), filters.datePreset === 'this-month' ? 0 : -1)
      const range = fullMonthRange(month)
      return { start: range.start, end: range.end }
    }
    case 'custom':
      return { start: filters.from || null, end: filters.to || null }
    default:
      return { start: null, end: null }
  }
}

export function hasInvertedRange(filters: Filters): boolean {
  return filters.datePreset === 'custom' && !!filters.from && !!filters.to && filters.from > filters.to
}

// Keeps the input order (newest first). Search matches description or category name.
export function applyFilters(
  rows: Transaction[],
  categories: Map<string, Category>,
  filters: Filters,
): Transaction[] {
  const { start, end } = dateBounds(filters)
  const query = filters.search.trim().toLowerCase()
  return rows.filter((t) => {
    if (filters.direction && t.direction !== filters.direction) return false
    if (filters.categoryId && t.category_id !== filters.categoryId) return false
    if (start || end) {
      const day = toLocalDate(new Date(t.occurred_at))
      if (start && day < start) return false
      if (end && day > end) return false
    }
    if (query) {
      const category = categories.get(t.category_id)?.name ?? ''
      if (!t.description.toLowerCase().includes(query) && !category.toLowerCase().includes(query)) {
        return false
      }
    }
    return true
  })
}

export interface ActiveFilter {
  key: string
  label: string
  // Filters with this one removed.
  without: Filters
}

// The filters currently narrowing the list, as removable chips.
export function activeFilters(
  filters: Filters,
  categories: Map<string, Category>,
  today = new Date(),
): ActiveFilter[] {
  const chips: ActiveFilter[] = []
  const search = filters.search.trim()
  if (search) {
    chips.push({ key: 'search', label: `“${search}”`, without: { ...filters, search: '' } })
  }

  const dateLabel = describeDates(filters, today)
  if (dateLabel) {
    chips.push({
      key: 'date',
      label: dateLabel,
      without: { ...filters, datePreset: 'all', from: '', to: '' },
    })
  }

  if (filters.categoryId) {
    chips.push({
      key: 'category',
      label: categories.get(filters.categoryId)?.name ?? 'Deleted category',
      without: { ...filters, categoryId: '' },
    })
  }

  if (filters.direction) {
    chips.push({
      key: 'direction',
      label: filters.direction === 'income' ? 'Income only' : 'Expenses only',
      without: { ...filters, direction: '' },
    })
  }
  return chips
}

function describeDates(filters: Filters, today: Date): string | null {
  switch (filters.datePreset) {
    case 'this-month':
    case 'last-month': {
      const month = addMonths(startOfMonth(today), filters.datePreset === 'this-month' ? 0 : -1)
      return monthName(month, true)
    }
    case 'custom':
      if (filters.from && filters.to) {
        return `${formatLocalDate(filters.from)} – ${formatLocalDate(filters.to)}`
      }
      if (filters.from) return `From ${formatLocalDate(filters.from)}`
      if (filters.to) return `Until ${formatLocalDate(filters.to)}`
      return null
    default:
      return null
  }
}
