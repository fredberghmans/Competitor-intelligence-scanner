import { createServiceClient } from '@/lib/supabase/server'
import type { ExtractedDataPoint, InsightOutput } from './types'
import { log } from './client'
import { normalizeCriteriaValues } from './normalize'

/**
 * Persists extracted data points to the `data_points` table.
 *
 * Uses upsert on (competitor_id, criteria_id) — the unique constraint
 * defined in 0001_initial_schema.sql. This means:
 *   - First scan: INSERT all data points
 *   - Subsequent scans: UPDATE only changed values
 *   - Unchanged values: no-op (DB row untouched)
 *
 * Skips data points with no resolved criteria_id (i.e. the AI returned
 * a criteria name that doesn't exist in the DB).
 */
export async function saveDataPoints(
  competitorId: string,
  scanId: string,
  dataPoints: ExtractedDataPoint[],
): Promise<void> {
  const supabase = createServiceClient()

  const rows = dataPoints
    .filter((d) => d.criteria_id) // must have a resolved criteria_id
    .map((d) => ({
      competitor_id: competitorId,
      criteria_id: d.criteria_id!,
      scan_id: scanId,
      value: d.value,
      confidence: d.confidence,
      source_url: d.source_url,
    }))

  if (rows.length === 0) {
    log('store', 'No valid data points to save (criteria_id missing on all)')
    return
  }

  const { error } = await supabase
    .from('data_points')
    .upsert(rows, { onConflict: 'competitor_id,criteria_id' })

  if (error) throw error
  log('store', `Saved ${rows.length} data point(s) for competitor ${competitorId}`)

  // Normalize values for all affected criteria (best-effort — never throws)
  try {
    const affectedCriteriaIds = [...new Set(rows.map((r) => r.criteria_id))]

    for (const criteriaId of affectedCriteriaIds) {
      // Fetch all data points + criteria name for this criterion (all competitors)
      const { data: allPoints, error: fetchErr } = await supabase
        .from('data_points')
        .select('competitor_id, value, criteria:criteria_id(name)')
        .eq('criteria_id', criteriaId)

      if (fetchErr || !allPoints || allPoints.length === 0) continue

      const criteriaName =
        (allPoints[0] as unknown as { criteria: { name: string } | null }).criteria?.name ?? criteriaId

      const entries = (allPoints as Array<{ competitor_id: string; value: string }>).map((p) => ({
        competitorId: p.competitor_id,
        value: p.value,
      }))

      const normalized = await normalizeCriteriaValues(criteriaName, entries)
      if (normalized.size === 0) continue

      for (const [cid, normalizedValue] of normalized) {
        await supabase
          .from('data_points')
          .update({ normalized_value: normalizedValue })
          .eq('competitor_id', cid)
          .eq('criteria_id', criteriaId)
      }

      log('store', `Normalized ${normalized.size} value(s) for criterion "${criteriaName}"`)
    }
  } catch (normErr) {
    log('store', `Normalization pass failed (non-fatal): ${String(normErr)}`)
  }
}

/**
 * Persists AI-generated insights to the `insights` table.
 *
 * Always inserts new rows (no upsert) — each scan produces a fresh set
 * of insights. Historical insights are preserved for the change log and
 * timeline views.
 */
export async function saveInsights(
  competitorId: string,
  scanId: string,
  insights: InsightOutput,
): Promise<void> {
  const supabase = createServiceClient()

  const rows = [
    {
      competitor_id: competitorId,
      scan_id: scanId,
      type: 'executive_summary' as const,
      content: JSON.stringify(insights.executive_summary),
    },
    {
      competitor_id: competitorId,
      scan_id: scanId,
      type: 'change_highlight' as const,
      content: JSON.stringify(insights.changes_summary),
    },
    ...(insights.benchmarks.length > 0
      ? [{
          competitor_id: competitorId,
          scan_id: scanId,
          type: 'benchmark' as const,
          content: JSON.stringify(insights.benchmarks),
        }]
      : []),
    ...(insights.recommendations.length > 0
      ? [{
          competitor_id: competitorId,
          scan_id: scanId,
          type: 'strategic_recommendation' as const,
          content: JSON.stringify(insights.recommendations),
        }]
      : []),
  ]

  const { error } = await supabase.from('insights').insert(rows)
  if (error) throw error
  log('store', `Saved ${rows.length} insight row(s) for competitor ${competitorId}`)
}
