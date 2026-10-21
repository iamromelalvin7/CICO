const MONEY = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Always "GH₵ 1,250.00" across the app.
export function formatMoney(amount: number): string {
  return `GH₵ ${MONEY.format(amount)}`
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
