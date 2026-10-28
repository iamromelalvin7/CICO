import { Cloud, Download, KeyRound, Lock, RefreshCw, Tags, UserRound, Wallet, type LucideIcon } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Field, inputClass } from '../../components/Field'
import { fieldProps } from '../../components/field-props'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/toast-context'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { formatDateTime } from '../../lib/format'
import { NAME_MAX, setDisplayName, useDisplayName } from '../../lib/profile'
import { lockNow } from '../../lock/lock-events'
import { PIN_PATTERN, setPin, startSession, verifyPin } from '../../lock/pin'
import { remoteConfigured } from '../../sync/remote'
import { statusLabel } from '../../sync/status-label'
import { syncNow } from '../../sync/sync'
import { useSyncStatus } from '../../sync/useSyncStatus'
import { CategorySettings } from './CategorySettings'
import { exportTransactionsCsv } from './export'

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:gap-6 lg:px-8 lg:py-8">
      <PageHeader title="Settings" description="Your profile, sync, categories, PIN and data." />
      <Section icon={UserRound} title="Profile" description="Used to greet you on the overview. Stored on this device only.">
        <ProfileForm />
      </Section>
      <Section icon={Cloud} title="Sync" description="Everything is saved on this device first, then copied to your Supabase project when you're online.">
        <SyncSettings />
      </Section>
      <Section icon={Tags} title="Categories" description="Rename, recolour, add or remove categories. Changes sync to your other devices.">
        <CategorySettings />
      </Section>
      <Section icon={KeyRound} title="PIN and session" description="CICO asks for your PIN every three days on this device. It keeps casual eyes out; it isn't a password.">
        <SecuritySettings />
      </Section>
      <Section icon={Wallet} title="Currency">
        <p className="text-sm text-ink">
          Ghana cedi <span className="text-ink-muted">· amounts show as GH₵ 1,250.00</span>
        </p>
      </Section>
      <Section icon={Download} title="Your data" description="Download every transaction as a spreadsheet file (CSV).">
        <ExportButton />
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ProfileForm() {
  const id = useId()
  const toast = useToast()
  const saved = useDisplayName()
  const [name, setName] = useState<string | null>(null)
  const value = name ?? saved ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    await setDisplayName(value)
    setName(null)
    toast('Name saved', value.trim() || 'Greeting will not use a name')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field id={id} label="Your name (optional)">
          <input
            id={id}
            type="text"
            autoComplete="given-name"
            maxLength={NAME_MAX}
            value={value}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Romel"
            className={inputClass}
          />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={name === null}>
        Save name
      </Button>
    </form>
  )
}

function SyncSettings() {
  const { phase, pending, lastSyncedAt } = useSyncStatus()
  const online = useOnlineStatus()
  const [busy, setBusy] = useState(false)

  if (!remoteConfigured) {
    return <p className="text-sm text-ink-muted">Sync isn't set up for this app, so data stays on this device only.</p>
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ink-muted">Status</dt>
        <dd className="font-medium text-ink">{statusLabel(phase, pending, online)}</dd>
        <dt className="text-ink-muted">Last synced</dt>
        <dd className="text-ink">{lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Not yet on this device'}</dd>
        <dt className="text-ink-muted">Waiting to sync</dt>
        <dd className="text-ink tabular-nums">
          {pending} change{pending === 1 ? '' : 's'}
        </dd>
      </dl>
      <Button
        variant="secondary"
        disabled={!online}
        loading={busy}
        onClick={async () => {
          setBusy(true)
          await syncNow()
          setBusy(false)
        }}
      >
        <RefreshCw aria-hidden className="size-4" />
        Sync now
      </Button>
    </div>
  )
}

function SecuritySettings() {
  const [changing, setChanging] = useState(false)
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="secondary" onClick={() => setChanging(true)}>
        <KeyRound aria-hidden className="size-4" />
        Change PIN
      </Button>
      <Button variant="secondary" onClick={() => void lockNow()}>
        <Lock aria-hidden className="size-4" />
        Lock now
      </Button>
      <Dialog open={changing} title="Change PIN" onClose={() => setChanging(false)}>
        <ChangePinForm onDone={() => setChanging(false)} />
      </Dialog>
    </div>
  )
}

function ChangePinForm({ onDone }: { onDone: () => void }) {
  const uid = useId()
  const toast = useToast()
  const [values, setValues] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({})
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [key]: v.replace(/\D/g, '').slice(0, 6) }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: typeof errors = {}
    if (!PIN_PATTERN.test(values.next)) found.next = 'Use 4 to 6 digits.'
    else if (values.confirm !== values.next) found.confirm = "The new PINs don't match."
    if (!values.current) found.current = 'Enter your current PIN.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      if (!(await verifyPin(values.current))) {
        setErrors({ current: "That PIN isn't right." })
        setBusy(false)
        return
      }
      await setPin(values.next, 'replace')
      await startSession()
      toast('PIN changed', 'Use the new PIN on all your devices')
      onDone()
    } catch (err) {
      console.error(err)
      setErrors({ next: "Couldn't save the PIN on this device. Try again." })
      setBusy(false)
    }
  }

  const fields: Array<{ key: keyof typeof values; label: string; autoComplete: string }> = [
    { key: 'current', label: 'Current PIN', autoComplete: 'current-password' },
    { key: 'next', label: 'New PIN (4 to 6 digits)', autoComplete: 'new-password' },
    { key: 'confirm', label: 'New PIN again', autoComplete: 'new-password' },
  ]

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {fields.map((f, i) => (
        <Field key={f.key} id={`${uid}-${f.key}`} label={f.label} error={errors[f.key]}>
          <input
            {...fieldProps(`${uid}-${f.key}`, errors[f.key])}
            autoFocus={i === 0}
            type="password"
            inputMode="numeric"
            autoComplete={f.autoComplete}
            value={values[f.key]}
            onChange={(e) => set(f.key)(e.target.value)}
            className={`${inputClass} tracking-[0.3em]`}
          />
        </Field>
      ))}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Change PIN
        </Button>
      </div>
    </form>
  )
}

function ExportButton() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="secondary"
          loading={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              const count = await exportTransactionsCsv()
              toast('Export ready', `${count} transaction${count === 1 ? '' : 's'}`)
            } catch (err) {
              console.error(err)
              setError("Couldn't create the file. Try again.")
            } finally {
              setBusy(false)
            }
          }}
        >
          <Download aria-hidden className="size-4" />
          Download CSV
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-error-text">{error}</p>}
    </div>
  )
}
