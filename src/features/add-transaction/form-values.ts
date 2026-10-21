import type { Direction } from '../../db'
import { toLocalDateTime } from '../../lib/format'
import type { CategoryChoice } from './save'

export interface FormValues {
  amount: string
  direction: Direction
  category: CategoryChoice | null
  description: string
  // Local "YYYY-MM-DDTHH:mm".
  occurredAt: string
}

export function emptyFormValues(): FormValues {
  return {
    amount: '',
    direction: 'expense',
    category: null,
    description: '',
    occurredAt: toLocalDateTime(new Date()),
  }
}
