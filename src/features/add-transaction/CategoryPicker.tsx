import { ChevronDown } from 'lucide-react'
import type { Category } from '../../db'
import { inputClass } from '../../components/Field'
import { fieldProps } from '../../components/field-props'
import type { CategoryChoice } from './save'

const NEW_VALUE = '__new__'

interface CategoryPickerProps {
  id: string
  categories: Category[] | undefined
  value: CategoryChoice | null
  // A category name proposed by the parser, offered as a "new" option.
  proposedName?: string
  error?: string
  hint?: string
  onChange: (value: CategoryChoice) => void
}

export function CategoryPicker({
  id,
  categories,
  value,
  proposedName,
  error,
  hint,
  onChange,
}: CategoryPickerProps) {
  const loading = categories === undefined
  const selectValue = !value ? '' : value.kind === 'new' ? NEW_VALUE : value.id
  const dot =
    value?.kind === 'existing' ? categories?.find((c) => c.id === value.id)?.color_or_icon : undefined

  return (
    <div className="relative">
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 left-3.5 size-2.5 -translate-y-1/2 rounded-full ${
          dot ? '' : 'border border-dashed border-ink-muted/60'
        }`}
        style={dot ? { backgroundColor: dot } : undefined}
      />
      <select
        {...fieldProps(id, error, hint)}
        value={selectValue}
        disabled={loading}
        onChange={(e) => {
          const next = e.target.value
          if (next === NEW_VALUE && proposedName) onChange({ kind: 'new', name: proposedName })
          else if (next) onChange({ kind: 'existing', id: next })
        }}
        className={`${inputClass} cursor-pointer appearance-none pr-10 pl-9`}
      >
        <option value="" disabled>
          {loading ? 'Loading categories…' : 'Select category'}
        </option>
        {proposedName && <option value={NEW_VALUE}>{proposedName} (new)</option>}
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}
