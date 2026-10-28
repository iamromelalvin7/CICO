import { Check, CircleAlert, Delete, LoaderCircle, WifiOff } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { onLock } from './lock-events'
import { clearPin, hasPin, PIN_PATTERN, sessionValid, setPin, startSession, syncPin, verifyPin } from './pin'
import {
  CODE_PATTERN,
  maskedRecoveryEmail,
  RecoveryError,
  recoveryConfigured,
  sendRecoveryCode,
  verifyRecoveryCode,
} from './recovery'

type Screen = 'loading' | 'setup' | 'locked' | 'forgot' | 'unlocked'

const MAX_TRIES = 5
const WAIT_SECONDS = 30
const RESEND_SECONDS = 60
const SESSION_CHECK_MS = 60_000
// How long the lock screen waits for the server's PIN before going on without it.
const PIN_SYNC_WAIT_MS = 5_000

// Shows the app only after the PIN is entered (or first set). A session lasts three days.
export function LockGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('loading')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void initialScreen().then((next) => {
      if (!cancelled) setScreen(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => onLock(() => setScreen('locked')), [])

  // Lock again once the session runs out, even if the app stays open.
  useEffect(() => {
    if (screen !== 'unlocked') return
    const recheck = () => {
      void sessionValid().then((valid) => {
        if (!valid) setScreen('locked')
      })
    }
    const timer = window.setInterval(recheck, SESSION_CHECK_MS)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [screen])

  if (screen === 'unlocked') return <>{children}</>

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-deep bg-[radial-gradient(ellipse_at_50%_115%,rgb(168_227_207/22%),transparent_60%)] px-6 py-12 text-white">
      <main className="flex w-full max-w-sm flex-col items-center text-center">
        <p className="font-serif text-5xl font-semibold tracking-tight">CICO</p>
        <p className="mt-2 text-sm font-medium text-mint">Cash In, Cash Out.</p>
        <p className="mt-1 text-sm text-white/75">Your money, in one place.</p>
        <div className="mt-10 w-full">
          {screen === 'loading' ? (
            <LoaderCircle aria-label="Loading" className="mx-auto size-6 animate-spin text-mint" />
          ) : screen === 'setup' ? (
            <SetupPin
              notice={notice}
              mode={notice ? 'replace' : 'create'}
              onDone={() => {
                setNotice(null)
                setScreen('unlocked')
              }}
            />
          ) : screen === 'locked' ? (
            <Unlock onUnlocked={() => setScreen('unlocked')} onForgot={() => setScreen('forgot')} />
          ) : (
            <ForgotPin
              onBack={() => setScreen('locked')}
              onReset={() => {
                setNotice('Code confirmed. Choose a new PIN for all your devices.')
                setScreen('setup')
              }}
            />
          )}
        </div>
      </main>
    </div>
  )
}

async function initialScreen(): Promise<Screen> {
  // A PIN set on another device (or in the browser, for the installed app) is used here too.
  if (!(await hasPin())) await refreshPin()
  if (!(await hasPin())) return 'setup'
  return (await sessionValid()) ? 'unlocked' : 'locked'
}

// Picks up a PIN set or changed on another device. Doesn't hold the screen up for long when
// offline or slow; the sync carries on in the background.
async function refreshPin(): Promise<void> {
  const sync = syncPin().catch((err) => console.error('PIN sync failed', err))
  await Promise.race([sync, new Promise((resolve) => window.setTimeout(resolve, PIN_SYNC_WAIT_MS))])
}

function SetupPin({
  notice,
  mode,
  onDone,
}: {
  notice: string | null
  mode: 'create' | 'replace'
  onDone: () => void
}) {
  const [first, setFirst] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const confirming = first !== null

  async function submit() {
    setError(null)
    if (!PIN_PATTERN.test(value)) {
      setError('Use 4 to 6 digits.')
      return
    }
    if (!confirming) {
      setFirst(value)
      setValue('')
      return
    }
    if (value !== first) {
      setFirst(null)
      setValue('')
      setError("The PINs didn't match. Choose a PIN again.")
      return
    }
    setBusy(true)
    try {
      await setPin(value, mode)
      await startSession()
      onDone()
    } catch (err) {
      console.error(err)
      setError("Couldn't save the PIN on this device. Try again.")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <PinPad
        title={confirming ? 'Enter the same PIN again' : 'Choose a PIN'}
        helper={
          notice && !confirming
            ? notice
            : confirming
              ? 'Type it once more to confirm.'
              : "4 to 6 digits. It keeps casual eyes off CICO; it isn't a password. The same PIN works on all your devices, and you'll be asked for it every three days."
        }
        value={value}
        onChange={(v) => {
          setValue(v)
          setError(null)
        }}
        onSubmit={submit}
        error={error}
        busy={busy}
        submitLabel={confirming ? 'Set PIN' : 'Continue'}
      />
      {confirming && (
        <TextButton
          onClick={() => {
            setFirst(null)
            setValue('')
            setError(null)
          }}
        >
          Start over
        </TextButton>
      )}
    </div>
  )
}

function Unlock({ onUnlocked, onForgot }: { onUnlocked: () => void; onForgot: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failures, setFailures] = useState(0)
  const waitLeft = useCountdown()

  async function submit() {
    if (waitLeft.seconds > 0) return
    setError(null)
    if (!PIN_PATTERN.test(value)) {
      setError('Enter your 4 to 6 digit PIN.')
      return
    }
    setBusy(true)
    try {
      await refreshPin()
      if (await verifyPin(value)) {
        await startSession()
        onUnlocked()
        return
      }
      const count = failures + 1
      setValue('')
      if (count >= MAX_TRIES) {
        setFailures(0)
        waitLeft.start(WAIT_SECONDS)
        setError(`Too many tries. Wait ${WAIT_SECONDS} seconds, or reset your PIN by email.`)
      } else {
        setFailures(count)
        const left = MAX_TRIES - count
        setError(`That PIN isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left before a short wait.`)
      }
    } catch (err) {
      console.error(err)
      setError("Couldn't check the PIN on this device. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <PinPad
        title="Enter your PIN"
        helper="Enter your 4 to 6 digit PIN to continue."
        value={value}
        onChange={setValue}
        onSubmit={submit}
        error={error}
        busy={busy}
        submitLabel="Unlock"
        waitSeconds={waitLeft.seconds}
      />
      <TextButton onClick={onForgot}>Forgot PIN?</TextButton>
    </div>
  )
}

function ForgotPin({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const id = useId()
  const online = useOnlineStatus()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const resend = useCountdown()

  async function send() {
    setError(null)
    setBusy(true)
    try {
      await sendRecoveryCode()
      setSent(true)
      setCode('')
      resend.start(RESEND_SECONDS)
    } catch (err) {
      setError(err instanceof RecoveryError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = code.trim()
    if (!CODE_PATTERN.test(trimmed)) {
      setError('Enter the code from the email. It is only digits.')
      return
    }
    setBusy(true)
    try {
      await verifyRecoveryCode(trimmed)
      await clearPin()
      onReset()
    } catch (err) {
      setError(err instanceof RecoveryError ? err.message : 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  if (!recoveryConfigured) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-white/80">
          PIN reset by email isn't set up for this app yet. Add the recovery email to the app's
          settings (VITE_RECOVERY_EMAIL), then try again.
        </p>
        <TextButton onClick={onBack}>Back to PIN</TextButton>
      </div>
    )
  }

  const email = maskedRecoveryEmail()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Reset your PIN</h1>
      {!sent ? (
        <>
          <p className="text-sm leading-relaxed text-white/80">
            We'll email a code to <span className="font-medium text-white">{email}</span>. Enter it
            here to set a new PIN. Your transactions stay as they are.
          </p>
          {!online && <OfflineNote />}
          {error && <LockError id={`${id}-error`}>{error}</LockError>}
          <LockButton type="button" onClick={send} loading={busy} disabled={!online}>
            Email me a code
          </LockButton>
        </>
      ) : (
        <form noValidate onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-white/80">
            Code sent to <span className="font-medium text-white">{email}</span>. It may take a
            minute to arrive.
          </p>
          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor={`${id}-code`} className="text-sm font-medium text-white">
              Code from the email
            </label>
            <input
              id={`${id}-code`}
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={pinInputClass}
            />
          </div>
          {!online && <OfflineNote />}
          {error && <LockError id={`${id}-error`}>{error}</LockError>}
          <LockButton loading={busy} disabled={!online}>
            Confirm code
          </LockButton>
          <TextButton onClick={send} disabled={busy || !online || resend.seconds > 0}>
            {resend.seconds > 0 ? `Send a new code in ${resend.seconds}s` : 'Send a new code'}
          </TextButton>
        </form>
      )}
      <TextButton onClick={onBack}>Back to PIN</TextButton>
    </div>
  )
}

// ---- Pieces ----

const pinInputClass =
  'block min-h-14 w-full rounded-sm border border-white/25 bg-white/10 px-4 text-center text-2xl font-semibold tracking-[0.4em] text-white tabular-nums placeholder:text-white/30 focus:border-mint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint aria-invalid:border-error-on-dark'

interface PinPadProps {
  title: string
  helper: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  error: string | null
  busy: boolean
  submitLabel: string
  // Seconds left in a wait after too many wrong tries.
  waitSeconds?: number
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

const keyClass =
  'flex size-[68px] cursor-pointer items-center justify-center rounded-full bg-white/[0.07] text-2xl font-medium text-white tabular-nums transition-colors duration-150 hover:bg-white/[0.14] active:bg-white/20 focus-visible:outline-mint disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.07]'

// Dots plus an on-screen keypad. A hardware keyboard works too: digits, Backspace, Enter.
function PinPad({ title, helper, value, onChange, onSubmit, error, busy, submitLabel, waitSeconds = 0 }: PinPadProps) {
  const errorId = useId()
  const waiting = waitSeconds > 0
  const canType = !busy && !waiting && value.length < 6
  const canSubmit = value.length >= 4 && !busy && !waiting

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        if (canType) onChange(value + e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onChange(value.slice(0, -1))
      } else if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        onSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, canType, canSubmit, onChange, onSubmit])

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-72 text-sm leading-relaxed text-white/70">{helper}</p>

      <div aria-hidden className="mt-7 flex items-center gap-3.5">
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < value.length
          const optional = i >= 4
          return (
            <span
              key={i}
              className={`size-3.5 rounded-full border-2 transition-colors duration-150 ${
                filled ? 'border-mint bg-mint' : optional ? 'border-dashed border-white/30' : 'border-white/60'
              }`}
            />
          )
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {value.length} {value.length === 1 ? 'digit' : 'digits'} entered
      </p>
      <div className="mt-4 flex min-h-10 justify-center">{error && <LockError id={errorId}>{error}</LockError>}</div>

      <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-4">
        {KEYS.map((k) => (
          <button key={k} type="button" disabled={!canType} onClick={() => onChange(value + k)} className={keyClass}>
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-label={submitLabel}
          title={submitLabel}
          className={`flex size-[68px] cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-mint disabled:cursor-not-allowed ${
            canSubmit ? 'bg-mint text-deep hover:bg-white' : 'bg-white/[0.04] text-white/30'
          }`}
        >
          {busy ? <LoaderCircle aria-hidden className="size-6 animate-spin" /> : <Check aria-hidden className="size-7" />}
        </button>
        <button type="button" disabled={!canType} onClick={() => onChange(value + '0')} className={keyClass}>
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          disabled={value.length === 0 || busy}
          aria-label="Delete last digit"
          className="flex size-[68px] cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors duration-150 hover:bg-white/[0.07] focus-visible:outline-mint disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Delete aria-hidden className="size-6" />
        </button>
      </div>
      <p className="mt-5 min-h-5 text-sm text-white/70" aria-live="polite">
        {waiting ? `Try again in ${waitSeconds}s` : ''}
      </p>
    </div>
  )
}

function LockError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-left text-sm text-error-on-dark">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}

function OfflineNote() {
  return (
    <p role="status" className="flex items-start gap-2 rounded-sm bg-white/10 px-3 py-2.5 text-left text-sm text-white/85">
      <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0 text-mint" />
      You're offline. Resetting the PIN needs an internet connection.
    </p>
  )
}

interface LockButtonProps {
  children: ReactNode
  loading?: boolean
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}

// Mint fill with deep green text: on this dark surface it reads as the primary action.
function LockButton({ children, loading = false, disabled = false, type = 'submit', onClick }: LockButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-mint px-4 text-sm font-semibold text-deep transition-colors duration-150 hover:bg-white focus-visible:outline-mint disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-mint"
    >
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

function TextButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mx-auto inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-mint hover:underline focus-visible:outline-mint disabled:cursor-not-allowed disabled:text-white/50 disabled:no-underline"
    >
      {children}
    </button>
  )
}

// Seconds remaining on a simple countdown.
function useCountdown() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= now) return
    const timer = window.setTimeout(() => setNow(Date.now()), 250)
    return () => window.clearTimeout(timer)
  }, [until, now])
  return {
    seconds: Math.max(0, Math.ceil((until - now) / 1000)),
    start: (seconds: number) => {
      const t = Date.now()
      setNow(t)
      setUntil(t + seconds * 1000)
    },
  }
}
