const MONEY = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Always "GH₵ 1,250.00" across the app; negatives as "−GH₵ 50.00".
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "−" : ""
  return `${sign}GH₵ ${MONEY.format(Math.abs(amount))}`
}

// Local "YYYY-MM-DDTHH:mm", the format used by <input type="datetime-local"> and the API clock.
export function toLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// Accepts "2000", "2,000", "45.5". Returns NaN for anything else, including more than 2 decimals.
export function parseAmountInput(value: string): number {
  const cleaned = value.replace(/[\s,]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}

// "+GH₵ 2,000.00" for income, "−GH₵ 45.00" (true minus sign) for expenses.
export function formatSignedMoney(amount: number, direction: 'income' | 'expense'): string {
  return `${direction === 'income' ? '+' : '−'}${formatMoney(amount)}`
}

const DAY_TIME = new Intl.DateTimeFormat('en-GH', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})
const DAY_TIME_YEAR = new Intl.DateTimeFormat('en-GH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

// "21 Oct, 9:41 pm"; adds the year when it isn't the current one.
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return date.getFullYear() === new Date().getFullYear()
    ? DAY_TIME.format(date)
    : DAY_TIME_YEAR.format(date)
}
