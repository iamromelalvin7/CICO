import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { Direction } from '../../db'

const OPTIONS: Array<{ value: Direction; label: string; icon: typeof ArrowUpRight; selected: string }> = [
  {
    value: 'expense',
    label: 'Expense',
    icon: ArrowUpRight,
    selected: 'border-expense/50 bg-expense-soft text-expense-text',
  },
  {
    value: 'income',
    label: 'Income',
    icon: ArrowDownLeft,
    selected: 'border-positive/40 bg-positive-soft text-positive',
  },
]

interface DirectionToggleProps {
  name: string
  value: Direction
  onChange: (value: Direction) => void
}

export function DirectionToggle({ name, value, onChange }: DirectionToggleProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">Direction</legend>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value: option, label, icon: Icon, selected }) => {
          const checked = value === option
          return (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border text-sm font-medium transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
                checked ? selected : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
