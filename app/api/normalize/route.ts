import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeCriteriaValues } from '@/lib/ai/normalize'

/**
 * POST /api/normalize
 *
 * One-time bootstrap endpoint to backfill normalized_value for existing data points.
 * Also useful when new competitors are added before their first scan.
 *
 * Body (JSON):
 *   { criteriaId: string }  → normalize one criterion only
 *   {}                      → normalize all criteria with ≥ 2 data points
 *
 * Returns:
 *   { ok: true, criteriaProcessed: number, dataPointsUpdated: number }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { criteriaId } = body as { criteriaId?: string }

    const service = createServiceClient()

    // Fetch distinct criteria_ids that have ≥ 2 data points (cross-competitor normalization only)
    let criteriaIds: string[]

    if (criteriaId) {
      criteriaIds = [criteriaId]
    } else {
      const { data: counts, error } = await service
        .from('data_points')
        .select('criteria_id')

      if (error) throw error

      const tally = new Map<string, number>()
      for (const { criteria_id } of counts ?? []) {
        tally.set(criteria_id, (tally.get(criteria_id) ?? 0) + 1)
      }
      criteriaIds = [...tally.entries()]
        .filter(([, count]) => count >= 2)
        .map(([id]) => id)
    }

    let criteriaProcessed = 0
    let dataPointsUpdated = 0

    for (const cid of criteriaIds) {
      const { data: points, error: fetchErr } = await service
        .from('data_points')
        .select('competitor_id, value, criteria:criteria_id(name)')
        .eq('criteria_id', cid)

      if (fetchErr || !points || points.length < 2) continue

      const criteriaName =
        (points[0] as { criteria: { name: string } | null }).criteria?.name ?? cid

      const entries = (points as Array<{ competitor_id: string; value: string }>).map((p) => ({
        competitorId: p.competitor_id,
        value: p.value,
      }))

      const normalized = await normalizeCriteriaValues(criteriaName, entries)
      if (normalized.size === 0) continue

      for (const [competitorId, normalizedValue] of normalized) {
        await service
          .from('data_points')
          .update({ normalized_value: normalizedValue })
          .eq('competitor_id', competitorId)
          .eq('criteria_id', cid)

        dataPointsUpdated++
      }

      criteriaProcessed++
    }

    return NextResponse.json({ ok: true, criteriaProcessed, dataPointsUpdated })
  } catch (err) {
    console.error('[normalize]', err)
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    )
  }
}
