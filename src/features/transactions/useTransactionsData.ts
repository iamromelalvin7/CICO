import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, listCategories, listTransactions } from '../../db'

// Every active transaction (newest first) plus categories. Re-runs whenever local data
// changes. `undefined` while loading; read failures come back as `{ ok: false }` instead of
// throwing during render.
export function useTransactionsData() {
  const [attempt, setAttempt] = useState(0)
  const data = useLiveQuery(async () => {
    try {
      const [transactions, active, all] = await Promise.all([
        listTransactions(),
        listCategories(),
        // Includes deleted categories so older rows still show their name.
        db.categories.toArray(),
      ])
      return {
        ok: true as const,
        transactions,
        activeCategories: active,
        categories: new Map(all.map((c) => [c.id, c])),
      }
    } catch (error) {
      console.error(error)
      return { ok: false as const }
    }
  }, [attempt])
  return { data, retry: () => setAttempt((n) => n + 1) }
}

export type TransactionsData = Extract<
  NonNullable<ReturnType<typeof useTransactionsData>['data']>,
  { ok: true }
>
