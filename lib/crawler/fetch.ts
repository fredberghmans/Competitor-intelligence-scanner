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

/**
 * Fetches a URL using Jina Reader (https://r.jina.ai), which runs a headless
 * browser and returns clean Markdown. Handles JavaScript-rendered SPAs and PDFs.
 *
 * Returns null if Jina fails or returns no meaningful content.
 */
async function fetchPageWithJina(
  url: string,
  { timeoutMs = 25_000 }: Pick<FetchOptions, 'timeoutMs'> = {},
): Promise<FetchResult | null> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/plain, text/markdown',
        'X-Return-Format': 'markdown',
      },
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const text = await res.text()
    if (!text || text.length < 100) return null

    return { url, html: text, status: res.status, source: 'jina' }
  } catch (err) {
    clearTimeout(timer)
    console.warn(`[crawler] Jina fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * Fetches a URL with Jina Reader as fallback for thin or PDF content.
 *
 * Strategy:
 *   1. Try a direct static fetch first (fast, free, no rate limits).
 *   2. If the HTML is thin (< 5 KB — a sign of SPA shell) or the URL is a PDF,
 *      fall back to Jina Reader which renders JS and extracts PDFs.
 *   3. Return whichever result has more content.
 */
export async function fetchPageWithFallback(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult | null> {
  const isPdf = /\.pdf(\?|$)/i.test(url)

  if (!isPdf) {
    const direct = await fetchPage(url, options)
    // If we got a rich HTML page (> 5 KB), use it directly
    if (direct && direct.html.length >= 5_000) {
      return { ...direct, source: 'direct' }
    }
    // Thin or missing — fall through to Jina
  }

  const jina = await fetchPageWithJina(url, { timeoutMs: 25_000 })
  return jina
}
