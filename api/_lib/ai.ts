// Provider-neutral AI calls. Groq (open models, generous free tier) is tried first when
// GROQ_API_KEY is set; Gemini takes over if Groq fails or runs out of quota, so one
// provider's limit doesn't take the AI features down. The browser never sees which one ran.

import type { ChatTurn } from '../../shared/ai-contract.js'
import { geminiChat, geminiJson, geminiConfigured } from './gemini.js'
import { groqChat, groqJson, groqConfigured } from './groq.js'
import { HttpError } from './http.js'

export interface JsonTask {
  system: string
  prompt: string
  schema: Record<string, unknown>
}

export interface ToolDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatTask {
  system: string
  turns: ChatTurn[]
  tools: ToolDeclaration[]
  // False forces a text answer.
  allowTools: boolean
}

// Calls as the model made them; the caller checks names against the approved list.
export interface ModelCall {
  name: string
  args: Record<string, unknown>
  thoughtSignature?: string
}

export type ChatStep = { calls: ModelCall[] } | { text: string }

interface Provider {
  name: string
  configured: () => boolean
  json: (task: JsonTask) => Promise<string | undefined>
  chat: (task: ChatTask) => Promise<ChatStep>
}

const PROVIDERS: Provider[] = [
  { name: 'Groq', configured: groqConfigured, json: groqJson, chat: groqChat },
  { name: 'Gemini', configured: geminiConfigured, json: geminiJson, chat: geminiChat },
]

// Returns the model's raw JSON text; the caller validates it.
export function generateJson(task: JsonTask): Promise<string | undefined> {
  return withFallback((p) => p.json(task))
}

export function chatStep(task: ChatTask): Promise<ChatStep> {
  return withFallback(async (p) => {
    const step = await p.chat(task)
    // An empty answer counts as a failure, so the next provider gets a try.
    if ('text' in step && !step.text) {
      console.error(`${p.name} returned an empty answer`)
      throw new HttpError(502, "The assistant didn't return an answer. Try again.")
    }
    return step
  })
}

async function withFallback<T>(run: (provider: Provider) => Promise<T>): Promise<T> {
  const available = PROVIDERS.filter((p) => p.configured())
  if (available.length === 0) {
    console.error('No AI provider configured: set GROQ_API_KEY and/or GEMINI_API_KEY')
    throw new HttpError(503, 'AI features are not configured.')
  }
  for (let i = 0; ; i++) {
    try {
      return await run(available[i])
    } catch (err) {
      if (i === available.length - 1) throw err
      // Errors are already logged by the provider; this one only notes the switch.
      console.warn(`${available[i].name} failed; falling back to ${available[i + 1].name}`)
    }
  }
}
