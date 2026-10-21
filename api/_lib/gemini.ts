import {
  ApiError,
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai'
import { HttpError } from './http.js'

let client: GoogleGenAI | undefined

// The key is read from server env only; it never reaches the browser bundle.
function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set')
      throw new HttpError(503, 'AI features are not configured.')
    }
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

// Parsing needs speed (target: under five seconds end to end); chat needs better tool choice.
// Both are overridable without code changes. Chosen Oct 2026 from the models available to the key.
export function parseModel(): string {
  return process.env.GEMINI_PARSE_MODEL || 'gemini-3.5-flash-lite'
}

export function chatModel(): string {
  return process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash'
}

const RETRY_DELAY_MS = 800

// generateContent with one retry on a temporary overload, and upstream errors mapped
// to messages that are safe to show. Details are logged server-side only.
export async function generate(params: GenerateContentParameters): Promise<GenerateContentResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await gemini().models.generateContent(params)
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined
      if (status === 503 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        continue
      }
      console.error(`Gemini request failed (model ${params.model}):`, err)
      if (status === 429) throw quotaError(err)
      if (status === 503) {
        throw new HttpError(503, 'Gemini is busy right now. Try again in a moment.')
      }
      throw new HttpError(502, 'The AI service returned an error. Try again later.')
    }
  }
}

// Gemini's 429 says which quota ran out (per minute or per day) and when to retry.
function quotaError(err: unknown): HttpError {
  const detail = err instanceof Error ? err.message : ''
  const retrySeconds = Number(/"retryDelay":\s*"(\d+)s"/.exec(detail)?.[1] ?? NaN)
  const headers: Record<string, string> = Number.isFinite(retrySeconds)
    ? { 'retry-after': String(retrySeconds) }
    : {}
  if (detail.includes('PerDay')) {
    const hours = Number.isFinite(retrySeconds) ? Math.max(1, Math.round(retrySeconds / 3600)) : null
    const when = hours ? ` It resets in about ${hours} hour${hours === 1 ? '' : 's'}.` : ' It resets daily.'
    return new HttpError(429, `Today's Gemini allowance for this app is used up.${when}`, headers)
  }
  return new HttpError(429, "You've reached Gemini's per-minute limit. Wait about a minute, then try again.", headers)
}
