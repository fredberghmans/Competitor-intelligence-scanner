import { createServiceClient } from '@/lib/supabase/server'
import type { ChangeEventInsert, DiffResult } from './types'

/**
 * Persists a change event to the `change_events` table.
 *
 * Only writes when change_detected is true — callers don't need to guard
 * against this themselves.
 *
 * Uses the service-role client because change_events is write-protected
 * behind RLS (only the backend pipeline may insert rows).
 */
export async function storeChangeEvent(
  pageId: string,
  scanId: string,
  result: DiffResult,
  changeType: ChangeEventInsert['change_type'] = 'content_changed',
): Promise<void> {
  if (!result.change_detected) return

  const supabase = createServiceClient()

  const { error } = await supabase.from('change_events').insert({
    page_id: pageId,
    scan_id: scanId,
    change_type: changeType,
    diff_summary: result.change_summary,
  } satisfies ChangeEventInsert)

  if (error) throw error
}

/**
 * Fetches the most recent crawled page for a given URL from the previous scan.
 * Used to look up the snapshot to diff against.
 *
 * Returns null if this URL has never been seen before (new_page).
 */
export async function getPreviousPage(
  competitorId: string,
  url: string,
  beforeScanId: string,
): Promise<{ content_hash: string; cleaned_text: string; id: string } | null> {
  const supabase = createServiceClient()

  // Find the most recent page snapshot for this URL that belongs to a
  // completed scan *other than* the one we're currently processing.
  const { data, error } = await supabase
    .from('pages')
    .select('id, content_hash, cleaned_text, scan_id')
    .eq('competitor_id', competitorId)
    .eq('url', url)
    .neq('scan_id', beforeScanId)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
