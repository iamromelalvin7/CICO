// Thrown when input fails validation; `field` points the UI at the input to highlight.
export class ValidationError extends Error {
  field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

// Deleting a category that still has transactions requires choosing where they go.
export class CategoryInUseError extends Error {
  transactionCount: number

  constructor(transactionCount: number) {
    super(
      `This category has ${transactionCount} transaction${transactionCount === 1 ? '' : 's'}. Choose a category to move them to first.`,
    )
    this.name = 'CategoryInUseError'
    this.transactionCount = transactionCount
  }
}
