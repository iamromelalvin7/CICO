import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { InlineNotice } from '../../components/InlineNotice'
import { useToast } from '../../components/toast-context'
import { deleteTransaction, NotFoundError, type Category, type Transaction } from '../../db'
import { formatDateTime, formatMoney, toLocalDateTime } from '../../lib/format'
import type { FormValues } from '../add-transaction/form-values'
import { TransactionForm } from '../add-transaction/TransactionForm'

interface EditTransactionDialogProps {
  // The transaction being edited; null when closed.
  transaction: Transaction | null
  activeCategories: Category[]
  categories: Map<string, Category>
  onClose: () => void
}

export function EditTransactionDialog({
  transaction,
  activeCategories,
  categories,
  onClose,
}: EditTransactionDialogProps) {
  return (
    <Dialog open={transaction !== null} title="Edit transaction" onClose={onClose}>
      {transaction && (
        <EditBody
          transaction={transaction}
          activeCategories={activeCategories}
          categoryName={categories.get(transaction.category_id)?.name ?? 'Deleted category'}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

interface EditBodyProps {
  transaction: Transaction
  activeCategories: Category[]
  categoryName: string
  onClose: () => void
}

function EditBody({ transaction, activeCategories, categoryName, onClose }: EditBodyProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Computed once so edits are compared against what was loaded.
  const [initial] = useState(() => toFormValues(transaction, activeCategories))
  const toast = useToast()

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTransaction(transaction.id)
      toast('Deleted on this device', summary(transaction, categoryName))
      onClose()
    } catch (err) {
      if (err instanceof NotFoundError) setDeleteError(err.message)
      else {
        console.error(err)
        setDeleteError("Couldn't delete on this device. Try again.")
      }
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Kept mounted while confirming so edits survive going back. */}
      <div hidden={confirming}>
        <TransactionForm
          transactionId={transaction.id}
          initial={initial}
          categories={activeCategories}
          onSaved={onClose}
          onCancel={onClose}
          extraAction={
            <Button variant="danger-ghost" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden className="size-4" />
              Delete
            </Button>
          }
        />
      </div>

      {confirming && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-base font-semibold text-ink">Delete this transaction?</p>
            <p className="mt-1.5 text-sm text-ink-muted">
              <span className="font-medium text-ink">{summary(transaction, categoryName)}</span>
              <br />
              {formatDateTime(transaction.occurred_at)}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              It will no longer count towards your balance or totals. This can't be undone.
            </p>
          </div>
          {deleteError && <InlineNotice tone="error">{deleteError}</InlineNotice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
              Keep transaction
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete transaction
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function summary(t: Transaction, categoryName: string): string {
  return [formatMoney(t.amount), categoryName, t.description].filter(Boolean).join(' · ')
}

// A transaction whose category was deleted starts with no category, so one must be chosen.
function toFormValues(t: Transaction, activeCategories: Category[]): FormValues {
  return {
    amount: t.amount.toFixed(2),
    direction: t.direction,
    category: activeCategories.some((c) => c.id === t.category_id)
      ? { kind: 'existing', id: t.category_id }
      : null,
    description: t.description,
    occurredAt: toLocalDateTime(new Date(t.occurred_at)),
  }
}
