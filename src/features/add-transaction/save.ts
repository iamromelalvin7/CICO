import {
  addCategory,
  addTransaction,
  db,
  listCategories,
  updateTransaction,
  ValidationError,
  type Direction,
  type Transaction,
} from '../../db'

// Colour for categories created from a parsed entry; editable later in category settings.
const NEW_CATEGORY_COLOUR = '#60716C'

export type CategoryChoice = { kind: 'existing'; id: string } | { kind: 'new'; name: string }

export interface TransactionDraft {
  amount: number
  direction: Direction
  category: CategoryChoice
  description: string
  occurredAt: Date
}

// Saves locally in one atomic step: creates the proposed category if needed, then the transaction.
export async function saveTransaction(draft: TransactionDraft): Promise<Transaction> {
  return db.transaction('rw', db.categories, db.transactions, async () => {
    return addTransaction({
      amount: draft.amount,
      direction: draft.direction,
      category_id: await resolveCategory(draft.category),
      description: draft.description,
      occurred_at: draft.occurredAt,
    })
  })
}

// Same as saveTransaction, for an existing transaction. Leave `occurredAt` out to keep the
// stored time exactly (the form only edits to the minute).
export async function updateSavedTransaction(
  id: string,
  draft: Omit<TransactionDraft, 'occurredAt'> & { occurredAt?: Date },
): Promise<Transaction> {
  return db.transaction('rw', db.categories, db.transactions, async () => {
    return updateTransaction(id, {
      amount: draft.amount,
      direction: draft.direction,
      category_id: await resolveCategory(draft.category),
      description: draft.description,
      occurred_at: draft.occurredAt,
    })
  })
}

async function resolveCategory(choice: CategoryChoice): Promise<string> {
  return choice.kind === 'existing' ? choice.id : resolveNewCategory(choice.name)
}

// If a category with this name already exists (any case), reuse it instead of failing.
async function resolveNewCategory(name: string): Promise<string> {
  const lower = name.trim().toLowerCase()
  const existing = (await listCategories()).find((c) => c.name.toLowerCase() === lower)
  if (existing) return existing.id
  try {
    return (await addCategory({ name, color_or_icon: NEW_CATEGORY_COLOUR })).id
  } catch (err) {
    if (err instanceof ValidationError) throw new ValidationError('category_id', err.message)
    throw err
  }
}
