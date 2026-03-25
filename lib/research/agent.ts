import Anthropic from '@anthropic-ai/sdk'
import type { Competitor, Criteria } from '@/lib/supabase/types'
import type { ExtractedDataPoint } from '@/lib/ai/types'
import { anthropic, MODELS, parseJSON } from '@/lib/ai/client'
import { researchWithGemini } from '@/lib/ai/gemini'
import { getSettings } from '@/lib/settings'
import { researchSystemPrompt, researchUserPrompt } from './prompts'

export type ResearchProgress =
  | { type: 'turn'; turn: number; maxTurns: number; query?: string }
  | { type: 'done'; dataPoints: number; sourcesVisited: number }
  | { type: 'error'; message: string }

export type ResearchOutput = {
  dataPoints: ExtractedDataPoint[]
  sourcesVisited: string[]
  turnsUsed: number
}

type ExtractionResponse = Array<{
  criteria_name: string
  value: string
  confidence: 'high' | 'medium'
  source_url: string
}>

/**
 * Uses Claude with the web_search tool to research a competitor and extract
 * structured data points for the given criteria.
 *
 * Unlike the crawl pipeline (which fetches pages then runs AI on the content),
 * this agent searches the web autonomously — similar to how ChatGPT or Gemini
 * would answer questions about a competitor. More expensive but much more
 * thorough, especially for JS-heavy sites and PDF factsheets.
 *
 * Returns data points in the same shape as the crawl pipeline's extractDataPoints(),
 * so they can be saved via the same saveDataPoints() function.
 */
export async function researchCompetitor(
  competitor: Competitor,
  criteria: Criteria[],
  options: { maxTurns?: number; onProgress?: (event: ResearchProgress) => void } = {},
): Promise<ResearchOutput> {
  const maxTurns = options.maxTurns ?? 10
  const onProgress = options.onProgress
  const sourcesVisited: string[] = []
  let turnsUsed = 0

  if (criteria.length === 0) {
    console.log('[research] No criteria defined — skipping research')
    return { dataPoints: [], sourcesVisited, turnsUsed }
  }

  // Route to Gemini if configured
  const settings = await getSettings()
  if (settings.ai_provider === 'gemini') {
    if (!settings.gemini_api_key) throw new Error('Gemini API key is not configured. Add it in Settings.')
    return researchWithGeminiAgent(competitor, criteria, settings.gemini_api_key, onProgress)
  }

  console.log(`[research] Starting research for ${competitor.name} (${criteria.length} criteria, max ${maxTurns} turns)`)

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: researchUserPrompt(competitor, criteria) },
  ]

  let finalText = ''

  // Agentic loop: forward tool results back to the model until it produces a final answer
  while (turnsUsed < maxTurns) {
    turnsUsed++

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (anthropic.beta.messages as any).create({
      model: MODELS.advanced,
      max_tokens: 8192,
      system: researchSystemPrompt(criteria),
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
      betas: ['web-search-2025-03-05'],
    })

    console.log(`[research] Turn ${turnsUsed} — stop_reason: ${response.stop_reason}`)

    // Emit progress before processing tool calls so the UI updates immediately
    const toolUseEarly = (response.content as Anthropic.ContentBlock[]).filter(
      (b) => b.type === 'tool_use',
    ) as Anthropic.ToolUseBlock[]
    const firstQuery = toolUseEarly.find((b) => b.name === 'web_search')
    const queryStr =
      firstQuery && typeof firstQuery.input === 'object'
        ? ((firstQuery.input as Record<string, string>).query ?? undefined)
        : undefined
    onProgress?.({ type: 'turn', turn: turnsUsed, maxTurns, query: queryStr })

    // Collect any text content (may be the final answer)
    const textBlocks = (response.content as Anthropic.ContentBlock[]).filter((b) => b.type === 'text')
    if (textBlocks.length > 0) {
      finalText = (textBlocks[textBlocks.length - 1] as Anthropic.TextBlock).text
    }

    // Done — model finished without more tool calls
    if (response.stop_reason === 'end_turn') break

    // Collect tool use blocks
    const toolUseBlocks = (response.content as Anthropic.ContentBlock[]).filter(
      (b) => b.type === 'tool_use',
    ) as Anthropic.ToolUseBlock[]

    if (toolUseBlocks.length === 0) break

    // Add assistant's response to messages
    messages.push({ role: 'assistant', content: response.content })

    // Log searches and build tool results
    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => {
      if (block.name === 'web_search' && block.input && typeof block.input === 'object') {
        const query = (block.input as Record<string, string>).query ?? ''
        console.log(`[research] Searching: "${query}"`)
      }
      return {
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content: '',
      }
    })

    messages.push({ role: 'user', content: toolResults })
  }

  if (!finalText) {
    console.log('[research] No final text response from agent')
    return { dataPoints: [], sourcesVisited, turnsUsed }
  }

  // Parse the JSON array from the final response
  let parsed: ExtractionResponse
  try {
    parsed = parseJSON<ExtractionResponse>(finalText)
    if (!Array.isArray(parsed)) {
      console.log('[research] Final response was not a JSON array')
      return { dataPoints: [], sourcesVisited, turnsUsed }
    }
  } catch (err) {
    console.log(`[research] Failed to parse final response as JSON: ${err}`)
    return { dataPoints: [], sourcesVisited, turnsUsed }
  }

  // Build a name→id map for criteria resolution (with fuzzy fallback)
  const criteriaByName = new Map(criteria.map((c) => [c.name, c.id]))

  const dataPoints: ExtractedDataPoint[] = parsed
    .filter((item) => item.value && item.criteria_name && item.confidence && item.source_url)
    .map((item) => {
      const exactId = criteriaByName.get(item.criteria_name)
      const criteria_id =
        exactId ??
        criteria.find((c) => c.name.toLowerCase() === item.criteria_name.toLowerCase())?.id
      if (!exactId && criteria_id) {
        const matched = criteria.find((c) => c.id === criteria_id)?.name
        console.warn(`[research] Fuzzy-matched criteria "${item.criteria_name}" → "${matched}"`)
      }
      if (item.source_url && !sourcesVisited.includes(item.source_url)) {
        sourcesVisited.push(item.source_url)
      }
      return {
        criteria_name: item.criteria_name,
        criteria_id,
        value: item.value,
        confidence: item.confidence,
        source_url: item.source_url,
        raw_chunk: `[Research agent — ${competitor.name}]`,
      }
    })

  console.log(
    `[research] Done — ${dataPoints.length} data point(s), ${turnsUsed} turn(s), ${sourcesVisited.length} source(s)`,
  )
  onProgress?.({ type: 'done', dataPoints: dataPoints.length, sourcesVisited: sourcesVisited.length })
  return { dataPoints, sourcesVisited, turnsUsed }
}

/**
 * Gemini-backed research agent using Google Search grounding.
 * Single call instead of a multi-turn loop — simpler and cheaper.
 */
async function researchWithGeminiAgent(
  competitor: Competitor,
  criteria: Criteria[],
  apiKey: string,
  onProgress?: (event: ResearchProgress) => void,
): Promise<ResearchOutput> {
  onProgress?.({ type: 'turn', turn: 1, maxTurns: 1, query: `Researching ${competitor.name}…` })

  const finalText = await researchWithGemini(
    researchSystemPrompt(criteria),
    researchUserPrompt(competitor, criteria),
    apiKey,
    (msg) => onProgress?.({ type: 'turn', turn: 1, maxTurns: 1, query: msg }),
  )

  let parsed: Array<{ criteria_name: string; value: string; confidence: 'high' | 'medium'; source_url: string }>
  try {
    parsed = parseJSON(finalText)
    if (!Array.isArray(parsed)) return { dataPoints: [], sourcesVisited: [], turnsUsed: 1 }
  } catch {
    console.log('[research:gemini] Failed to parse response as JSON')
    return { dataPoints: [], sourcesVisited: [], turnsUsed: 1 }
  }

  const criteriaByName = new Map(criteria.map((c) => [c.name, c.id]))
  const sourcesVisited: string[] = []

  const dataPoints: ExtractedDataPoint[] = parsed
    .filter((item) => item.value && item.criteria_name && item.confidence && item.source_url)
    .map((item) => {
      const exactId = criteriaByName.get(item.criteria_name)
      const criteria_id = exactId ?? criteria.find(
        (c) => c.name.toLowerCase() === item.criteria_name.toLowerCase()
      )?.id
      if (item.source_url && !sourcesVisited.includes(item.source_url)) sourcesVisited.push(item.source_url)
      return {
        criteria_name: item.criteria_name,
        criteria_id,
        value: item.value,
        confidence: item.confidence,
        source_url: item.source_url,
        raw_chunk: `[Gemini Research — ${competitor.name}]`,
      }
    })

  onProgress?.({ type: 'done', dataPoints: dataPoints.length, sourcesVisited: sourcesVisited.length })
  console.log(`[research:gemini] Done — ${dataPoints.length} data point(s), ${sourcesVisited.length} source(s)`)
  return { dataPoints, sourcesVisited, turnsUsed: 1 }
}
