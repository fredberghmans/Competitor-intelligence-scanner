import { createClient } from '@/lib/supabase/server'
import type { Competitor, Criteria, DataPoint } from '@/lib/supabase/types'
import type { CriteriaTree } from '@/lib/criteria'

export type CompareCell = {
  value: string
  confidence: DataPoint['confidence']
  source_url: string | null
  updated_at: string
} | null

/** One leaf criterion row in the comparison table */
export type CompareRow = {
  criteria: Criteria
  /** keyed by competitor_id */
  cells: Record<string, CompareCell>
}

/** One category block (parent criterion + its leaf rows) */
export type CompareGroup = {
  category: Criteria
  rows: CompareRow[]
}

export type CompareData = {
  competitors: Competitor[]
  groups: CompareGroup[]
  /** Total leaf criteria */
  totalCriteria: number
  /** How many (competitor, criterion) cells are filled */
  totalFilled: number
}

/**
 * Fetches all competitors, all criteria, and all data points, then
 * pivots into a category × criterion × competitor matrix.
 *
 * Filters to the subset of competitors passed in `competitorIds`.
 * When empty, returns all competitors.
 */
export async function getCompareData(
  competitorIds?: string[],
): Promise<CompareData> {
  const supabase = await createClient()

  // 1. Competitors
  let compQuery = supabase.from('competitors').select('*').order('name')
  if (competitorIds && competitorIds.length > 0) {
    compQuery = compQuery.in('id', competitorIds)
  }
  const { data: competitors, error: compErr } = await compQuery
  if (compErr) throw compErr

  // 2. Criteria — all rows ordered by position
  const { data: allCriteria, error: critErr } = await supabase
    .from('criteria')
    .select('*')
    .order('position')
  if (critErr) throw critErr

  const criteria = allCriteria as Criteria[]
  const ids = (competitors as Competitor[]).map((c) => c.id)

  // 3. Data points for these competitors only
  const { data: dataPoints, error: dpErr } =
    ids.length > 0
      ? await supabase.from('data_points').select('*').in('competitor_id', ids)
      : { data: [], error: null }
  if (dpErr) throw dpErr

  // Index: "competitorId:criteriaId" → DataPoint
  const dpIndex = new Map<string, DataPoint>()
  for (const dp of dataPoints as DataPoint[]) {
    dpIndex.set(`${dp.competitor_id}:${dp.criteria_id}`, dp)
  }

  // Build groups
  const categories = criteria.filter((c) => c.parent_id === null)
  const leaves = criteria.filter((c) => c.parent_id !== null)

  const groups: CompareGroup[] = []
  let totalFilled = 0

  for (const cat of categories) {
    const catLeaves = leaves.filter((l) => l.parent_id === cat.id)
    if (catLeaves.length === 0) continue

    const rows: CompareRow[] = catLeaves.map((leaf) => {
      const cells: Record<string, CompareCell> = {}
      for (const comp of competitors as Competitor[]) {
        const dp = dpIndex.get(`${comp.id}:${leaf.id}`)
        if (dp) {
          totalFilled++
          cells[comp.id] = {
            value: dp.value,
            confidence: dp.confidence,
            source_url: dp.source_url,
            updated_at: dp.updated_at,
          }
        } else {
          cells[comp.id] = null
        }
      }
      return { criteria: leaf, cells }
    })

    groups.push({ category: cat, rows })
  }

  return {
    competitors: competitors as Competitor[],
    groups,
    totalCriteria: leaves.length,
    totalFilled,
  }
}
