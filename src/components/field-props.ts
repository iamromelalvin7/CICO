// Props to spread on the input inside a Field so its label, hint and error are announced.
export function fieldProps(id: string, error?: string, hint?: string) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ')
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  }
}
