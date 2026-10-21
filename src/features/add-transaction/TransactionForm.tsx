import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Field, inputClass } from '../../components/Field'
import { fieldProps } from '../../components/field-props'
import { InlineNotice } from '../../components/InlineNotice'
import { useToast } from '../../components/toast-context'
import { ValidationError, type Category } from '../../db'
import { LIMITS } from '../../../shared/ai-contract'
import { formatMoney, parseAmountInput } from '../../lib/format'
import { CategoryPicker } from './CategoryPicker'
import { DirectionToggle } from './DirectionToggle'
import type { FormValues } from './form-values'
import { saveTransaction } from './save'

type FieldName = 'amount' | 'category' | 'description' | 'occurredAt'
type Errors = Partial<Record<FieldName, string>>

const DB_FIELD: Record<string, FieldName> = {
  amount: 'amount',
  category_id: 'category',
  description: 'description',
  occurred_at: 'occurredAt',
}

interface TransactionFormProps {
  initial: FormValues
  categories: Category[] | undefined
  // Category name proposed by the parser, offered in the picker as a new category.
  proposedCategory?: string
  // Called after a successful local save.
  onSaved: () => void
  onCancel?: () => void
  cancelLabel?: string
  // Focus the amount on mount, for entering several transactions in a row.
  autoFocus?: boolean
}

// Shared by manual entry and by the review step after parsing. Nothing is saved until submit.
export function TransactionForm({
  initial,
  categories,
  proposedCategory,
  onSaved,
  onCancel,
  cancelLabel = 'Cancel',
  autoFocus = false,
}: TransactionFormProps) {
  const uid = useId()
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    if (key !== 'direction') setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): Errors {
    const next: Errors = {}
    const amount = parseAmountInput(values.amount)
    if (!values.amount.trim()) next.amount = 'Enter an amount.'
    else if (Number.isNaN(amount) || amount <= 0) {
      next.amount = 'Enter a number greater than zero, with up to 2 decimals.'
    }
    if (!values.category) next.category = 'Choose a category.'
    if (values.description.trim().length > LIMITS.descriptionChars) {
      next.description = `Keep it under ${LIMITS.descriptionChars} characters.`
    }
    if (!values.occurredAt || Number.isNaN(new Date(values.occurredAt).getTime())) {
      next.occurredAt = 'Enter a valid date and time.'
    }
    return next
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0 || !values.category) return

    setSaving(true)
    try {
      const saved = await saveTransaction({
        amount: parseAmountInput(values.amount),
        direction: values.direction,
        category: values.category,
        description: values.description,
        occurredAt: new Date(values.occurredAt),
      })
      const categoryName =
        values.category.kind === 'new'
          ? values.category.name
          : categories?.find((c) => c.id === saved.category_id)?.name
      toast(
        'Saved on this device',
        [formatMoney(saved.amount), categoryName, saved.description].filter(Boolean).join(' · '),
      )
      onSaved()
    } catch (err) {
      if (err instanceof ValidationError && DB_FIELD[err.field]) {
        setErrors({ [DB_FIELD[err.field]]: err.message })
      } else {
        console.error(err)
        setSaveError("Couldn't save on this device. Your entry is still here; try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  const ids = {
    amount: `${uid}-amount`,
    category: `${uid}-category`,
    description: `${uid}-description`,
    occurredAt: `${uid}-occurred`,
  }
  const descriptionLength = values.description.trim().length
  const categoryHint =
    values.category?.kind === 'new'
      ? `"${values.category.name}" will be added as a new category.`
      : undefined

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id={ids.amount} label="Amount" error={errors.amount}>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-ink-muted"
          >
            GH₵
          </span>
          <input
            autoFocus={autoFocus}
            {...fieldProps(ids.amount, errors.amount)}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
            className={`${inputClass} pl-12 text-lg font-semibold tabular-nums`}
          />
        </div>
      </Field>

      <DirectionToggle
        name={`${uid}-direction`}
        value={values.direction}
        onChange={(d) => set('direction', d)}
      />

      <Field
        id={ids.category}
        label="Category"
        error={errors.category}
        hint={categoryHint}
      >
        <CategoryPicker
          id={ids.category}
          categories={categories}
          value={values.category}
          proposedName={proposedCategory}
          error={errors.category}
          hint={categoryHint}
          onChange={(c) => set('category', c)}
        />
      </Field>

      <Field
        id={ids.description}
        label="Description (optional)"
        error={errors.description}
        aside={
          descriptionLength > LIMITS.descriptionChars - 40 && (
            <span className="text-xs text-ink-muted tabular-nums">
              {descriptionLength}/{LIMITS.descriptionChars}
            </span>
          )
        }
      >
        <input
          {...fieldProps(ids.description, errors.description)}
          type="text"
          autoComplete="off"
          placeholder="e.g. Lunch with Ama"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field id={ids.occurredAt} label="Date and time" error={errors.occurredAt}>
        <input
          {...fieldProps(ids.occurredAt, errors.occurredAt)}
          type="datetime-local"
          value={values.occurredAt}
          onChange={(e) => set('occurredAt', e.target.value)}
          className={`${inputClass} tabular-nums`}
        />
      </Field>

      {saveError && <InlineNotice tone="error">{saveError}</InlineNotice>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" loading={saving} className="sm:min-w-44">
          Save transaction
        </Button>
      </div>
    </form>
  )
}
