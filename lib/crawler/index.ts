import type { Competitor } from '@/lib/supabase/types'
import type { CrawledPage, CrawlError, CrawlOptions, CrawlOutput } from './types'
import { getRelevantUrls } from './urls'
import { fetchPage } from './fetch'
import { cleanContent } from './clean'
import { generateHash } from './hash'

export type { CrawledPage, CrawlOutput, CrawlOptions, CrawlTarget } from './types'
export { getRelevantUrls } from './urls'
export { fetchPage } from './fetch'
export { cleanContent, extractTitle } from './clean'
export { generateHash } from './hash'

const DEFAULTS = {
  rateLimitMs: 1_500, // 1.5 s between requests — polite but not slow
  timeoutMs: 12_000,
}

/**
 * Crawls all relevant pages for a competitor across all its configured domains.
 *
 * For each domain:
 *   1. Build candidate URLs (getRelevantUrls)
 *   2. Fetch each URL respecting rate limiting and timeouts
 *   3. Skip non-HTML, 404s, and timeouts
 *   4. Deduplicate by final URL (handles cross-domain and redirect overlaps)
 *   5. Clean the HTML and generate a content hash
 *   6. Return structured CrawledPage objects ready for DB insertion
 *
 * No AI is involved at this stage. The crawler is purely deterministic.
 * Change detection happens later by comparing content_hash values.
 *
 * @example
 * const { pages, errors } = await crawlCompetitor(competitor, {
 *   competitorId: competitor.id,
 *   scanId: scan.id,
 * })
 * // Insert pages into Supabase pages table
 */
export async function crawlCompetitor(
  competitor: Competitor,
  options: CrawlOptions,
): Promise<CrawlOutput> {
  const { competitorId, scanId, rateLimitMs = DEFAULTS.rateLimitMs, timeoutMs = DEFAULTS.timeoutMs } =
    options

  const pages: CrawledPage[] = []
  const errors: CrawlError[] = []

  // Deduplicate across domains by final URL (after redirects).
  // Prevents double-processing when two domains resolve to the same page.
  const seenUrls = new Set<string>()

  for (const domain of competitor.domains) {
    const targets = getRelevantUrls(domain.url)

    console.log(
      `[crawler] ${competitor.name} — ${domain.url}: ${targets.length} candidates`,
    )

    for (const target of targets) {
      // Rate limit: pause before every request except the very first overall
      if (seenUrls.size > 0 || errors.length > 0) {
        await sleep(rateLimitMs)
      }

      console.log(`[crawler] Fetching ${target.url}`)
      const result = await fetchPage(target.url, { timeoutMs })

      if (!result) {
        errors.push({ url: target.url, reason: 'fetch failed, timeout, or non-HTML' })
        continue
      }

      // Deduplicate — /plans and /pricing may both redirect to /pricing
      if (seenUrls.has(result.url)) {
        console.log(`[crawler] Skipping duplicate: ${result.url}`)
        continue
      }
      seenUrls.add(result.url)

      const cleaned = cleanContent(result.html)

      // Skip pages with no meaningful content (login walls, empty templates)
      if (cleaned.length < 100) {
        errors.push({ url: result.url, reason: 'insufficient content after cleaning' })
        continue
      }

      const hash = generateHash(cleaned)

      pages.push({
        competitor_id: competitorId,
        scan_id: scanId,
        url: result.url,
        content_hash: hash,
        raw_html: result.html,
        cleaned_text: cleaned,
        scanned_at: new Date().toISOString(),
      })

      console.log(`[crawler] ✓ ${result.url} (${cleaned.length} chars, hash: ${hash.slice(0, 8)}…)`)
    }
  }

  console.log(
    `[crawler] Done — ${pages.length} pages crawled, ${errors.length} skipped`,
  )

  return { pages, errors }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
