import { LIMITS, type ApiError, type ClientClock } from '../../shared/ai-contract.js'

export class HttpError extends Error {
  status: number
  headers: Record<string, string>

  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.headers = headers
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })
}

// Wraps a POST handler: enforces JSON + size limit + rate limit, maps errors to safe responses.
export function postHandler(
  limiter: RateLimiter,
  handle: (body: unknown) => Promise<unknown>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      limiter.check(clientIp(request))
      const body = await readJson(request)
      return json(await handle(body))
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message } satisfies ApiError, err.status, err.headers)
      }
      // Never echo upstream errors: they can include request details.
      console.error(err)
      return json({ error: 'Something went wrong. Try again.' } satisfies ApiError, 500)
    }
  }
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new HttpError(415, 'Expected a JSON body.')
  }
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > LIMITS.maxBodyBytes) throw new HttpError(413, 'Request is too large.')

  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > LIMITS.maxBodyBytes) {
    throw new HttpError(413, 'Request is too large.')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'Invalid JSON.')
  }
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

// Basic fixed-window limiter, per IP. State lives in the function instance's memory,
// so it resets on cold starts and is not shared across instances. Good enough to
// blunt casual abuse of a single-user app; not a hard guarantee.
export class RateLimiter {
  private hits = new Map<string, { windowStart: number; count: number }>()
  private limit: number
  private windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  check(key: string): void {
    const now = Date.now()
    if (this.hits.size > 5000) this.prune(now)

    const entry = this.hits.get(key)
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { windowStart: now, count: 1 })
      return
    }
    entry.count += 1
    if (entry.count > this.limit) {
      const retryAfter = Math.ceil((entry.windowStart + this.windowMs - now) / 1000)
      throw new HttpError(429, 'Too many requests. Wait a moment and try again.', {
        'retry-after': String(retryAfter),
      })
    }
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) {
      if (now - entry.windowStart >= this.windowMs) this.hits.delete(key)
    }
  }
}

// Validation helpers. Everything from the client is untrusted.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireString(value: unknown, field: string, maxChars: number): string {
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`)
  const trimmed = value.trim()
  if (!trimmed) throw new HttpError(400, `${field} is empty.`)
  if (trimmed.length > maxChars) {
    throw new HttpError(400, `${field} is too long (max ${maxChars} characters).`)
  }
  return trimmed
}

export function requireCategories(value: unknown): string[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'categories must be a list.')
  if (value.length > LIMITS.categoryCount) throw new HttpError(400, 'Too many categories.')
  return value.map((name) => requireString(name, 'Category name', LIMITS.categoryNameChars))
}

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function requireClock(value: unknown): ClientClock {
  if (!isRecord(value)) throw new HttpError(400, 'clock is required.')
  const now = requireString(value.now, 'clock.now', 16)
  if (!LOCAL_DATETIME.test(now) || Number.isNaN(Date.parse(now))) {
    throw new HttpError(400, 'clock.now must be YYYY-MM-DDTHH:mm.')
  }
  const timeZone = requireString(value.timeZone, 'clock.timeZone', 64)
  try {
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    throw new HttpError(400, 'clock.timeZone is not a valid time zone.')
  }
  return { now, timeZone }
}

export function isLocalDateTime(value: string): boolean {
  return LOCAL_DATETIME.test(value) && !Number.isNaN(Date.parse(value))
}
