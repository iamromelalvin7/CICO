// Calendar helpers. "Month" values are the first day of that month, local time.

const pad = (n: number) => String(n).padStart(2, '0')

// Local "YYYY-MM-DD", the date format used by the query layer.
export function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1)
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function daysInMonth(month: Date): number {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
}

export interface DateRange {
  start: string
  end: string
}

// The whole month, or up to today if it is the current month.
export function monthRange(month: Date, today = new Date()): DateRange {
  const lastDay = isSameMonth(month, today) ? today.getDate() : daysInMonth(month)
  return {
    start: toLocalDate(month),
    end: toLocalDate(new Date(month.getFullYear(), month.getMonth(), lastDay)),
  }
}

// The matching stretch of the previous month, for a fair comparison:
// Oct 1–21 compares with Sep 1–21; a full month compares with the full previous month.
export function previousComparableRange(month: Date, today = new Date()): DateRange {
  const prev = addMonths(month, -1)
  const fullPrev = daysInMonth(prev)
  const lastDay = isSameMonth(month, today) ? Math.min(today.getDate(), fullPrev) : fullPrev
  return {
    start: toLocalDate(prev),
    end: toLocalDate(new Date(prev.getFullYear(), prev.getMonth(), lastDay)),
  }
}

const MONTH_DAY = new Intl.DateTimeFormat('en-GH', { month: 'short', day: 'numeric' })

// "Oct 1–21" or "Sep 1–30".
export function formatRange(range: DateRange): string {
  const [sy, sm, sd] = range.start.split('-').map(Number)
  const [, , ed] = range.end.split('-').map(Number)
  const start = MONTH_DAY.formatToParts(new Date(sy, sm - 1, sd))
  const month = start.find((p) => p.type === 'month')?.value ?? ''
  return sd === ed ? `${month} ${sd}` : `${month} ${sd}–${ed}`
}

export function monthName(month: Date, withYear: boolean): string {
  return month.toLocaleDateString('en-GH', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
}
