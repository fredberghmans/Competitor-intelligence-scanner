import { createClient } from '@/lib/supabase/server'
import type { Competitor, Criteria, DataPoint } from '@/lib/supabase/types'

export type DataPointRow = DataPoint & {
  criteria: Criteria
}

export type CategoryGroup = {
  category: Criteria          // parent (category) row, parent_id === null
  rows: DataPointRow[]        // only leaf criteria that have a data point
  emptyCriteria: Criteria[]   // leaf criteria with no data point yet
}

export type CompetitorDataPoints = {
  competitor: Competitor
  groups: CategoryGroup[]
  totalFilled: number
  totalCriteria: number
}

/**
 * Fetches all criteria and data points for a competitor, then groups them
 * by top-level category for the drill-down table.
 */
export async function getCompetitorDataPoints(
  competitorId: string,
): Promise<CompetitorDataPoints | null> {
  const supabase = await createClient()

  // 1. Competitor
  const { data: competitor, error: compErr } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', competitorId)
    .single()

  if (compErr || !competitor) return null

  // 2. All criteria
  const { data: allCriteria, error: critErr } = await supabase
    .from('criteria')
    .select('*')
    .order('position')

  if (critErr) throw critErr

  // 3. This competitor's data points
  const { data: dataPoints, error: dpErr } = await supabase
    .from('data_points')
    .select('*')
    .eq('competitor_id', competitorId)
    .order('updated_at', { ascending: false })

  if (dpErr) throw dpErr

  // Index data points by criteria_id for O(1) lookup
  const dpByCriteria = new Map<string, DataPoint>(
    (dataPoints ?? []).map((dp: DataPoint) => [dp.criteria_id, dp]),
  )

  const criteria = allCriteria as Criteria[]

  // Separate categories (parent_id === null) from leaf criteria
  const categories = criteria.filter((c) => c.parent_id === null)
  const leaves = criteria.filter((c) => c.parent_id !== null)

  // Group leaves under their parent category
  const groups: CategoryGroup[] = categories.map((cat) => {
    const catLeaves = leaves.filter((l) => l.parent_id === cat.id)

    const rows: DataPointRow[] = []
    const emptyCriteria: Criteria[] = []

    for (const leaf of catLeaves) {
      const dp = dpByCriteria.get(leaf.id)
      if (dp) {
        rows.push({ ...dp, criteria: leaf })
      } else {
        emptyCriteria.push(leaf)
      }
    }

    return { category: cat, rows, emptyCriteria }
  })

  // Only keep categories that have at least one leaf criterion
  const filledGroups = groups.filter(
    (g) => g.rows.length + g.emptyCriteria.length > 0,
  )

  const totalCriteria = leaves.length
  const totalFilled = (dataPoints ?? []).length

  return { competitor, groups: filledGroups, totalFilled, totalCriteria }
}
