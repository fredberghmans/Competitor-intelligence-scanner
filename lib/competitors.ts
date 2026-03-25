import { createClient } from '@/lib/supabase/server'
import type { Competitor, CompetitorDomain } from '@/lib/supabase/types'

// -------------------------------------------------------------
// Input types
// -------------------------------------------------------------

export type CreateCompetitorInput = {
  name: string
  type: Competitor['type']
  region: string
  domains: CompetitorDomain[]
}

export type UpdateCompetitorInput = Partial<CreateCompetitorInput>

// -------------------------------------------------------------
// Queries
// -------------------------------------------------------------

export async function getCompetitors(): Promise<Competitor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export async function getCompetitor(id: string): Promise<Competitor | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // row not found
    throw error
  }
  return data
}

// -------------------------------------------------------------
// Mutations
// -------------------------------------------------------------

export async function createCompetitor(
  input: CreateCompetitorInput,
): Promise<Competitor> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competitors')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCompetitor(
  id: string,
  input: UpdateCompetitorInput,
): Promise<Competitor> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competitors')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCompetitor(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', id)

  if (error) throw error
}
