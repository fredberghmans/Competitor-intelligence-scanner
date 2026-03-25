export { diffPages } from './engine'
export { storeChangeEvent, getPreviousPage } from './store'
export { splitIntoChunks, estimateTokens } from './chunker'
export type { DiffResult, DiffChunk, ChunkType, ChangeEventInsert } from './types'

/**
 * Formats changed chunks into a compact, labeled string ready for an AI prompt.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The AI pipeline should not need to know the internal structure of DiffChunk.
 * This function is the bridge between the diff engine and the AI layer.
 *
 * Format per chunk:
 *   [CHANGE 1/3 — ADDED]
 *   <content>
 *
 *   [CHANGE 2/3 — CHANGED]
 *   BEFORE: <previousContent>
 *   AFTER:  <content>
 *
 * The separator line (---) helps the model treat each chunk independently.
 *
 * USAGE IN THE AI PIPELINE
 * ─────────────────────────
 * const diff = diffPages(previous, current)
 * if (!diff.change_detected) return
 *
 * const promptSection = formatChunksForAI(diff.changed_chunks)
 * // Inject promptSection into your classification or summary prompt.
 * // diff.stats.estimated_tokens lets you decide which model tier to use.
 */
import type { DiffChunk } from './types'

export function formatChunksForAI(chunks: DiffChunk[]): string {
  if (chunks.length === 0) return ''

  return chunks
    .map((chunk, i) => {
      const header = `[CHANGE ${i + 1}/${chunks.length} — ${chunk.type.toUpperCase()}]`

      if (chunk.type === 'changed' && chunk.previousContent) {
        return `${header}\nBEFORE: ${chunk.previousContent}\nAFTER:  ${chunk.content}`
      }

      return `${header}\n${chunk.content}`
    })
    .join('\n\n---\n\n')
}
