// POST /api/chat: one step of a "chat with your data" conversation.
// Stateless. The model can only request the approved query functions below; the
// browser runs them against its local data and sends the results back in a
// follow-up request. The model then phrases an answer from those results only.

import { FunctionCallingConfigMode, type Content, type FunctionDeclaration } from '@google/genai'
import {
  CHAT_FUNCTIONS,
  LIMITS,
  type ChatFunctionCall,
  type ChatFunctionName,
  type ChatResponse,
  type ChatTurn,
  type ClientClock,
} from '../shared/ai-contract.js'
import { chatModel, generate } from './_lib/gemini.js'
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

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_totals_for_period',
    description:
      'Total income, total expenses and transaction count for a date range (inclusive).',
    parametersJsonSchema: {
      type: 'object',
      properties: { start_date: DATE, end_date: DATE },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_totals_by_category',
    description:
      'Totals per category for a date range (inclusive), with transaction counts per category.',
    parametersJsonSchema: {
      type: 'object',
      properties: { start_date: DATE, end_date: DATE, direction: DIRECTION },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'compare_periods',
    description:
      'Income, expense and per-category totals for two date ranges side by side, e.g. this month vs last month.',
    parametersJsonSchema: {
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
    parametersJsonSchema: {
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
      'All-time balance (total income minus total expenses) with all-time totals and transaction count.',
    parametersJsonSchema: { type: 'object', properties: {} },
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
- Balance = income minus expenses. Money moved into savings or investments is recorded as an expense in the Savings or Investments category, so it lowers the balance. When the user asks about spending, say whether the figure includes money moved to savings or investments.
- If a function result contains an "error", fix the arguments and call it again, or explain that you could not get the data.
- Be concise. State the period you used, e.g. "October 1–20".
- You describe the user's data; you do not give financial advice. Do not judge or shame spending.
- If a question is not about the user's transactions, say you can only answer questions about their recorded money.
- Plain text only, no emoji.`
}

export const POST = postHandler(limiter, async (body): Promise<ChatResponse> => {
  if (!isRecord(body)) throw new HttpError(400, 'Invalid request.')
  const turns = requireTurns(body.turns)
  const categories = requireCategories(body.categories)
  const clock = requireClock(body.clock)

  // Stop runaway loops: after too many function rounds, force a text answer.
  const allowTools = toolRoundsSinceLastQuestion(turns) < LIMITS.chatToolRounds

  const response = await generate({
    model: chatModel(),
    contents: turns.map(toContent),
    config: {
      systemInstruction: systemInstruction(clock, categories),
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      toolConfig: {
        functionCallingConfig: {
          mode: allowTools ? FunctionCallingConfigMode.AUTO : FunctionCallingConfigMode.NONE,
        },
      },
    },
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  const calls: ChatFunctionCall[] = []
  for (const part of parts) {
    if (!part.functionCall) continue
    const name = part.functionCall.name
    if (!isChatFunction(name)) {
      throw new HttpError(502, 'The assistant made an invalid request. Try rephrasing.')
    }
    calls.push({
      name,
      args: part.functionCall.args ?? {},
      ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
    })
  }
  if (calls.length > 0) return { type: 'function_calls', calls }

  const text = response.text?.trim()
  if (!text) throw new HttpError(502, "The assistant didn't return an answer. Try again.")
  return { type: 'answer', text }
})

function toContent(turn: ChatTurn): Content {
  if (turn.role === 'user') return { role: 'user', parts: [{ text: turn.text }] }
  if (turn.role === 'function') {
    return {
      role: 'user',
      parts: turn.results.map((r) => ({
        functionResponse: { name: r.name, response: { result: r.result } },
      })),
    }
  }
  if ('functionCalls' in turn) {
    return {
      role: 'model',
      parts: turn.functionCalls.map((c) => ({
        functionCall: { name: c.name, args: c.args },
        ...(c.thoughtSignature ? { thoughtSignature: c.thoughtSignature } : {}),
      })),
    }
  }
  return { role: 'model', parts: [{ text: turn.text }] }
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
