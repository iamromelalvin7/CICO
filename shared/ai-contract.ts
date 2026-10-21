// Request/response contract between the browser and the /api functions.
// Types and constants only, so both the Vite app and the Vercel functions can import it.

export const LIMITS = {
  maxBodyBytes: 64 * 1024,
  parseTextChars: 300,
  categoryCount: 100,
  categoryNameChars: 40,
  descriptionChars: 200,
  chatMessageChars: 1000,
  chatTurns: 30,
  // Max function-call rounds within one user question before the model must answer.
  chatToolRounds: 4,
  toolResultChars: 16 * 1024,
} as const

export type Direction = 'income' | 'expense'

// Local wall-clock context so relative dates ("yesterday", "this month") resolve correctly.
export interface ClientClock {
  // Local date and time, "YYYY-MM-DDTHH:mm".
  now: string
  // IANA zone, e.g. "Africa/Accra".
  timeZone: string
}

// POST /api/parse

export interface ParseRequest {
  text: string
  categories: string[]
  clock: ClientClock
}

export interface ParsedTransaction {
  amount: number
  direction: Direction
  category: string
  // True when `category` is not in the request's list and is proposed as new.
  isNewCategory: boolean
  description: string
  // Local "YYYY-MM-DDTHH:mm", or null when the text gave no date/time.
  occurredAt: string | null
}

export type ParseResponse = { transaction: ParsedTransaction }

// POST /api/chat
// The model never sees stored data directly. It requests one of these query
// functions, the browser runs it against local data, and sends the result back.

export const CHAT_FUNCTIONS = [
  'get_totals_for_period',
  'get_totals_by_category',
  'compare_periods',
  'list_largest_transactions',
] as const

export type ChatFunctionName = (typeof CHAT_FUNCTIONS)[number]

export interface ChatFunctionCall {
  name: ChatFunctionName
  args: Record<string, unknown>
  // Opaque Gemini value that must be sent back unchanged with the next request.
  thoughtSignature?: string
}

export interface ChatFunctionResult {
  name: ChatFunctionName
  result: unknown
}

export type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'model'; text: string }
  | { role: 'model'; functionCalls: ChatFunctionCall[] }
  | { role: 'function'; results: ChatFunctionResult[] }

export interface ChatRequest {
  turns: ChatTurn[]
  categories: string[]
  clock: ClientClock
}

export type ChatResponse =
  | { type: 'function_calls'; calls: ChatFunctionCall[] }
  | { type: 'answer'; text: string }

export interface ApiError {
  error: string
}
