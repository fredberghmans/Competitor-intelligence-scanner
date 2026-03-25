import type { FetchResult } from './types'

const USER_AGENT =
  'Mozilla/5.0 (compatible; CompetitorScanner/1.0; public data research)'

export type FetchOptions = {
  /** Hard timeout per attempt in ms. Default: 12000 */
  timeoutMs?: number
  /** Maximum number of retry attempts after the first try. Default: 2 */
  maxRetries?: number
}

/**
 * Fetches a URL and returns the HTML, or null if the page should be skipped.
 *
 * Skips:
 *   - Non-200 responses (404, 403, 5xx, etc.)
 *   - Non-HTML content types (PDFs, JSON, images, etc.)
 *   - Timeouts that exceed `timeoutMs` on every attempt
 *
 * Retries with exponential backoff (2 s, 4 s) on network errors.
 * Does NOT retry on timeout — a slow site is likely permanently slow.
 *
 * Follows redirects automatically via `redirect: 'follow'`. The returned
 * `url` is the final URL after redirects, which the orchestrator uses to
 * deduplicate pages (e.g. /plans → /pricing).
 */
export async function fetchPage(
  url: string,
  { timeoutMs = 12_000, maxRetries = 2 }: FetchOptions = {},
): Promise<FetchResult | null> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s then 4s
      await sleep(1_000 * 2 ** attempt)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          // Avoid cached/compressed responses that complicate parsing
          'Cache-Control': 'no-cache',
        },
      })

      clearTimeout(timer)

      // Only process successful HTML pages
      const contentType = res.headers.get('content-type') ?? ''
      if (!res.ok || !contentType.includes('text/html')) return null

      const html = await res.text()
      return { url: res.url, html, status: res.status }
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err : new Error(String(err))

      // Timeout — don't retry, move on
      if (lastError.name === 'AbortError') {
        console.warn(`[crawler] Timeout fetching ${url}`)
        return null
      }

      console.warn(`[crawler] Attempt ${attempt + 1} failed for ${url}: ${lastError.message}`)
    }
  }

  console.warn(`[crawler] All retries exhausted for ${url}: ${lastError?.message}`)
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
