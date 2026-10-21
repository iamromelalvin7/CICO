import { LIMITS } from '../../shared/ai-contract'
import { getCategory } from './categories'
import { db } from './db'
import { NotFoundError, ValidationError } from './errors'
import type { Direction, Transaction } from './types'

const MAX_AMOUNT = 1e12

export interface TransactionInput {
  amount: number
  direction: Direction
  category_id: string
  description?: string
  // Any value Date can parse; defaults to now on create.
  occurred_at?: string | Date
}

// Active transactions, newest first by when they happened.
export async function listTransactions(): Promise<Transaction[]> {
  const rows = await db.transactions.orderBy('occurred_at').reverse().toArray()
  return rows.filter((t) => t.deleted_at === null)
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const row = await db.transactions.get(id)
  return row && row.deleted_at === null ? row : undefined
}

// Saves locally and returns immediately; sync pushes it to Supabase later.
export async function addTransaction(input: TransactionInput): Promise<Transaction> {
  const fields = {
    amount: validAmount(input.amount),
    direction: validDirection(input.direction),
    description: validDescription(input.description ?? ''),
    occurred_at: validOccurredAt(input.occurred_at ?? new Date()),
  }

  return db.transaction('rw', db.categories, db.transactions, async () => {
    const category_id = await validCategoryId(input.category_id)
    const now = new Date().toISOString()
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      ...fields,
      category_id,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced: false,
    }
    await db.transactions.add(transaction)
    return transaction
  })
}

export async function updateTransaction(
  id: string,
  changes: Partial<TransactionInput>,
): Promise<Transaction> {
  return db.transaction('rw', db.categories, db.transactions, async () => {
    const current = await requireTransaction(id)
    const updated: Transaction = {
      ...current,
      amount: changes.amount === undefined ? current.amount : validAmount(changes.amount),
      direction:
        changes.direction === undefined ? current.direction : validDirection(changes.direction),
      category_id:
        changes.category_id === undefined
          ? current.category_id
          : await validCategoryId(changes.category_id),
      description:
        changes.description === undefined
          ? current.description
          : validDescription(changes.description),
      occurred_at:
        changes.occurred_at === undefined
          ? current.occurred_at
          : validOccurredAt(changes.occurred_at),
      updated_at: new Date().toISOString(),
      synced: false,
    }
    await db.transactions.put(updated)
    return updated
  })
}

// Soft delete: the row stays, marked deleted, so sync can propagate the delete.
export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    const current = await requireTransaction(id)
    const now = new Date().toISOString()
    await db.transactions.put({ ...current, deleted_at: now, updated_at: now, synced: false })
  })
}

async function requireTransaction(id: string): Promise<Transaction> {
  const transaction = await getTransaction(id)
  if (!transaction) throw new NotFoundError('That transaction no longer exists.')
  return transaction
}

function validAmount(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError('amount', 'Enter an amount greater than zero.')
  }
  if (value > MAX_AMOUNT) throw new ValidationError('amount', 'That amount is too large.')
  const rounded = Math.round(value * 100) / 100
  if (rounded <= 0) throw new ValidationError('amount', 'Enter an amount greater than zero.')
  return rounded
}

function validDirection(value: Direction): Direction {
  if (value !== 'income' && value !== 'expense') {
    throw new ValidationError('direction', 'Choose income or expense.')
  }
  return value
}

function validDescription(value: string): string {
  const description = value.trim()
  if (description.length > LIMITS.descriptionChars) {
    throw new ValidationError(
      'description',
      `Keep it under ${LIMITS.descriptionChars} characters.`,
    )
  }
  return description
}

function validOccurredAt(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('occurred_at', 'Enter a valid date and time.')
  }
  return date.toISOString()
}

async function validCategoryId(id: string): Promise<string> {
  if (!(await getCategory(id))) {
    throw new ValidationError('category_id', 'Choose a category.')
  }
  return id
}
