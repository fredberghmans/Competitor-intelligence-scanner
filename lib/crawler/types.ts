// ---------------------------------------------------------------------------
// Crawler types — independent of Supabase types so the crawler stays portable
// ---------------------------------------------------------------------------

export type PageType = 'landing' | 'pricing' | 'features' | 'blog' | 'faq'

/** A candidate URL to crawl, with its intended page type. */
export type CrawlTarget = {
  url: string
  type: PageType
}

/** Raw result returned by fetchPage — before cleaning or hashing. */
export type FetchResult = {
  /** Final URL after redirects (used for deduplication). */
  url: string
  html: string
  status: number
  /** 'jina' when content was fetched via Jina Reader (already clean markdown). */
  source?: 'direct' | 'jina'
}

/**
 * A fully processed page, shaped for direct insertion into the `pages` table.
 * Matches the Page type in lib/supabase/types.ts.
 */
export type CrawledPage = {
  competitor_id: string
  scan_id: string
  url: string
  content_hash: string
  raw_html: string
  cleaned_text: string
  scanned_at: string // ISO 8601
}

export type CrawlError = {
  url: string
  reason: string
}

export type CrawlOutput = {
  pages: CrawledPage[]
  errors: CrawlError[]
}

export type CrawlOptions = {
  competitorId: string
  scanId: string
  /** Milliseconds to wait between requests to the same domain. Default: 1500 */
  rateLimitMs?: number
  /** Per-request timeout in ms. Default: 12000 */
  timeoutMs?: number
}
