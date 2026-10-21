import { db, listTransactions } from '../../db'
import { toLocalDate } from '../../lib/dates'
import { toLocalDateTime } from '../../lib/format'

// Downloads every active transaction as a CSV file, newest first. Returns how many rows.
export async function exportTransactionsCsv(): Promise<number> {
  const [rows, categories] = await Promise.all([listTransactions(), db.categories.toArray()])
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const lines = [
    ['Date and time', 'Description', 'Category', 'Direction', 'Amount (GHS)'],
    ...rows.map((t) => [
      toLocalDateTime(new Date(t.occurred_at)).replace('T', ' '),
      t.description,
      names.get(t.category_id) ?? 'Deleted category',
      t.direction === 'income' ? 'Income' : 'Expense',
      t.amount.toFixed(2),
    ]),
  ]
  const csv = lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n')
  // BOM so Excel reads the file as UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cico-transactions-${toLocalDate(new Date())}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return rows.length
}

function csvCell(value: string): string {
  // Leading = + - @ could run as a formula in spreadsheet apps.
  const safe = /^[=+\-@]/.test(value) && Number.isNaN(Number(value)) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
