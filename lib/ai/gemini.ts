import { GoogleGenAI } from '@google/genai'
import type { ModelKey } from './client'

function cleanGeminiError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[gemini:raw]', msg)
  if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
    return new Error('Gemini quota exceeded — enable billing at console.cloud.google.com or switch to Anthropic in Settings.')
  }
  if (msg.includes('403') || msg.toLowerCase().includes('api key')) {
    return new Error('Gemini API key is invalid or missing. Check GEMINI_API_KEY in .env.local.')
  }
  if (msg.includes('404')) {
    return new Error(`Gemini 404: ${msg.split('\n')[0].slice(0, 300)}`)
  }
  return new Error(msg.split('\n')[0].slice(0, 200))
}

/**
 * Gemini model equivalents:
 *   cheap    → gemini-2.5-flash  (fast, cheap, structured JSON)
 *   advanced → gemini-2.5-pro    (stronger reasoning for insights)
 *
 * Uses @google/genai SDK with apiVersion v1alpha — required for Gemini 2.5
 * preview models. Both v1 and v1beta return 404 for these models.
 */
const GEMINI_MODELS: Record<ModelKey, string> = {
  cheap: 'gemini-2.5-flash',
  advanced: 'gemini-2.5-pro',
}

function makeClient(apiKey: string) {
  return new GoogleGenAI({ apiKey })
}

/**
 * Calls Google Gemini and returns the text response.
 * Mirrors the callClaude() signature so it can be swapped in transparently.
 */
export async function callGemini(
  modelKey: ModelKey,
  system: string,
  user: string,
  apiKey: string,
  maxTokens = 1024,
): Promise<string> {
  const ai = makeClient(apiKey)

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS[modelKey],
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
      },
    })
    return response.text ?? ''
  } catch (err) {
    throw cleanGeminiError(err)
  }
}

/**
 * Runs a Gemini research call using Google Search grounding (Gemini 2.5).
 */
export async function researchWithGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const ai = makeClient(apiKey)

  onProgress?.('Searching with Gemini + Google Search…')

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 8192,
      },
    })
    onProgress?.('Processing results…')
    return response.text ?? ''
  } catch (err) {
    throw cleanGeminiError(err)
  }
}
