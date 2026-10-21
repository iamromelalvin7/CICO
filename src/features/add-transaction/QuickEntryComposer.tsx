import { Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LIMITS, type ParsedTransaction } from '../../../shared/ai-contract'
import { Button } from '../../components/Button'
import { Field, inputClass } from '../../components/Field'
import { fieldProps } from '../../components/field-props'
import { InlineNotice } from '../../components/InlineNotice'
import { ApiRequestError, parseEntry } from '../../lib/api'

const HINT = "Describe it in your own words. You'll review the details before anything is saved."

interface QuickEntryComposerProps {
  // Owned by the parent so the text survives tab switches and connectivity changes.
  text: string
  onTextChange: (text: string) => void
  categoryNames: string[] | undefined
  online: boolean
  onParsed: (parsed: ParsedTransaction) => void
  onEnterManually: () => void
}

export function QuickEntryComposer({
  text,
  onTextChange,
  categoryNames,
  online,
  onParsed,
  onEnterManually,
}: QuickEntryComposerProps) {
  const id = useId()
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const trimmed = text.trim()
  const canSubmit = online && !parsing && trimmed.length > 0 && categoryNames !== undefined

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return
    setError(null)
    setParsing(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      onParsed(await parseEntry(trimmed, categoryNames, controller.signal))
    } catch (err) {
      if (controller.signal.aborted) return
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Quick add is unavailable right now. You can enter it manually.',
      )
    } finally {
      if (!controller.signal.aborted) setParsing(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const nearLimit = text.length > LIMITS.parseTextChars - 50

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        id={id}
        label="What happened?"
        hint={HINT}
        aside={
          nearLimit && (
            <span className="text-xs text-ink-muted tabular-nums">
              {text.length}/{LIMITS.parseTextChars}
            </span>
          )
        }
      >
        <textarea
          {...fieldProps(id, undefined, HINT)}
          rows={3}
          maxLength={LIMITS.parseTextChars}
          autoComplete="off"
          placeholder={'e.g. "bought lunch for 45" or "received 2,000 salary"'}
          value={text}
          onChange={(e) => {
            onTextChange(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          className={`${inputClass} resize-none py-2.5 leading-relaxed`}
        />
      </Field>

      {!online && (
        <InlineNotice
          tone="offline"
          action={
            <Button variant="secondary" className="min-h-9 px-3" onClick={onEnterManually}>
              Enter manually
            </Button>
          }
        >
          <span className="font-medium">You're offline.</span> Quick add needs a connection. Manual
          entry works and saves on this device.
        </InlineNotice>
      )}

      {error && online && (
        <InlineNotice
          tone="error"
          action={
            <Button variant="secondary" className="min-h-9 px-3" onClick={onEnterManually}>
              Enter manually
            </Button>
          }
        >
          {error}
        </InlineNotice>
      )}

      <Button type="submit" disabled={!canSubmit} loading={parsing}>
        {!parsing && <Sparkles aria-hidden className="size-4" />}
        {parsing ? 'Reading your entry…' : 'Review transaction'}
      </Button>
    </form>
  )
}
