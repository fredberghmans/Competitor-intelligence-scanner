import type { PipelineInput, PipelineOutput } from './types'
import { classifyChunks } from './classify'
import { extractDataPoints } from './extract'
import { generateInsights } from './insights'
import { saveDataPoints, saveInsights } from './store'
import { log } from './client'

export type { PipelineInput, PipelineOutput, ClassifiedChunk, ExtractedDataPoint, InsightOutput, BenchmarkItem, StrategicRecommendation } from './types'
export { saveDataPoints, saveInsights } from './store'
export { formatChunksForAI } from '@/lib/diff'

/**
 * FULL AI PIPELINE
 * ─────────────────
 * Composes the three stages into a single call.
 *
 * FLOW
 * ─────
 *   changedChunks
 *     → Stage 1: classifyChunks()      [Haiku, parallel]
 *     → filter relevance < medium
 *     → Stage 2: extractDataPoints()   [Haiku, parallel]
 *     → Stage 3: generateInsights()    [Sonnet, single call]
 *     → persist to Supabase
 *
 * HOW UNNECESSARY AI CALLS ARE AVOIDED
 * ──────────────────────────────────────
 * 1. Diff hash check (lib/diff): unchanged pages never reach this function.
 * 2. Relevance filter: 'low' classified chunks are dropped before extraction.
 * 3. Empty guard: if no relevant chunks exist, stages 2 and 3 are skipped.
 * 4. Cache: repeated content (retries, same chunk across pages) hits the
 *    in-memory cache and skips the API call entirely.
 * 5. Insight skip: if extractDataPoints returns 0 results, insights are
 *    not generated — no call to the expensive model.
 *
 * @param persist  Set to false to run without writing to the DB (dry run / testing)
 */
export async function runPipeline(
  input: PipelineInput,
  persist = true,
): Promise<PipelineOutput> {
  const { competitor, pageUrl, changedChunks, criteria, scanId, referenceDataPoints } = input

  log('pipeline', `Starting pipeline for ${competitor.name} | ${pageUrl} | ${changedChunks.length} chunk(s)`)

  const usage = { classificationCalls: 0, extractionCalls: 0, insightCalls: 0 }

  // ── Stage 1: Classification ───────────────────────────────────────────────
  const classified = await classifyChunks(changedChunks, criteria)
  usage.classificationCalls = changedChunks.length

  const relevant = classified.filter((c) => c.relevance !== 'low')

  if (relevant.length === 0) {
    log('pipeline', 'No relevant chunks after classification — skipping extraction and insights')
    return { classified, dataPoints: [], insights: null, skipped: true, usage }
  }

  // ── Stage 2: Extraction ───────────────────────────────────────────────────
  const dataPoints = await extractDataPoints(relevant, pageUrl, competitor.name, criteria)
  usage.extractionCalls = relevant.length

  if (dataPoints.length === 0) {
    log('pipeline', 'No data points extracted — skipping insights')
    return { classified, dataPoints, insights: null, skipped: false, usage }
  }

  // ── Stage 3: Insights ─────────────────────────────────────────────────────
  const insights = await generateInsights(competitor.name, dataPoints, referenceDataPoints)
  usage.insightCalls = insights ? 1 : 0

  // ── Persist ───────────────────────────────────────────────────────────────
  if (persist) {
    await saveDataPoints(competitor.id, scanId, dataPoints)
    if (insights) await saveInsights(competitor.id, scanId, insights)
  }

  log('pipeline', `Done — ${dataPoints.length} data points, insights: ${insights ? 'yes' : 'none'}`, usage)

  return { classified, dataPoints, insights, skipped: false, usage }
}
