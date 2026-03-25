import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ModelKey } from './client'

/**
 * Gemini model equivalents:
 *   cheap    → gemini-2.0-flash  (fast, very cheap, good at structured JSON)
 *   advanced → gemini-1.5-pro    (stronger reasoning for insights/benchmarks)
 */
const GEMINI_MODELS: Record<ModelKey, string> = {
  cheap: 'gemini-2.0-flash',
  advanced: 'gemini-1.5-pro',
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

  const result = await model.generateContent(user)
  return result.response.text()
}

/**
 * Runs a Gemini research agent using Google Search grounding.
 * Equivalent to the Anthropic web_search research agent but in a single call.
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
    tools: [{ googleSearchRetrieval: {} }],
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 8192 },
  })

  const result = await model.generateContent(userPrompt)

  onProgress?.('Processing results…')

  return result.response.text()
}
