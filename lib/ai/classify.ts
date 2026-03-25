import type { DiffChunk } from '@/lib/diff'
import type { Criteria } from '@/lib/supabase/types'
import type { ClassifiedChunk, Relevance } from './types'
import { callAI, parseJSON, log } from './client'
import { classificationSystem, classificationUser } from './prompts'
import { getCache, setCache } from './cache'

type ClassificationResponse = {
  criteria: string[]
  relevance: Relevance
  reasoning: string
}

/**
 * STAGE 1 — Classification (cheap model)
 *
 * Maps each changed chunk to one or more criteria from the DB,
 * and assigns a relevance score.
 *
 * WHY A SEPARATE STAGE
 * ─────────────────────
 * Classification is cheap and fast. By filtering to only 'high' and 'medium'
 * relevance chunks before extraction, we avoid wasting extraction calls on
 * marketing noise, boilerplate footers, or cookie notices that slipped
 * through the cleaner.
 *
 * CONCURRENCY
 * ────────────
 * Chunks are classified in parallel (Promise.all) — safe because each
 * chunk is independent. API rate limits are generous enough for this at
 * our scan frequency.
 */
export async function classifyChunks(
  chunks: DiffChunk[],
  criteria: Criteria[],
): Promise<ClassifiedChunk[]> {
  if (chunks.length === 0) return []
  if (criteria.length === 0) {
    log('classify', 'No criteria defined — skipping classification')
    return []
  }

  log('classify', `Classifying ${chunks.length} chunk(s) against ${criteria.length} criteria`)

  const results = await Promise.all(
    chunks.map((chunk) => classifyOne(chunk, criteria)),
  )

  const classified = results.filter((r): r is ClassifiedChunk => r !== null)

  log('classify', `Done — ${classified.filter((c) => c.relevance !== 'low').length}/${classified.length} chunks relevant`)

  return classified
}

async function classifyOne(
  chunk: DiffChunk,
  criteria: Criteria[],
): Promise<ClassifiedChunk | null> {
  const cacheKey = `classify:${chunk.content}`
  const cached = getCache<ClassifiedChunk>(cacheKey)
  if (cached) {
    log('classify', `Cache hit for chunk (${chunk.content.slice(0, 40)}…)`)
    return cached
  }

  try {
    const raw = await callAI(
      'cheap',
      classificationSystem(),
      classificationUser(chunk.content, criteria),
      256,
    )

    const parsed = parseJSON<ClassificationResponse>(raw)

    // Validate criteria names against the DB list (prevent hallucinated names)
    const validNames = new Set(criteria.map((c) => c.name))
    const validCriteria = (parsed.criteria ?? []).filter((name) => validNames.has(name))

    const result: ClassifiedChunk = {
      chunk,
      criteria: validCriteria,
      relevance: parsed.relevance ?? 'low',
      reasoning: parsed.reasoning ?? '',
    }

    log('classify', `Chunk → [${result.criteria.join(', ')}] (${result.relevance})`, result.reasoning)
    setCache(cacheKey, result)
    return result
  } catch (err) {
    log('classify', `Failed to classify chunk: ${String(err)}`)
    return null
  }
}
