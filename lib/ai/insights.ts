import type { DataPoint } from '@/lib/supabase/types'
import type { ExtractedDataPoint, InsightOutput } from './types'
import { callAI, parseJSON, log } from './client'
import { insightsSystem, insightsUser } from './prompts'
import { getCache, setCache } from './cache'
import { generateHash } from '@/lib/crawler/hash'

/**
 * STAGE 3 — Insights (advanced model)
 *
 * Takes all extracted data points for a competitor and produces:
 *   A. Executive summary (TL;DR, strengths, weaknesses, positioning)
 *   B. Changes summary (what changed in this scan)
 *   C. Benchmarks / Decision engine (competitor vs "us")
 *   D. Strategic recommendations (3–5 actions)
 *
 * WHY THE ADVANCED MODEL HERE
 * ────────────────────────────
 * Strategic reasoning — comparing positions, identifying gaps, writing
 * nuanced recommendations — requires stronger capability than classification.
 * Crucially, this stage runs only ONCE per scan regardless of how many pages
 * or chunks were processed. The cost is concentrated but justified.
 *
 * BENCHMARK / DECISION ENGINE
 * ────────────────────────────
 * If `referenceDataPoints` is provided (our own values from the DB), the
 * model can produce concrete comparisons:
 *   "You are behind Kraken in staking yield by 1.2%"
 *
 * If no reference data is provided, benchmarks is returned as [].
 * This makes the feature fully optional without breaking the pipeline.
 *
 * CACHE STRATEGY
 * ───────────────
 * Caches on a hash of the combined data points — if the same set of
 * data points is re-submitted (e.g. pipeline retry), we skip the
 * expensive model call entirely.
 */
export async function generateInsights(
  competitorName: string,
  dataPoints: ExtractedDataPoint[],
  referenceDataPoints?: DataPoint[],
): Promise<InsightOutput | null> {
  if (dataPoints.length === 0) {
    log('insights', 'No data points — skipping insight generation')
    return null
  }

  const cacheKey = `insights:${generateHash(dataPoints.map((d) => d.value).sort().join('|'))}`
  const cached = getCache<InsightOutput>(cacheKey)
  if (cached) {
    log('insights', 'Cache hit — returning cached insights')
    return cached
  }

  log('insights', `Generating insights for ${competitorName} from ${dataPoints.length} data point(s)`)

  try {
    const raw = await callAI(
      'advanced',
      insightsSystem(),
      insightsUser(competitorName, dataPoints, referenceDataPoints),
      2048,
    )

    const parsed = parseJSON<InsightOutput>(raw)

    // Normalise — ensure all required fields exist even if the model omitted them
    const insights: InsightOutput = {
      executive_summary: {
        tldr: parsed.executive_summary?.tldr ?? '',
        strengths: parsed.executive_summary?.strengths ?? [],
        weaknesses: parsed.executive_summary?.weaknesses ?? [],
        positioning: parsed.executive_summary?.positioning ?? '',
      },
      changes_summary: {
        summary: parsed.changes_summary?.summary ?? '',
        highlights: parsed.changes_summary?.highlights ?? [],
      },
      benchmarks: parsed.benchmarks ?? [],
      recommendations: (parsed.recommendations ?? []).slice(0, 5), // cap at 5
    }

    log('insights', 'Generated', {
      strengths: insights.executive_summary.strengths.length,
      benchmarks: insights.benchmarks.length,
      recommendations: insights.recommendations.length,
    })

    setCache(cacheKey, insights)
    return insights
  } catch (err) {
    log('insights', `Failed to generate insights: ${String(err)}`)
    return null
  }
}
