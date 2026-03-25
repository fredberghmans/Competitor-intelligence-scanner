import { diffArrays } from 'diff'
import type { DiffChunk, DiffResult } from './types'
import { splitIntoChunks, estimateTokens } from './chunker'

/**
 * Minimum character length for a changed chunk to be reported.
 * Filters out single-word edits, punctuation fixes, and whitespace drifts
 * that carry no strategic intelligence value.
 */
const MIN_MEANINGFUL_CHARS = 40

type PageSnapshot = {
  content_hash: string
  cleaned_text: string
}

/**
 * Diffs two page snapshots and returns a structured result.
 *
 * ALGORITHM
 * ─────────
 * Step 1 — Hash check (O(1))
 *   If content_hash values match the page is identical. Return immediately.
 *   No text parsing, no diff computation, no AI cost.
 *
 * Step 2 — Chunk split
 *   Split both cleaned_text values into paragraphs via splitIntoChunks().
 *   Each paragraph is one unit of comparison.
 *
 * Step 3 — Array diff (Myers algorithm via `diff` package)
 *   diffArrays() produces a sequence of unchanged / added / removed runs.
 *   The Myers algorithm minimises edit distance, so we get the smallest
 *   meaningful set of changes — not a naive line-by-line comparison.
 *
 * Step 4 — Pair adjacent removed+added runs as 'changed'
 *   When a removed run is immediately followed by an added run it means
 *   a section was rewritten. We pair them into a single DiffChunk with
 *   type='changed', preserving both old and new text for the AI.
 *
 * Step 5 — Filter noise
 *   Chunks shorter than MIN_MEANINGFUL_CHARS are dropped. These are
 *   typically UI labels, breadcrumbs, or single-word copy tweaks.
 *
 * WHY THIS REDUCES TOKEN USAGE
 * ─────────────────────────────
 * A typical competitor pricing page is 8–15 KB of cleaned text.
 * Sending the full page to an AI model on every scan would cost ~3,000–5,000
 * tokens per page × many competitors × many scans.
 *
 * With chunk-level diffing, only the changed paragraphs are forwarded.
 * A typical pricing update (one plan changed, one plan added) produces
 * 2–4 chunks totalling ~300–600 tokens — a 10× reduction.
 *
 * This is the primary cost-control mechanism in the pipeline.
 */
export function diffPages(previous: PageSnapshot, current: PageSnapshot): DiffResult {
  // ── Step 1: Fast hash check ────────────────────────────────────────────────
  if (previous.content_hash === current.content_hash) {
    return noChange()
  }

  // ── Step 2: Chunk both texts ───────────────────────────────────────────────
  const prevChunks = splitIntoChunks(previous.cleaned_text)
  const currChunks = splitIntoChunks(current.cleaned_text)

  // ── Step 3: Myers diff at paragraph level ──────────────────────────────────
  const hunks = diffArrays(prevChunks, currChunks)

  // ── Step 4 & 5: Extract meaningful changed chunks ─────────────────────────
  const chunks: DiffChunk[] = []
  let addedCount = 0
  let removedCount = 0

  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i]

    if (!hunk.added && !hunk.removed) continue // unchanged section

    if (hunk.removed) {
      const next = hunks[i + 1]

      if (next?.added) {
        // ── Rewritten section (removed then added) → type: 'changed' ─────────
        const oldText = hunk.value.join('\n')
        const newText = next.value.join('\n')

        if (newText.length >= MIN_MEANINGFUL_CHARS) {
          chunks.push({ type: 'changed', content: newText, previousContent: oldText })
          removedCount += hunk.value.length
          addedCount += next.value.length
        }
        i++ // consumed the next hunk
      } else {
        // ── Pure removal ──────────────────────────────────────────────────────
        const text = hunk.value.join('\n')
        if (text.length >= MIN_MEANINGFUL_CHARS) {
          chunks.push({ type: 'removed', content: text })
          removedCount += hunk.value.length
        }
      }
    } else if (hunk.added) {
      // ── Pure addition ─────────────────────────────────────────────────────
      const text = hunk.value.join('\n')
      if (text.length >= MIN_MEANINGFUL_CHARS) {
        chunks.push({ type: 'added', content: text })
        addedCount += hunk.value.length
      }
    }
  }

  // Hash differed but all deltas were below the noise threshold
  if (chunks.length === 0) {
    return {
      change_detected: false,
      change_summary: 'Hash changed but differences are below the noise threshold (formatting only)',
      changed_chunks: [],
      stats: { added_paragraphs: 0, removed_paragraphs: 0, total_chunks: 0, estimated_tokens: 0 },
    }
  }

  const allChangedText = chunks.map((c) => c.content).join('\n')
  const estimated_tokens = estimateTokens(allChangedText)

  return {
    change_detected: true,
    change_summary: buildSummary(addedCount, removedCount, chunks.length),
    changed_chunks: chunks,
    stats: { added_paragraphs: addedCount, removed_paragraphs: removedCount, total_chunks: chunks.length, estimated_tokens },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function noChange(): DiffResult {
  return {
    change_detected: false,
    change_summary: 'No changes detected',
    changed_chunks: [],
    stats: { added_paragraphs: 0, removed_paragraphs: 0, total_chunks: 0, estimated_tokens: 0 },
  }
}

function buildSummary(added: number, removed: number, total: number): string {
  const parts: string[] = []
  if (added > 0) parts.push(`${added} section${added !== 1 ? 's' : ''} added`)
  if (removed > 0) parts.push(`${removed} section${removed !== 1 ? 's' : ''} removed`)
  return `${parts.join(', ')} (${total} meaningful chunk${total !== 1 ? 's' : ''})`
}
