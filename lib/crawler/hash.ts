import { createHash } from 'crypto'

/**
 * Generates a SHA-256 hash of the cleaned page content.
 *
 * We hash cleaned_text (not raw HTML) so that cosmetic changes — updated
 * analytics snippets, new script tags, changed ad IDs — do not trigger a
 * false-positive change event. Only meaningful text differences count.
 */
export function generateHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}
