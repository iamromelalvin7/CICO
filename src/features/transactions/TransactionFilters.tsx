import { ChevronDown, Search, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Field, inputClass } from '../../components/Field'
import { fieldProps } from '../../components/field-props'
import type { Category, Direction } from '../../db'
import {
  activeFilters,
  DATE_PRESETS,
  EMPTY_FILTERS,
  hasInvertedRange,
  type DatePreset,
  type Filters,
} from './filters'

interface TransactionFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  // Active categories for the picker; `categories` resolves names for the chips.
  activeCategories: Category[]
  categories: Map<string, Category>
}

export function TransactionFilters({
  filters,
  onChange,
  activeCategories,
  categories,
}: TransactionFiltersProps) {
  const uid = useId()
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value })
  const chips = activeFilters(filters, categories)
  const rangeError = hasInvertedRange(filters) ? 'The start date is after the end date.' : undefined
  const ids = {
    search: `${uid}-search`,
    date: `${uid}-date`,
    from: `${uid}-from`,
    to: `${uid}-to`,
    category: `${uid}-category`,
    direction: `${uid}-direction`,
  }

  return (
    <section aria-label="Filter transactions" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(15rem,1.2fr)]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Field id={ids.search} label="Search">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              />
              <input
                id={ids.search}
                type="search"
                autoComplete="off"
                placeholder="e.g. lunch, Transport"
                value={filters.search}
                onChange={(e) => set('search', e.target.value)}
                className={`${inputClass} pl-9 [&::-webkit-search-cancel-button]:appearance-none`}
              />
            </div>
          </Field>
        </div>

        <div>
          <SelectField
            id={ids.date}
            label="Date"
            value={filters.datePreset}
            onChange={(v) => set('datePreset', v as DatePreset)}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
        </div>

        <SelectField
          id={ids.category}
          label="Category"
          value={filters.categoryId}
          onChange={(v) => set('categoryId', v)}
        >
          <option value="">All categories</option>
          {activeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <fieldset className="col-span-2 flex flex-col sm:col-span-1">
          <legend className="mb-1.5 text-sm font-medium text-ink">Direction</legend>
          <div className="grid grid-cols-3 gap-1 rounded-sm bg-surface-muted p-1">
            {DIRECTIONS.map((d) => {
              const checked = filters.direction === d.value
              return (
                <label
                  key={d.value || 'all'}
                  className={`flex min-h-9 cursor-pointer items-center justify-center rounded-[8px] px-2 text-sm font-medium transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-primary ${
                    checked ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name={ids.direction}
                    value={d.value}
                    checked={checked}
                    onChange={() => set('direction', d.value)}
                    className="sr-only"
                  />
                  {d.label}
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>

      {filters.datePreset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field id={ids.from} label="From" error={rangeError}>
            <input
              {...fieldProps(ids.from, rangeError)}
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set('from', e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
          <Field id={ids.to} label="To">
            <input
              id={ids.to}
              aria-invalid={rangeError ? true : undefined}
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set('to', e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">Showing</span>
          <ul className="contents">
            {chips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() => onChange(chip.without)}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex min-h-8 max-w-64 items-center gap-1.5 rounded-sm border border-border bg-surface pr-2 pl-3 text-xs font-medium text-ink hover:bg-surface-muted"
                >
                  <span className="truncate">{chip.label}</span>
                  <X aria-hidden className="size-3.5 shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex min-h-8 items-center rounded-sm px-2 text-xs font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  )
}

const DIRECTIONS: Array<{ value: Direction | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
]

interface SelectFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

function SelectField({ id, label, value, onChange, children }: SelectFieldProps) {
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} cursor-pointer appearance-none truncate pr-9`}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </Field>
  )
}
