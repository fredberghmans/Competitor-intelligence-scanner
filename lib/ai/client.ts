import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * MODEL CHOICES
 * ─────────────
 * Haiku  — Stage 1 (classification) and Stage 2 (extraction)
 *   Fast, cheap, deterministic JSON output. Good at structured tasks
 *   with a clear schema. ~25× cheaper than Sonnet per token.
 *
 * Sonnet — Stage 3 (insights, recommendations, benchmarks)
 *   Stronger reasoning for strategic analysis and nuanced comparisons.
 *   Only called once per scan after data points are consolidated.
 *
 * Cost implication: A typical scan with 5 changed chunks costs roughly:
 *   Stage 1: 5 × ~300 tokens × Haiku rate  ≈ $0.0005
 *   Stage 2: 5 × ~500 tokens × Haiku rate  ≈ $0.0008
 *   Stage 3: 1 × ~2000 tokens × Sonnet rate ≈ $0.006
 *   Total per scan: ~$0.007 — negligible at any scale.
 *   Unchanged pages: $0.00 (hash check prevents any AI call).
 */
export const MODELS = {
  cheap: 'claude-haiku-4-5-20251001',
  advanced: 'claude-sonnet-4-6',
} as const

export type ModelKey = keyof typeof MODELS

/**
 * Calls the Claude API and returns the text content of the first message.
 * Wraps the SDK call with basic error context.
 */
export async function callClaude(
  model: (typeof MODELS)[ModelKey],
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude')
  return block.text
}

/**
 * Robustly extracts JSON from a Claude response.
 * Claude sometimes wraps JSON in ```json … ``` fences — this handles that.
 */
export function parseJSON<T>(raw: string): T {
  // Direct parse
  try {
    return JSON.parse(raw) as T
  } catch {}

  // Strip markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T
    } catch {}
  }

  // Walk the string to find the exact JSON substring (handles trailing prose)
  const extracted = extractJsonSubstring(raw)
  if (extracted) {
    try {
      return JSON.parse(extracted) as T
    } catch {}
  }

  throw new Error(`Could not parse JSON from model response:\n${raw.slice(0, 300)}`)
}

/**
 * Finds the first complete JSON object or array in a string by counting
 * brackets. Correctly ignores brackets inside string literals.
 * Returns null if no valid JSON structure is found.
 */
function extractJsonSubstring(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    const opener = text[i]
    if (opener !== '{' && opener !== '[') continue

    const closer = opener === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false

    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (escaped) { escaped = false; continue }
      if (ch === '\\' && inString) { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === opener) depth++
      else if (ch === closer) {
        depth--
        if (depth === 0) return text.slice(i, j + 1)
      }
    }
  }
  return null
}

/** Structured console logger for the AI pipeline. */
export function log(
  stage: 'classify' | 'extract' | 'insights' | 'pipeline' | 'cache' | 'store',
  message: string,
  data?: unknown,
) {
  const prefix = `[ai:${stage}]`
  if (data !== undefined) {
    console.log(prefix, message, typeof data === 'string' ? data : JSON.stringify(data))
  } else {
    console.log(prefix, message)
  }
}
