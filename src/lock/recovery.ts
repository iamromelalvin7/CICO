// PIN recovery by emailed one-time code, using Supabase Auth's email OTP. Verifying the
// code only proves the owner can read the recovery inbox; the returned auth session is
// discarded, since the app has no accounts.

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const EMAIL = (import.meta.env.VITE_RECOVERY_EMAIL as string | undefined)?.trim()

export const recoveryConfigured = Boolean(URL && KEY && EMAIL)

// Supabase codes are 6 digits by default; projects can configure up to 10.
export const CODE_PATTERN = /^\d{6,10}$/

export class RecoveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecoveryError'
  }
}

// "ro•••••@gmail.com", so the lock screen doesn't reveal the full address.
export function maskedRecoveryEmail(): string {
  if (!EMAIL) return ''
  const [name, domain] = EMAIL.split('@')
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 3))}@${domain}`
}

export async function sendRecoveryCode(): Promise<void> {
  await call('otp', { email: EMAIL, create_user: true }, {
    429: 'Too many codes requested. Wait a few minutes, then try again.',
  })
}

export async function verifyRecoveryCode(code: string): Promise<void> {
  await call('verify', { type: 'email', email: EMAIL, token: code }, {
    400: "That code isn't right or has expired. Check the latest email, or send a new code.",
    403: "That code isn't right or has expired. Check the latest email, or send a new code.",
    429: 'Too many attempts. Wait a few minutes, then try again.',
  })
}

async function call(path: string, body: object, messages: Record<number, string>): Promise<void> {
  if (!URL || !KEY || !EMAIL) throw new RecoveryError('PIN recovery is not set up on this app.')
  let res: Response
  try {
    res = await fetch(`${URL}/auth/v1/${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new RecoveryError("Couldn't reach the server. Check your connection and try again.")
  }
  if (res.ok) return
  const detail = await res.text().catch(() => '')
  console.error(`PIN recovery ${path} failed (${res.status})`, detail.slice(0, 300))
  throw new RecoveryError(messages[res.status] ?? 'Something went wrong. Try again in a moment.')
}
