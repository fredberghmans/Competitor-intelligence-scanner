import { createServiceClient } from '@/lib/supabase/server'
import type { ExtractedDataPoint, InsightOutput } from './types'
import { log } from './client'

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
