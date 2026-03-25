import * as cheerio from 'cheerio'

/**
 * Elements that add noise but carry no intelligence value.
 * Removed before text extraction.
 */
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'header',
  'footer',
  'aside',
  'iframe',
  'svg',
  'img',
  'figure',
  // ARIA roles
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  // Common class names for non-content UI
  '[class*="cookie"]',
  '[class*="banner"]',
  '[class*="popup"]',
  '[class*="modal"]',
  '[class*="overlay"]',
  '[id*="cookie"]',
  '[id*="chat"]',
]

/**
 * Converts raw HTML into clean, readable plain text.
 *
 * Strategy:
 *   1. Parse the full HTML document with cheerio
 *   2. Strip noise elements (nav, footer, scripts, etc.)
 *   3. Extract text from <main> or <body> (whichever is more specific)
 *   4. Collapse whitespace and remove empty lines
 *
 * The result is deterministic — same HTML always produces the same text —
 * which is essential for reliable hash-based change detection.
 *
 * Note: This does not execute JavaScript. Content rendered client-side
 * (React SPAs, etc.) will be missing. See TRADEOFFS.md for details.
 */
export function cleanContent(html: string, source?: 'direct' | 'jina'): string {
  // Jina Reader already returns clean Markdown — skip cheerio and just normalise whitespace
  if (source === 'jina') {
    return html
      .replace(/\t/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 1)
      .join('\n')
      .trim()
  }

  const $ = cheerio.load(html)

  // Remove noise elements
  $(NOISE_SELECTORS.join(', ')).remove()

  // Prefer <main> for focused content; fall back to <body>
  const root = $('main').length ? $('main') : $('body')

  const rawText = root.text()

  return rawText
    .replace(/\t/g, ' ')          // tabs → spaces
    .replace(/[ \t]{2,}/g, ' ')   // collapse multiple spaces
    .replace(/\n{3,}/g, '\n\n')   // max two consecutive newlines
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 1) // drop single-char lines (stray punctuation)
    .join('\n')
    .trim()
}

/**
 * Extracts the page <title> from raw HTML.
 * Useful for labelling stored pages without re-parsing cleaned text.
 */
export function extractTitle(html: string): string {
  const $ = cheerio.load(html)
  return $('title').first().text().trim()
}
