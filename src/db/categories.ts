import { LIMITS } from '../../shared/ai-contract'
import { db } from './db'
import { CategoryInUseError, NotFoundError, ValidationError } from './errors'
import type { Category } from './types'

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/

export interface CategoryInput {
  name: string
  color_or_icon: string
}

// Active categories (not deleted), alphabetical.
export async function listCategories(): Promise<Category[]> {
  const rows = await db.categories.orderBy('name').toArray()
  return rows.filter((c) => c.deleted_at === null)
}

export async function getCategory(id: string): Promise<Category | undefined> {
  const row = await db.categories.get(id)
  return row && row.deleted_at === null ? row : undefined
}

export async function addCategory(input: CategoryInput): Promise<Category> {
  const name = validName(input.name)
  const color = validColour(input.color_or_icon)

  return db.transaction('rw', db.categories, async () => {
    await assertNameFree(name)
    const now = new Date().toISOString()
    const category: Category = {
      id: crypto.randomUUID(),
      name,
      color_or_icon: color,
      is_default: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced: false,
    }
    await db.categories.add(category)
    return category
  })
}

export async function updateCategory(
  id: string,
  changes: Partial<CategoryInput>,
): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const current = await requireCategory(id)
    const name = changes.name === undefined ? current.name : validName(changes.name)
    const color =
      changes.color_or_icon === undefined ? current.color_or_icon : validColour(changes.color_or_icon)
    if (name.toLowerCase() !== current.name.toLowerCase()) await assertNameFree(name)

    const updated: Category = {
      ...current,
      name,
      color_or_icon: color,
      updated_at: new Date().toISOString(),
      synced: false,
    }
    await db.categories.put(updated)
    return updated
  })
}

// Number of active transactions in a category, for the delete warning.
export async function countTransactionsInCategory(id: string): Promise<number> {
  return db.transactions
    .where('category_id')
    .equals(id)
    .filter((t) => t.deleted_at === null)
    .count()
}

// Soft-deletes a category. If it still has transactions, `reassignTo` must name
// another active category; they are moved there so none are orphaned.
export async function deleteCategory(id: string, reassignTo?: string): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const category = await requireCategory(id)
    const linked = await db.transactions
      .where('category_id')
      .equals(id)
      .filter((t) => t.deleted_at === null)
      .toArray()

    const now = new Date().toISOString()
    if (linked.length > 0) {
      if (!reassignTo) throw new CategoryInUseError(linked.length)
      if (reassignTo === id) {
        throw new ValidationError('reassignTo', 'Choose a different category to move transactions to.')
      }
      await requireCategory(reassignTo)
      await db.transactions.bulkPut(
        linked.map((t) => ({ ...t, category_id: reassignTo, updated_at: now, synced: false })),
      )
    }

    await db.categories.put({ ...category, deleted_at: now, updated_at: now, synced: false })
  })
}

async function requireCategory(id: string): Promise<Category> {
  const category = await getCategory(id)
  if (!category) throw new NotFoundError('That category no longer exists.')
  return category
}

async function assertNameFree(name: string): Promise<void> {
  const lower = name.toLowerCase()
  const clash = await db.categories
    .filter((c) => c.deleted_at === null && c.name.toLowerCase() === lower)
    .first()
  if (clash) throw new ValidationError('name', `A category called "${clash.name}" already exists.`)
}

function validName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw new ValidationError('name', 'Enter a category name.')
  if (name.length > LIMITS.categoryNameChars) {
    throw new ValidationError('name', `Keep it under ${LIMITS.categoryNameChars} characters.`)
  }
  return name
}

function validColour(value: string): string {
  if (!HEX_COLOUR.test(value)) throw new ValidationError('color_or_icon', 'Choose a colour.')
  return value.toUpperCase()
}
