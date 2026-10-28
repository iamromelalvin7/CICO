// Groq's OpenAI-compatible chat completions API, called with plain fetch (no SDK needed).
// The key is read from server env only; it never reaches the browser bundle.

import type { ChatTurn } from '../../shared/ai-contract.js'
import type { ChatStep, ChatTask, JsonTask, ToolDeclaration } from './ai.js'
import { HttpError } from './http.js'

const URL = 'https://api.groq.com/openai/v1/chat/completions'
const TIMEOUT_MS = 20_000
// The free tier limits tokens per minute; a request just over it is told to retry within a
// second or two. Waiting that long beats handing the request to the fallback.
const MAX_RETRY_WAIT_MS = 3_000

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

// Both overridable without code changes. The parse model must support structured outputs
// (json_schema); the chat model must support tool calling.
function parseModel(): string {
  return process.env.GROQ_PARSE_MODEL || 'openai/gpt-oss-20b'
}

function chatModel(): string {
  return process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b'
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export async function groqJson(task: JsonTask): Promise<string | undefined> {
  const model = parseModel()
  const message = await complete({
    model,
    // Extraction is simple; less reasoning is faster and spends less of the token quota.
    ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
    messages: [
      { role: 'system', content: task.system },
      { role: 'user', content: task.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'result', schema: task.schema },
    },
  })
  return message.content ?? undefined
}

export async function groqChat(task: ChatTask): Promise<ChatStep> {
  const message = await complete({
    model: chatModel(),
    messages: [{ role: 'system', content: task.system }, ...toMessages(task.turns)],
    tools: task.tools.map(toTool),
    tool_choice: task.allowTools ? 'auto' : 'none',
  })

  if (message.tool_calls?.length) {
    return {
      calls: message.tool_calls.map((call) => {
        let args: unknown
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          args = null
        }
        if (typeof args !== 'object' || args === null || Array.isArray(args)) {
          console.error('Groq returned unparseable tool arguments:', call.function.arguments)
          throw new HttpError(502, 'The assistant made an invalid request. Try rephrasing.')
        }
        return { name: call.function.name, args: args as Record<string, unknown> }
      }),
    }
  }
  return { text: message.content?.trim() ?? '' }
}

function toTool(tool: ToolDeclaration) {
  return { type: 'function', function: tool }
}

// The browser's turns carry no call ids, so ids are derived from position: results in a
// function turn answer the calls in the model turn just before it, in order.
function toMessages(turns: ChatTurn[]): Message[] {
  const callId = (turn: number, i: number) => `call_${turn}_${i}`
  return turns.flatMap((turn, t): Message[] => {
    if (turn.role === 'user') return [{ role: 'user', content: turn.text }]
    if (turn.role === 'function') {
      return turn.results.map((r, i) => ({
        role: 'tool',
        tool_call_id: callId(t - 1, i),
        content: JSON.stringify({ result: r.result }),
      }))
    }
    if ('functionCalls' in turn) {
      return [
        {
          role: 'assistant',
          content: null,
          tool_calls: turn.functionCalls.map((c, i) => ({
            id: callId(t, i),
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
      ]
    }
    return [{ role: 'assistant', content: turn.text }]
  })
}

async function complete(body: Record<string, unknown>): Promise<Extract<Message, { role: 'assistant' }>> {
  let res = await send(body)
  const waitMs = Number(res.headers.get('retry-after')) * 1000
  if (res.status === 429 && waitMs > 0 && waitMs <= MAX_RETRY_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    res = await send(body)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`Groq request failed (model ${String(body.model)}, ${res.status}):`, detail.slice(0, 500))
    if (res.status === 429) {
      const retry = res.headers.get('retry-after')
      throw new HttpError(
        429,
        "The AI service's free limit is used up for now. Wait a little, then try again.",
        retry ? { 'retry-after': retry } : {},
      )
    }
    throw new HttpError(502, 'The AI service returned an error. Try again later.')
  }

  const data = (await res.json()) as { choices?: Array<{ message?: Extract<Message, { role: 'assistant' }> }> }
  const message = data.choices?.[0]?.message
  if (!message) throw new HttpError(502, "The AI service didn't return an answer. Try again.")
  return message
}

async function send(body: Record<string, unknown>): Promise<Response> {
  try {
    return await fetch(URL, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error(`Groq request failed (model ${String(body.model)}):`, err)
    throw new HttpError(503, "Couldn't reach the AI service. Try again in a moment.")
  }
}
