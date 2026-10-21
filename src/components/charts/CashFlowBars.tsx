export interface CashFlowMonth {
  key: string
  label: string
  // Full name for the screen-reader table, e.g. "October 2026".
  longLabel: string
  income: number
  expense: number
  current: boolean
}

interface CashFlowBarsProps {
  months: CashFlowMonth[]
  formatValue: (value: number) => string
}

const HEIGHT = 160

// Income and expense side by side per month. A visually hidden table carries the values.
export function CashFlowBars({ months, formatValue }: CashFlowBarsProps) {
  const max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1)
  const h = (v: number) => (v > 0 ? Math.max((v / max) * HEIGHT, 3) : 0)

  return (
    <div>
      <div aria-hidden className="flex items-end justify-between gap-2 sm:gap-4" style={{ height: HEIGHT + 28 }}>
        {months.map((m) => (
          <div key={m.key} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-end justify-center gap-1" style={{ height: HEIGHT }}>
              <div
                title={`${m.longLabel} income: ${formatValue(m.income)}`}
                className="w-full max-w-5 rounded-t-[5px] bg-accent transition-opacity duration-200 group-hover:opacity-80"
                style={{ height: h(m.income) }}
              />
              <div
                title={`${m.longLabel} expenses: ${formatValue(m.expense)}`}
                className="w-full max-w-5 rounded-t-[5px] bg-expense transition-opacity duration-200 group-hover:opacity-80"
                style={{ height: h(m.expense) }}
              />
            </div>
            <span className={`text-xs ${m.current ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{m.label}</span>
          </div>
        ))}
      </div>
      {/* Tables ignore sr-only's 1px width, so the wrapper hides it. */}
      <div className="sr-only">
        <table>
          <caption>Income and expenses by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.longLabel}</th>
                <td>{formatValue(m.income)}</td>
                <td>{formatValue(m.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
