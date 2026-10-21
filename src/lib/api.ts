import type {
  ApiError,
  ClientClock,
  ParseRequest,
  ParseResponse,
  ParsedTransaction,
} from '../../shared/ai-contract'
import { toLocalDateTime } from './format'

const TIMEOUT_MS = 20_000

// A failed AI request, with a message that is safe to show as-is.
export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

function clientClock(): ClientClock {
  return {
    now: toLocalDateTime(new Date()),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    if (timeout.aborted) throw new ApiRequestError('That took too long. Try again, or enter it manually.')
    throw new ApiRequestError("Couldn't reach CICO. Check your connection, or enter it manually.")
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? (data as ApiError).error
        : 'Quick add is unavailable right now. You can enter it manually.'
    throw new ApiRequestError(message)
  }
  return data as T
}

// Asks Gemini (via /api/parse) for a suggestion. Never saves anything.
export async function parseEntry(
  text: string,
  categories: string[],
  signal?: AbortSignal,
): Promise<ParsedTransaction> {
  const body: ParseRequest = { text, categories, clock: clientClock() }
  const result = await post<ParseResponse>('/api/parse', body, signal)
  return result.transaction
}
