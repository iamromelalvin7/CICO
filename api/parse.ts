// POST /api/parse: turns one natural-language entry into a transaction suggestion.
// The result is only a suggestion; the browser shows it for review before saving.

import {
  LIMITS,
  type ParseResponse,
  type ParsedTransaction,
} from '../shared/ai-contract.js'
import { ThinkingLevel } from '@google/genai'
import { generate, parseModel } from './_lib/gemini.js'
import {
  HttpError,
  RateLimiter,
  isLocalDateTime,
  isRecord,
  postHandler,
  requireCategories,
  requireClock,
  requireString,
} from './_lib/http.js'

const limiter = new RateLimiter(30, 60_000)

const SYSTEM_INSTRUCTION = `You extract a single personal finance transaction from a short note written by the user.
Amounts are in Ghana cedis (GH₵). Return the number exactly as stated; never convert currencies or invent an amount.
direction is "income" if money came in to the user, "expense" if money went out. Moving money into savings or investments is an "expense" in the Savings or Investments category; taking money back out of them is "income" in that same category.
category: pick the best match from the provided category list, using its exact spelling. Only if nothing reasonably fits, propose a short new category name (1-3 words, Title Case).
description: a short, clean label for the transaction (for example "Hoodie", "Salary", "Lunch"), without the amount.
occurred_at: if the note mentions when it happened, resolve it against the provided current local date/time and return "YYYY-MM-DDTHH:mm". If it does not mention a time, return null.
understood: false if the note is not a transaction or has no amount; true otherwise.`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    understood: { type: 'boolean' },
    amount: { type: 'number' },
    direction: { type: 'string', enum: ['income', 'expense'] },
    category: { type: 'string' },
    description: { type: 'string' },
    occurred_at: { type: ['string', 'null'] },
  },
  required: ['understood', 'amount', 'direction', 'category', 'description', 'occurred_at'],
}

export const POST = postHandler(limiter, async (body): Promise<ParseResponse> => {
  if (!isRecord(body)) throw new HttpError(400, 'Invalid request.')
  const text = requireString(body.text, 'Entry', LIMITS.parseTextChars)
  const categories = requireCategories(body.categories)
  const clock = requireClock(body.clock)

  const response = await generate({
    model: parseModel(),
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Current local date/time: ${clock.now} (${clock.timeZone})`,
              `Categories: ${JSON.stringify(categories)}`,
              `Note: ${JSON.stringify(text)}`,
            ].join('\n'),
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
      // Extraction is simple; extra thinking only adds seconds.
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    },
  })

  return { transaction: validate(response.text, categories) }
})

// Model output is untrusted: re-check every field before it reaches the client.
function validate(raw: string | undefined, categories: string[]): ParsedTransaction {
  const notUnderstood = new HttpError(
    422,
    "Couldn't read an amount from that. Try something like \"bought lunch for 45\".",
  )

  let out: unknown
  try {
    out = JSON.parse(raw ?? '')
  } catch {
    throw notUnderstood
  }
  if (!isRecord(out) || out.understood !== true) throw notUnderstood

  const amount = out.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
    throw notUnderstood
  }
  if (out.direction !== 'income' && out.direction !== 'expense') throw notUnderstood

  const proposed = typeof out.category === 'string' ? out.category.trim() : ''
  if (!proposed) throw notUnderstood
  const existing = categories.find((c) => c.toLowerCase() === proposed.toLowerCase())

  const trimmed = typeof out.description === 'string' ? out.description.trim() : ''
  const description = (trimmed.charAt(0).toUpperCase() + trimmed.slice(1)).slice(0, LIMITS.descriptionChars)

  const occurredAt =
    typeof out.occurred_at === 'string' && isLocalDateTime(out.occurred_at) ? out.occurred_at : null

  return {
    amount: Math.round(amount * 100) / 100,
    direction: out.direction,
    category: existing ?? proposed.slice(0, LIMITS.categoryNameChars),
    isNewCategory: !existing,
    description,
    occurredAt,
  }
}
