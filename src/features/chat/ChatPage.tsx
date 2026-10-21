import { ArrowUp, Database, LoaderCircle, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react'
import { LIMITS } from '../../../shared/ai-contract'
import { Button } from '../../components/Button'
import { InlineNotice } from '../../components/InlineNotice'
import { PageHeader } from '../../components/PageHeader'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import {
  ask,
  getChatState,
  getDraft,
  resetChat,
  retry,
  saveDraft,
  subscribeChat,
  type ChatMessage,
  type Provenance,
} from './chat-store'

const SUGGESTIONS = [
  'How much did I spend on food this month?',
  'Compare this month with last month',
  'What were my five largest expenses?',
]

export function ChatPage() {
  const uid = useId()
  const online = useOnlineStatus()
  const { messages, thinking, error } = useSyncExternalStore(subscribeChat, getChatState, getChatState)
  const [draft, setDraftState] = useState(getDraft)
  const endRef = useRef<HTMLDivElement>(null)
  const tooLong = draft.trim().length > LIMITS.chatMessageChars
  const canSend = online && !thinking && draft.trim().length > 0 && !tooLong

  function setDraft(value: string) {
    saveDraft(value)
    setDraftState(value)
  }

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, thinking, error])

  function send(question: string) {
    if (!online || thinking || !question.trim() || question.trim().length > LIMITS.chatMessageChars) return
    setDraft('')
    void ask(question)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send(draft)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(draft)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom)-3.5rem)] w-full max-w-3xl flex-col px-4 pt-6 sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-10">
      <PageHeader
        title="Ask CICO"
        description="Questions about your recorded money. Answers use only your saved transactions."
        aside={
          messages.length > 0 && (
            <Button variant="ghost" onClick={resetChat} className="shrink-0">
              <RotateCcw aria-hidden className="size-4" />
              <span className="hidden sm:inline">New conversation</span>
              <span className="sr-only sm:hidden">New conversation</span>
            </Button>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-4 py-6" aria-live="polite">
        {messages.length === 0 && !thinking && !error && (
          <section aria-labelledby={`${uid}-try`} className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 id={`${uid}-try`} className="text-base font-semibold text-ink">
              Try asking
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              CICO looks up the figures in your records and never estimates.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    disabled={!online}
                    className="flex min-h-11 w-full items-center rounded-sm border border-border bg-surface px-4 text-left text-sm text-ink transition-colors duration-150 hover:border-primary/40 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}

        {thinking && (
          <div className="flex items-center gap-2 self-start rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            Checking your records…
          </div>
        )}

        {error && (
          <InlineNotice
            tone="error"
            action={
              <Button variant="secondary" onClick={retry} disabled={!online}>
                Try again
              </Button>
            }
          >
            <span className="block">{error.message}</span>
            <span className="mt-0.5 block text-ink-muted">“{error.question}”</span>
          </InlineNotice>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 flex flex-col gap-2 border-t border-border bg-bg/95 px-4 pt-3 pb-4 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8 lg:pb-6"
      >
        {!online && (
          <InlineNotice tone="offline">
            You're offline. Ask CICO needs an internet connection. Your question will stay here.
          </InlineNotice>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor={`${uid}-question`} className="sr-only">
            Your question
          </label>
          <textarea
            id={`${uid}-question`}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. How much did I spend on transport last month?"
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? `${uid}-length` : undefined}
            className="block max-h-40 min-h-11 w-full resize-none rounded-sm border border-border bg-surface px-3 py-2.5 text-base text-ink [field-sizing:content] placeholder:text-ink-muted/70 hover:border-ink-muted/40 focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary aria-invalid:border-error-text"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary"
          >
            <ArrowUp aria-hidden className="size-5" />
          </button>
        </div>
        {tooLong ? (
          <p id={`${uid}-length`} className="text-xs font-medium text-error-text">
            Keep questions under {LIMITS.chatMessageChars} characters.
          </p>
        ) : (
          <p className="hidden text-xs text-ink-muted sm:block">
            Enter to send, Shift + Enter for a new line. Descriptive only, not financial advice.
          </p>
        )}
      </form>
    </div>
  )
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[85%] self-end rounded-md bg-primary-soft px-4 py-2.5 text-sm whitespace-pre-line text-ink">
        <span className="sr-only">You asked: </span>
        {message.text}
      </div>
    )
  }
  return (
    <div className="flex max-w-[92%] flex-col gap-2 self-start">
      <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-ink shadow-card">
        <span className="sr-only">CICO: </span>
        {message.text}
      </div>
      {message.provenance.length > 0 && <ProvenanceNote items={message.provenance} />}
    </div>
  )
}

// Generated from the actual query results, never by the model.
function ProvenanceNote({ items }: { items: Provenance[] }) {
  return (
    <p className="flex items-start gap-1.5 px-1 text-xs text-ink-muted">
      <Database aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>
        Checked{' '}
        {items
          .map(
            (p) =>
              `${p.transactionCount.toLocaleString('en-GH')} transaction${p.transactionCount === 1 ? '' : 's'} · ${p.label}`,
          )
          .join('; ')}
      </span>
    </p>
  )
}
