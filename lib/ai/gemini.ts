import { GoogleGenerativeAI } from '@google/generative-ai'
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
    return new Error('Gemini model not found — the model name may have changed. Check https://ai.google.dev/gemini-api/docs/models')
  }
  // Return first line only to avoid dumping the full JSON error object
  return new Error(msg.split('\n')[0].slice(0, 200))
}

/**
 * Gemini model equivalents:
 *   cheap    → gemini-2.0-flash       (fast, very cheap, good at structured JSON)
 *   advanced → gemini-2.0-flash       (same model, used for insights)
 *
 * Note: gemini-1.5-pro / gemini-1.5-flash aliases were removed from the v1beta API.
 * Use explicit versioned IDs or gemini-2.0-flash instead.
 */
const GEMINI_MODELS: Record<ModelKey, string> = {
  cheap: 'gemini-2.0-flash',
  advanced: 'gemini-2.0-flash',
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
  const genai = new GoogleGenerativeAI(apiKey)
  const model = genai.getGenerativeModel({
    model: GEMINI_MODELS[modelKey],
    systemInstruction: system,
    generationConfig: { maxOutputTokens: maxTokens },
  })

  try {
    const result = await model.generateContent(user)
    return result.response.text()
  } catch (err) {
    throw cleanGeminiError(err)
  }
}

/**
 * Runs a Gemini research call using Google Search grounding (Gemini 2.0).
 * Gemini 2.0 uses { googleSearch: {} } — googleSearchRetrieval was for 1.5 only.
 */
export async function researchWithGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const genai = new GoogleGenerativeAI(apiKey)

  onProgress?.('Searching with Gemini + Google Search…')

  const model = genai.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 8192 },
  })

  try {
    const result = await model.generateContent(userPrompt)
    onProgress?.('Processing results…')
    return result.response.text()
  } catch (err) {
    throw cleanGeminiError(err)
  }
}
