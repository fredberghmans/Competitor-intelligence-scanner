// ---------------------------------------------------------------------------
// Diff engine types
// ---------------------------------------------------------------------------

export type ChunkType = 'added' | 'removed' | 'changed'

/**
 * A single unit of meaningful change.
 *
 * `content`         — the new text (what is there now)
 * `previousContent` — the old text (only present for type === 'changed')
 *
 * Chunks are sized at paragraph level (~50–800 chars each) to keep
 * token counts low when passed to the AI pipeline.
 */
export type DiffChunk = {
  type: ChunkType
  content: string
  previousContent?: string // only for 'changed'
}

export type DiffStats = {
  added_paragraphs: number
  removed_paragraphs: number
  total_chunks: number
  /** Rough estimate of tokens in changed_chunks — useful for AI cost budgeting */
  estimated_tokens: number
}

/**
 * Full result returned by diffPages().
 *
 * If change_detected is false, changed_chunks is always empty and no
 * DB write is needed — the caller can skip AI processing entirely.
 */
export type DiffResult = {
  change_detected: boolean
  change_summary: string
  changed_chunks: DiffChunk[]
  stats: DiffStats
}

/** Shape expected by the `change_events` Supabase table. */
export type ChangeEventInsert = {
  page_id: string
  scan_id: string
  change_type: 'new_page' | 'content_changed' | 'removed'
  diff_summary: string | null
}
