import { createClient } from '@/lib/supabase/server'
import type { Criteria } from '@/lib/supabase/types'

// -------------------------------------------------------------
// Input types
// -------------------------------------------------------------

export type CreateCriteriaInput = {
  name: string
  category: string
  parent_id?: string | null
  position?: number
}

export type UpdateCriteriaInput = Partial<CreateCriteriaInput>

// -------------------------------------------------------------
// Derived shape: tree structure for UI rendering
// -------------------------------------------------------------

export type CriteriaTree = Criteria & { children: Criteria[] }

// -------------------------------------------------------------
// Queries
// -------------------------------------------------------------

/** Returns all criteria rows, ordered for tree rendering. */
export async function getCriteria(): Promise<Criteria[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('criteria')
    .select('*')
    .order('position')

  if (error) throw error
  return data
}

/**
 * Returns the criteria tree: top-level categories with their
 * subcriteria nested under `children`.
 */
export async function getCriteriaTree(): Promise<CriteriaTree[]> {
  const flat = await getCriteria()

  const categories = flat
    .filter((c) => c.parent_id === null)
    .map((c) => ({ ...c, children: [] as Criteria[] }))

  const childMap = new Map(categories.map((c) => [c.id, c]))

  for (const row of flat) {
    if (row.parent_id && childMap.has(row.parent_id)) {
      childMap.get(row.parent_id)!.children.push(row)
    }
  }

  return categories
}

export async function getCriterion(id: string): Promise<Criteria | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('criteria')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

/** Returns all subcriteria for a given parent (category). */
export async function getSubcriteria(parentId: string): Promise<Criteria[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('criteria')
    .select('*')
    .eq('parent_id', parentId)
    .order('position')

  if (error) throw error
  return data
}

// -------------------------------------------------------------
// Mutations
// -------------------------------------------------------------

export async function createCriteria(
  input: CreateCriteriaInput,
): Promise<Criteria> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('criteria')
    .insert({
      ...input,
      parent_id: input.parent_id ?? null,
      position: input.position ?? 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCriteria(
  id: string,
  input: UpdateCriteriaInput,
): Promise<Criteria> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('criteria')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCriteria(id: string): Promise<void> {
  const supabase = await createClient()

  // Cascades to subcriteria via ON DELETE CASCADE in the schema.
  const { error } = await supabase
    .from('criteria')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Reorders subcriteria within a parent by updating their position values.
 * Pass the full ordered array of IDs as they should appear.
 */
export async function reorderCriteria(
  orderedIds: string[],
): Promise<void> {
  const supabase = await createClient()

  const updates = orderedIds.map((id, index) =>
    supabase
      .from('criteria')
      .update({ position: index })
      .eq('id', id),
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
