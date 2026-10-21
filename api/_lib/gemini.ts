import { GoogleGenAI } from '@google/genai'
import { HttpError } from './http.js'

let client: GoogleGenAI | undefined

// The key is read from server env only; it never reaches the browser bundle.
export function gemini(): GoogleGenAI {
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

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash'
}
