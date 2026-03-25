import type { Criteria } from '@/lib/supabase/types'
import type { ClassifiedChunk, ExtractedDataPoint } from './types'
import { callAI, parseJSON, log } from './client'
import { extractionSystem, extractionUser } from './prompts'
import { getCache, setCache } from './cache'

type ExtractionResponse = Array<{
  criteria_name: string
  value: string
  confidence: 'high' | 'medium'
  note?: string
}>

/**
 * STAGE 2 — Extraction (cheap model)
 *
 * Converts classified chunks into structured data points:
 * a specific value, confidence level, source URL, and criteria mapping.
 *
 * Only processes chunks with relevance 'high' or 'medium' — 'low' chunks
 * are already filtered by the caller (the pipeline orchestrator).
 *
 * Each data point maps to one row in the `data_points` Supabase table.
 *
 * SOURCE TRACEABILITY
 * ────────────────────
 * `source_url` is required on every data point. The AI never manufactures
 * a value without an anchor in the original page text. The `raw_chunk`
 * field preserves the exact text the AI read, enabling manual audits.
 *
 * HALLUCINATION GUARD
 * ────────────────────
 * The extraction prompt instructs the model to return [] when nothing
 * concrete can be extracted. This is enforced by the prompt design, not
 * by post-processing — we trust an empty array over a confident guess.
 */
export async function extractDataPoints(
  classifiedChunks: ClassifiedChunk[],
  sourceUrl: string,
  competitorName: string,
  allCriteria: Criteria[],
): Promise<ExtractedDataPoint[]> {
  const relevant = classifiedChunks.filter((c) => c.relevance !== 'low' && c.criteria.length > 0)

  if (relevant.length === 0) {
    log('extract', 'No relevant chunks to extract from')
    return []
  }

  log('extract', `Extracting from ${relevant.length} relevant chunk(s)`)

  const results = await Promise.all(
    relevant.map((chunk) => extractOne(chunk, sourceUrl, competitorName, allCriteria)),
  )

  const flat = results.flat()
  log('extract', `Extracted ${flat.length} data point(s)`)
  return flat
}

async function extractOne(
  classified: ClassifiedChunk,
  sourceUrl: string,
  competitorName: string,
  allCriteria: Criteria[],
): Promise<ExtractedDataPoint[]> {
  const cacheKey = `extract:${classified.chunk.content}:${sourceUrl}`
  const cached = getCache<ExtractedDataPoint[]>(cacheKey)
  if (cached) {
    log('extract', `Cache hit for chunk (${classified.chunk.content.slice(0, 40)}…)`)
    return cached
  }

  try {
    const raw = await callAI(
      'cheap',
      extractionSystem(),
      extractionUser(classified, competitorName, sourceUrl),
      512,
    )

    const parsed = parseJSON<ExtractionResponse>(raw)
    if (!Array.isArray(parsed)) return []

    // Build a name→id map for criteria resolution
    const criteriaByName = new Map(allCriteria.map((c) => [c.name, c.id]))

    const dataPoints: ExtractedDataPoint[] = parsed
      .filter((item) => item.value && item.criteria_name && item.confidence)
      .map((item) => {
        const exactId = criteriaByName.get(item.criteria_name)
        const criteria_id = exactId ?? allCriteria.find(
          (c) => c.name.toLowerCase() === item.criteria_name.toLowerCase()
        )?.id
        if (!exactId && criteria_id) {
          console.warn(`[ai:extract] Fuzzy-matched criteria "${item.criteria_name}" → "${allCriteria.find(c => c.id === criteria_id)?.name}"`)
        }
        return {
          criteria_name: item.criteria_name,
          criteria_id,
          value: item.value,
          confidence: item.confidence,
          source_url: sourceUrl,
          raw_chunk: classified.chunk.content,
        }
      })

    log('extract', `Chunk → ${dataPoints.length} data point(s)`, dataPoints.map((d) => d.value))
    setCache(cacheKey, dataPoints)
    return dataPoints
  } catch (err) {
    log('extract', `Failed to extract from chunk: ${String(err)}`)
    return []
  }
}
