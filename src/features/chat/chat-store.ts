// Conversation state for Ask CICO. Kept at module level so it survives moving between
// screens; it is not persisted and clears on reload.

import { LIMITS, type ChatTurn } from '../../../shared/ai-contract'
import { db, getBalance, getTotalsForPeriod, listCategories } from '../../db'
import { toLocalDate } from '../../lib/dates'
import { ApiRequestError, chatStep } from '../../lib/api'
import { runChatFunction, type SourceRange } from './functions'

export interface Provenance {
  label: string
  transactionCount: number
}

export type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; provenance: Provenance[] }

export interface ChatState {
  messages: ChatMessage[]
  thinking: boolean
  // The last question failed; it can be retried.
  error: { message: string; question: string } | null
}

// Earlier exchanges sent as context, as plain question/answer text. Their function calls
// are dropped: the answers already carry what was found.
const HISTORY_EXCHANGES = 10

let state: ChatState = { messages: [], thinking: false, error: null }
let nextId = 1
let controller: AbortController | null = null
const listeners = new Set<() => void>()

function setState(patch: Partial<ChatState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getChatState(): ChatState {
  return state
}

export function subscribeChat(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The unsent question, kept so it survives switching screens and going offline.
let draft = ''

export function getDraft(): string {
  return draft
}

export function saveDraft(value: string) {
  draft = value
}

export function resetChat() {
  controller?.abort()
  controller = null
  setState({ messages: [], thinking: false, error: null })
}

export async function ask(question: string): Promise<void> {
  const text = question.trim()
  if (!text || state.thinking) return
  const history = historyTurns(state.messages)
  setState({
    messages: [...state.messages, { id: nextId++, role: 'user', text }],
    thinking: true,
    error: null,
  })

  const own = new AbortController()
  controller = own
  try {
    const answer = await answerQuestion(text, history, own.signal)
    if (own.signal.aborted) return
    setState({
      messages: [...state.messages, { id: nextId++, role: 'assistant', ...answer }],
      thinking: false,
    })
  } catch (err) {
    if (own.signal.aborted) return
    if (!(err instanceof ApiRequestError)) console.error(err)
    // Remove the unanswered question; it comes back through retry.
    setState({
      messages: state.messages.filter((m, i) => !(i === state.messages.length - 1 && m.role === 'user')),
      thinking: false,
      error: {
        message: err instanceof ApiRequestError ? err.message : 'Something went wrong. Try again.',
        question: text,
      },
    })
  } finally {
    if (controller === own) controller = null
  }
}

export function retry() {
  const failed = state.error?.question
  if (failed) void ask(failed)
}

async function answerQuestion(
  question: string,
  history: ChatTurn[],
  signal: AbortSignal,
): Promise<{ text: string; provenance: Provenance[] }> {
  const categories = (await listCategories()).map((c) => c.name)
  const turns: ChatTurn[] = [...history, { role: 'user', text: question }]
  const sources: SourceRange[] = []

  // The server forces a text answer after LIMITS.chatToolRounds rounds of function calls.
  for (let round = 0; round <= LIMITS.chatToolRounds; round++) {
    const response = await chatStep(turns, categories, signal)
    if (response.type === 'answer') {
      return { text: cleanAnswer(response.text), provenance: await describeSources(sources) }
    }
    const results = await Promise.all(response.calls.map((call) => runChatFunction(call, sources)))
    turns.push({ role: 'model', functionCalls: response.calls }, { role: 'function', results })
  }
  throw new ApiRequestError("Couldn't work that out. Try asking in a simpler way.")
}

function historyTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (let i = 0; i + 1 < messages.length; i++) {
    const q = messages[i]
    const a = messages[i + 1]
    if (q.role === 'user' && a.role === 'assistant') {
      turns.push({ role: 'user', text: q.text }, { role: 'model', text: a.text })
      i++
    }
  }
  return turns.slice(-HISTORY_EXCHANGES * 2)
}

const RANGE = new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })

// "Based on" notes for the answer, counted from local data for each period the model used.
async function describeSources(sources: SourceRange[]): Promise<Provenance[]> {
  const seen = new Set<string>()
  const unique = sources.filter((s) => {
    const key = `${s.start}|${s.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const first = await firstRecordDate()
  return Promise.all(
    unique.map(async (s): Promise<Provenance> => {
      if (!s.start || !s.end) {
        return { label: 'All time', transactionCount: (await getBalance()).transaction_count }
      }
      const totals = await getTotalsForPeriod(s.start, s.end)
      // The model often asks for "everything" as a range from a far-off start date.
      const label =
        first && s.start < first && s.end >= first
          ? `Up to ${RANGE.format(toDate(s.end))}`
          : formatSpan(s.start, s.end)
      return { label, transactionCount: totals.transaction_count }
    }),
  )
}

async function firstRecordDate(): Promise<string | null> {
  let first: string | null = null
  await db.transactions
    .orderBy('occurred_at')
    .until(() => first !== null)
    .each((t) => {
      if (t.deleted_at === null) first = toLocalDate(new Date(t.occurred_at))
    })
  return first
}

function toDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

function formatSpan(start: string, end: string): string {
  return start === end ? RANGE.format(toDate(start)) : RANGE.formatRange(toDate(start), toDate(end))
}

// Answers are meant to be plain text; strip any Markdown emphasis or list markers that slip in.
function cleanAnswer(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,:;!?)]|$)/gm, '$1$2')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/^#+\s*/gm, '')
    .trim()
}
