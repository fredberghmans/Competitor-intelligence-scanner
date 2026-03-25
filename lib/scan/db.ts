import { createServiceClient } from '@/lib/supabase/server'
import type { CrawledPage } from '@/lib/crawler'
import type { Scan } from '@/lib/supabase/types'

/**
 * Creates a scan record and immediately marks it as 'running'.
 * Returns the full scan row (including the generated UUID).
 */
export async function createScan(competitorId: string): Promise<Scan> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('scans')
    .insert({
      competitor_id: competitorId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create scan: ${error.message}`)
  return data
}

/**
 * Updates the scan status and sets completed_at when the scan ends.
 */
export async function updateScanStatus(
  scanId: string,
  status: 'completed' | 'failed',
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('scans')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', scanId)

  if (error) throw new Error(`Failed to update scan status: ${error.message}`)
}

/**
 * Inserts a crawled page snapshot into the `pages` table.
 * Returns the generated page ID (needed to create change_events).
 */
export async function insertPage(page: CrawledPage): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('pages')
    .insert(page)
    .select('id')
    .single()

  if (error) throw new Error(`Failed to insert page ${page.url}: ${error.message}`)
  return data.id
}

/**
 * Loads all competitors from the DB for a full-roster scan.
 */
export async function getAllCompetitorIds(): Promise<string[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('competitors')
    .select('id')
    .order('name')

  if (error) throw new Error(`Failed to load competitors: ${error.message}`)
  return data.map((row) => row.id)
}
