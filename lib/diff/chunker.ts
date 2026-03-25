/**
 * Splits cleaned page text into comparable paragraphs.
 *
 * WHY PARAGRAPHS, NOT LINES OR CHARACTERS?
 *
 * Line-level diff: too granular — a reflow in a paragraph triggers dozens of
 * changes even though the meaning didn't change.
 *
 * Character-level diff: even worse — every punctuation fix produces noise.
 *
 * Paragraph-level diff: each unit of meaning is a chunk. A pricing plan
 * description, a feature bullet, or an FAQ answer is typically one chunk.
 * This means:
 *   - Changed sections are self-contained and readable
 *   - The AI receives focused, meaningful diffs instead of character soup
 *   - Token counts stay proportional to actual semantic change
 */

/** Paragraphs shorter than this are usually navigation labels or UI noise. */
const MIN_CHUNK_CHARS = 40

/**
 * A single block longer than this is likely a large body of text that was
 * not split by double newlines. We further split it on single newlines.
 */
const MAX_BLOCK_CHARS = 600

export function splitIntoChunks(text: string): string[] {
  return (
    text
      // Primary split: blank lines (the natural paragraph break in cleaned text)
      .split(/\n{2,}/)
      .flatMap((block) => {
        // Secondary split: long blocks that lack blank lines
        if (block.length > MAX_BLOCK_CHARS) {
          return block.split('\n')
        }
        return [block]
      })
      .map((chunk) => chunk.trim())
      // Drop chunks that are too short to be meaningful
      .filter((chunk) => chunk.length >= MIN_CHUNK_CHARS)
  )
}

/**
 * Rough token estimator (1 token ≈ 4 chars for English text).
 * Used only for cost budgeting — not passed to any tokeniser.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
