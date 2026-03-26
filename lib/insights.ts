import { createClient } from '@/lib/supabase/server'
import type { Competitor, Insight, Scan } from '@/lib/supabase/types'
import type { InsightOutput, BenchmarkItem, StrategicRecommendation } from '@/lib/ai/types'

export type ParsedInsights = {
  competitor: Competitor
  latestScan: Scan | null
  executive_summary: InsightOutput['executive_summary'] | null
  changes_summary: InsightOutput['changes_summary'] | null
  benchmarks: BenchmarkItem[]
  recommendations: StrategicRecommendation[]
  scannedAt: string | null
}

/**
 * Fetches and parses the most recent set of insights for a competitor.
 * Insight rows are grouped by the latest scan_id; older scans are ignored.
 */
export async function getLatestInsights(
  competitorId: string,
): Promise<ParsedInsights | null> {
  const supabase = await createClient()

  // Fetch competitor
  const { data: competitor, error: compErr } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', competitorId)
    .single()

  if (compErr || !competitor) return null

  // Fetch latest scan
  const { data: scans } = await supabase
    .from('scans')
    .select('*')
    .eq('competitor_id', competitorId)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestScan: Scan | null = scans?.[0] ?? null

  if (!latestScan) {
    return {
      competitor,
      latestScan: null,
      executive_summary: null,
      changes_summary: null,
      benchmarks: [],
      recommendations: [],
      scannedAt: null,
    }
  }

  // Fetch insight rows — use the most recent scan that actually has insights,
  // not necessarily the latest scan (which may have found no changes)
  const { data: allInsightRows } = await supabase
    .from('insights')
    .select('*')
    .eq('competitor_id', competitorId)
    .order('created_at', { ascending: false })
    .limit(20)

  const rows: Insight[] = []
  if (allInsightRows && allInsightRows.length > 0) {
    const latestScanWithInsights = allInsightRows[0].scan_id
    rows.push(...(allInsightRows as Insight[]).filter((r) => r.scan_id === latestScanWithInsights))
  }

  const parse = <T>(type: Insight['type']): T | null => {
    const row = rows.find((r: Insight) => r.type === type)
    if (!row) return null
    try {
      return JSON.parse(row.content) as T
    } catch {
      return null
    }
  }

  return {
    competitor,
    latestScan,
    executive_summary: parse<InsightOutput['executive_summary']>('executive_summary'),
    changes_summary: parse<InsightOutput['changes_summary']>('change_highlight'),
    benchmarks: parse<BenchmarkItem[]>('benchmark') ?? [],
    recommendations: parse<StrategicRecommendation[]>('strategic_recommendation') ?? [],
    scannedAt: latestScan.completed_at ?? latestScan.started_at ?? latestScan.created_at,
  }
}
