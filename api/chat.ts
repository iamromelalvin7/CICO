// POST /api/chat: one step of a "chat with your data" conversation.
// Stateless. The model can only request the approved query functions below; the
// browser runs them against its local data and sends the results back in a
// follow-up request. The model then phrases an answer from those results only.

import {
  CHAT_FUNCTIONS,
  LIMITS,
  type ChatFunctionCall,
  type ChatFunctionName,
  type ChatResponse,
  type ChatTurn,
  type ClientClock,
} from '../shared/ai-contract.js'
import { chatStep, type ToolDeclaration } from './_lib/ai.js'
import {
  HttpError,
  RateLimiter,
  isRecord,
  postHandler,
  requireCategories,
  requireClock,
  requireString,
} from './_lib/http.js'

// One question usually takes 2-3 requests (question, function results, answer).
const limiter = new RateLimiter(40, 60_000)

const DATE = { type: 'string', description: 'Date as YYYY-MM-DD.' }
const DIRECTION = {
  type: 'string',
  enum: ['income', 'expense'],
  description: 'Only include transactions in this direction. Omit for both.',
}

const FUNCTION_DECLARATIONS: ToolDeclaration[] = [
  {
    name: 'get_totals_for_period',
    description:
      'Income and expenses (both excluding savings and investment transfers), net amounts moved into savings and investments, balance change and transaction count for a date range (inclusive).',
    parameters: {
      type: 'object',
      properties: { start_date: DATE, end_date: DATE },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_totals_by_category',
    description:
      'Totals per category for a date range (inclusive), with transaction counts per category.',
    parameters: {
      type: 'object',
      properties: { start_date: DATE, end_date: DATE, direction: DIRECTION },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'compare_periods',
    description:
      'Income, expense and per-category totals for two date ranges side by side, e.g. this month vs last month.',
    parameters: {
      type: 'object',
      properties: {
        period_a_start: DATE,
        period_a_end: DATE,
        period_b_start: DATE,
        period_b_end: DATE,
      },
      required: ['period_a_start', 'period_a_end', 'period_b_start', 'period_b_end'],
    },
  },
  {
    name: 'list_largest_transactions',
    description: 'The largest transactions in a date range (inclusive), biggest first.',
    parameters: {
      type: 'object',
      properties: {
        start_date: DATE,
        end_date: DATE,
        direction: DIRECTION,
        category: { type: 'string', description: 'Exact category name to filter by.' },
        limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Defaults to 5.' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_balance',
    description:
      'All-time spendable balance, all-time income and expenses (excluding transfers), net amounts held in savings and investments, and transaction count.',
    parameters: { type: 'object', properties: {} },
  },
]

function systemInstruction(clock: ClientClock, categories: string[]): string {
  return `You are CICO's data assistant. You answer questions about the user's own recorded transactions.
Current local date/time: ${clock.now} (${clock.timeZone}). Weeks start on Monday.
The user's categories: ${JSON.stringify(categories)}.

Rules:
- Every number you state must come from a function result in this conversation. Never estimate, guess, or use outside knowledge for amounts, counts, or trends.
- Call a function whenever the question needs data. Resolve relative periods ("this month", "last week") into explicit dates first.
- If the results contain no matching transactions, say so plainly.
- Amounts are in Ghana cedis; write them as "GH₵ 1,250.00".
- Money moved into savings or investments is recorded as an expense in the Savings or Investments category, and money taken out as income in that category. These are transfers, not earning or spending: the income and expense totals leave them out, and the net_moved_* and in_* fields report them. Per-category results include Savings and Investments rows; treat those as transfers too.
- Balance is spendable money: income minus expenses, less what was moved into savings and investments. in_savings and in_investments count from when the user started tracking, so they can be negative if earlier savings were taken out; say so if that happens.
- If a function result contains an "error", fix the arguments and call it again, or explain that you could not get the data.
- Be concise: one to three short sentences, unless the user asks for a breakdown. State the period you used, e.g. "October 1–20".
- Quote figures as the results give them. Never split or derive a figure the results don't contain: net_moved_* values are already net, so say "net GH₵ 300.00 moved into savings", not separate amounts in and out.
- list_largest_transactions includes Savings and Investments transfers. For questions about spending or expenses, ask for 10 and leave those rows out.
- You describe the user's data; you do not give financial advice. Do not judge or shame spending.
- If a question is not about the user's transactions, say you can only answer questions about their recorded money.
- Plain text only: no Markdown (no asterisks, bold, headings or tables) and no emoji. For a breakdown, put each item on its own line starting with "- ".`
}

export const POST = postHandler(limiter, async (body): Promise<ChatResponse> => {
  if (!isRecord(body)) throw new HttpError(400, 'Invalid request.')
  const turns = requireTurns(body.turns)
  const categories = requireCategories(body.categories)
  const clock = requireClock(body.clock)

  // Stop runaway loops: after too many function rounds, force a text answer.
  const allowTools = toolRoundsSinceLastQuestion(turns) < LIMITS.chatToolRounds

  const step = await chatStep({
    system: systemInstruction(clock, categories),
    turns,
    tools: FUNCTION_DECLARATIONS,
    allowTools,
  })

  if ('text' in step) return { type: 'answer', text: plainText(step.text) }
  const calls = step.calls.map((call): ChatFunctionCall => {
    const { name } = call
    if (!isChatFunction(name)) {
      throw new HttpError(502, 'The assistant made an invalid request. Try rephrasing.')
    }
    return { ...call, name }
  })
  return { type: 'function_calls', calls }
})

// The chat shows answers as plain text; some models add Markdown anyway.
function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .trim()
}

function toolRoundsSinceLastQuestion(turns: ChatTurn[]): number {
  let rounds = 0
  for (let i = turns.length - 1; i >= 0 && turns[i].role !== 'user'; i--) {
    if (turns[i].role === 'function') rounds++
  }
  return rounds
}

function isChatFunction(name: unknown): name is ChatFunctionName {
  return typeof name === 'string' && (CHAT_FUNCTIONS as readonly string[]).includes(name)
}

function requireTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, 'turns is required.')
  if (value.length > LIMITS.chatTurns) {
    throw new HttpError(400, 'This conversation is too long. Start a new one.')
  }
  const turns = value.map(requireTurn)
  const last = turns[turns.length - 1]
  if (last.role !== 'user' && last.role !== 'function') {
    throw new HttpError(400, 'The last turn must be a question or function results.')
  }
  return turns
}

function requireTurn(value: unknown): ChatTurn {
  if (!isRecord(value)) throw new HttpError(400, 'Invalid turn.')

  if (value.role === 'user') {
    return { role: 'user', text: requireString(value.text, 'Message', LIMITS.chatMessageChars) }
  }

  if (value.role === 'model' && Array.isArray(value.functionCalls)) {
    if (value.functionCalls.length === 0 || value.functionCalls.length > 8) {
      throw new HttpError(400, 'Invalid function calls.')
    }
    return {
      role: 'model',
      functionCalls: value.functionCalls.map((call): ChatFunctionCall => {
        if (!isRecord(call) || !isChatFunction(call.name) || !isRecord(call.args)) {
          throw new HttpError(400, 'Invalid function call.')
        }
        const signature = call.thoughtSignature
        if (signature !== undefined && typeof signature !== 'string') {
          throw new HttpError(400, 'Invalid function call.')
        }
        return {
          name: call.name,
          args: call.args,
          ...(signature ? { thoughtSignature: signature } : {}),
        }
      }),
    }
  }

  if (value.role === 'model') {
    // Earlier answers can be long; they are the model's own words, so cap generously.
    return { role: 'model', text: requireString(value.text, 'Answer', LIMITS.chatMessageChars * 4) }
  }

  if (value.role === 'function' && Array.isArray(value.results)) {
    if (value.results.length === 0 || value.results.length > 8) {
      throw new HttpError(400, 'Invalid function results.')
    }
    return {
      role: 'function',
      results: value.results.map((r) => {
        if (!isRecord(r) || !isChatFunction(r.name)) {
          throw new HttpError(400, 'Invalid function result.')
        }
        if (JSON.stringify(r.result ?? null).length > LIMITS.toolResultChars) {
          throw new HttpError(400, 'Function result is too large.')
        }
        return { name: r.name, result: r.result ?? null }
      }),
    }
  }

  throw new HttpError(400, 'Invalid turn.')
}
