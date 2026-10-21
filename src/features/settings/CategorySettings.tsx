import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { LIMITS } from '../../../shared/ai-contract'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Dialog } from '../../components/Dialog'
import { Field, inputClass } from '../../components/Field'
import { fieldProps } from '../../components/field-props'
import { InlineNotice } from '../../components/InlineNotice'
import { useToast } from '../../components/toast-context'
import {
  addCategory,
  countTransactionsInCategory,
  deleteCategory,
  INVESTMENTS_CATEGORY_ID,
  listCategories,
  SAVINGS_CATEGORY_ID,
  updateCategory,
  ValidationError,
  type Category,
} from '../../db'

// Calm, distinguishable colours that sit with the CICO palette.
const COLOURS = [
  '#176B5B', '#0F4C3A', '#237B58', '#10B981', '#4F8A8B', '#2F6F9F',
  '#8171BD', '#B5658F', '#C75C52', '#B7792B', '#8A6D3B', '#60716C',
]

// Savings and Investments drive the dashboard's savings and investment totals.
const PROTECTED = new Set([SAVINGS_CATEGORY_ID, INVESTMENTS_CATEGORY_ID])

type Editing = { kind: 'new' } | { kind: 'edit'; category: Category } | null

export function CategorySettings() {
  const rows = useLiveQuery(async () => {
    const categories = await listCategories()
    return Promise.all(categories.map(async (c) => ({ category: c, count: await countTransactionsInCategory(c.id) })))
  })
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {rows ? `${rows.length} categories` : 'Loading categories…'}
        </p>
        <Button variant="secondary" onClick={() => setEditing({ kind: 'new' })}>
          <Plus aria-hidden className="size-4" />
          Add category
        </Button>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {rows?.map(({ category: c, count }) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <CategoryIcon id={c.id} name={c.name} color={c.color_or_icon} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{c.name}</p>
              <p className="text-xs text-ink-muted">
                {count} transaction{count === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing({ kind: 'edit', category: c })}
              aria-label={`Edit ${c.name}`}
              className="flex size-10 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
            >
              <Pencil aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={editing !== null}
        title={editing?.kind === 'edit' ? 'Edit category' : 'Add category'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <CategoryForm
            category={editing.kind === 'edit' ? editing.category : null}
            others={rows?.map((r) => r.category).filter((c) => editing.kind !== 'edit' || c.id !== editing.category.id) ?? []}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  )
}

interface CategoryFormProps {
  category: Category | null
  // Other active categories, for moving transactions on delete.
  others: Category[]
  onDone: () => void
}

function CategoryForm({ category, others, onDone }: CategoryFormProps) {
  const uid = useId()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [colour, setColour] = useState(category?.color_or_icon ?? COLOURS[0])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const palette = COLOURS.includes(colour.toUpperCase()) ? COLOURS : [...COLOURS, colour.toUpperCase()]

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (category) await updateCategory(category.id, { name, color_or_icon: colour })
      else await addCategory({ name, color_or_icon: colour })
      toast(category ? 'Category updated' : 'Category added', name.trim())
      onDone()
    } catch (err) {
      if (err instanceof ValidationError) setError(err.message)
      else {
        console.error(err)
        setError("Couldn't save on this device. Try again.")
      }
      setSaving(false)
    }
  }

  if (deleting && category) {
    return <DeleteCategory category={category} others={others} onBack={() => setDeleting(false)} onDone={onDone} />
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-md bg-surface-muted p-3">
        <CategoryIcon id={category?.id ?? ''} name={name} color={colour} size="lg" />
        <p className="text-sm text-ink-muted">
          {name.trim() || 'Category name'} <span className="sr-only">preview</span>
        </p>
      </div>
      <Field id={`${uid}-name`} label="Name" error={error ?? undefined}>
        <input
          {...fieldProps(`${uid}-name`, error ?? undefined)}
          autoFocus
          type="text"
          autoComplete="off"
          maxLength={LIMITS.categoryNameChars}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rent"
          className={inputClass}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {palette.map((c) => {
            const checked = colour.toUpperCase() === c
            return (
              <label
                key={c}
                className="relative flex size-11 cursor-pointer items-center justify-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
              >
                <input
                  type="radio"
                  name={`${uid}-colour`}
                  value={c}
                  checked={checked}
                  onChange={() => setColour(c)}
                  className="sr-only"
                  aria-label={`Colour ${c}`}
                />
                <span
                  aria-hidden
                  className={`flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface ${checked ? 'ring-2 ring-ink' : ''}`}
                  style={{ backgroundColor: c }}
                >
                  {checked && <Check className="size-4 text-white" />}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {category && !PROTECTED.has(category.id) && (
          <div className="flex flex-col sm:mr-auto">
            <Button variant="danger-ghost" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden className="size-4" />
              Delete
            </Button>
          </div>
        )}
        <Button variant="secondary" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} className="sm:min-w-36">
          {category ? 'Save changes' : 'Add category'}
        </Button>
      </div>
      {category && PROTECTED.has(category.id) && (
        <p className="text-xs text-ink-muted">
          {category.name} can be renamed but not deleted: the dashboard's savings and investment totals rely on it.
        </p>
      )}
    </form>
  )
}

function DeleteCategory({
  category,
  others,
  onBack,
  onDone,
}: {
  category: Category
  others: Category[]
  onBack: () => void
  onDone: () => void
}) {
  const uid = useId()
  const toast = useToast()
  const count = useLiveQuery(() => countTransactionsInCategory(category.id), [category.id])
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setError(null)
    if (count && !target) {
      setError('Choose where to move its transactions.')
      return
    }
    setBusy(true)
    try {
      await deleteCategory(category.id, count ? target : undefined)
      toast('Category deleted', count ? `${count} transaction${count === 1 ? '' : 's'} moved` : category.name)
      onDone()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Couldn't delete on this device. Try again.")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-base font-semibold text-ink">Delete “{category.name}”?</p>
        <p className="mt-1.5 text-sm text-ink-muted">
          {count === undefined
            ? 'Checking its transactions…'
            : count === 0
              ? 'It has no transactions, so nothing else changes.'
              : `It has ${count} transaction${count === 1 ? '' : 's'}. Choose a category to move ${count === 1 ? 'it' : 'them'} to, so nothing is lost.`}
        </p>
      </div>
      {!!count && (
        <Field id={`${uid}-target`} label="Move transactions to" error={error ?? undefined}>
          <select
            {...fieldProps(`${uid}-target`, error ?? undefined)}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="" disabled>
              Select category
            </option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {error && !count && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Keep category
        </Button>
        <Button variant="danger" onClick={confirm} loading={busy} disabled={count === undefined}>
          Delete category
        </Button>
      </div>
    </div>
  )
}
