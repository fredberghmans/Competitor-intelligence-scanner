import type { Competitor } from '@/lib/supabase/types'
import type { CrawledPage, CrawlError, CrawlOptions, CrawlOutput } from './types'
import { getRelevantUrls, extractInternalLinks, RELEVANT_PATH_KEYWORDS } from './urls'
import { fetchPage, fetchPageWithFallback } from './fetch'
import { cleanContent } from './clean'
import { generateHash } from './hash'

export type { CrawledPage, CrawlOutput, CrawlOptions, CrawlTarget } from './types'
export { getRelevantUrls, extractInternalLinks } from './urls'
export { fetchPage, fetchPageWithFallback } from './fetch'
export { cleanContent, extractTitle } from './clean'
export { generateHash } from './hash'

const DEFAULTS = {
  rateLimitMs: 1_500, // 1.5 s between requests — polite but not slow
  timeoutMs: 12_000,
  maxDiscoveredPages: 30, // cap on extra pages found via link discovery per domain
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

    // Collect raw HTML from crawled pages so we can discover deeper links
    const crawledHtml: Array<{ url: string; html: string; source?: 'direct' | 'jina' }> = []

    for (const target of targets) {
      // Rate limit: pause before every request except the very first overall
      if (seenUrls.size > 0 || errors.length > 0) {
        await sleep(rateLimitMs)
      }

      console.log(`[crawler] Fetching ${target.url}`)
      const result = await fetchPageWithFallback(target.url, { timeoutMs })

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

      const cleaned = cleanContent(result.html, result.source)

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

      crawledHtml.push({ url: result.url, html: result.html, source: result.source })

      console.log(`[crawler] ✓ ${result.url} (${cleaned.length} chars, hash: ${hash.slice(0, 8)}…)`)
    }

    // ── Link discovery ──────────────────────────────────────────────────────
    // Extract relevant internal links from every page crawled for this domain,
    // then fetch the ones we haven't visited yet (capped to avoid runaway crawls).
    const discoveredUrls = new Set<string>()
    for (const { url, html, source } of crawledHtml) {
      const links = source === 'jina'
        ? extractMarkdownLinks(html, url)
        : extractInternalLinks(html, url)
      for (const link of links) {
        if (!seenUrls.has(link)) discoveredUrls.add(link)
      }
    }

    const toVisit = [...discoveredUrls].slice(0, DEFAULTS.maxDiscoveredPages)
    if (toVisit.length > 0) {
      console.log(
        `[crawler] ${competitor.name} — discovered ${toVisit.length} additional relevant link(s) on ${domain.url}`,
      )
    }

    for (const url of toVisit) {
      await sleep(rateLimitMs)

      console.log(`[crawler] Fetching (discovered) ${url}`)
      const result = await fetchPageWithFallback(url, { timeoutMs })

      if (!result) {
        errors.push({ url, reason: 'fetch failed, timeout, or non-HTML' })
        continue
      }

      if (seenUrls.has(result.url)) {
        console.log(`[crawler] Skipping duplicate: ${result.url}`)
        continue
      }
      seenUrls.add(result.url)

      const cleaned = cleanContent(result.html, result.source)

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

      console.log(`[crawler] ✓ (discovered) ${result.url} (${cleaned.length} chars)`)
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

/**
 * Extracts relevant internal links from Jina Reader Markdown output.
 * Jina returns [text](url) format — cheerio won't work on this.
 */
function extractMarkdownLinks(markdown: string, pageUrl: string): string[] {
  let base: URL
  try { base = new URL(pageUrl) } catch { return [] }

  const MD_LINK_RE = /\[(?:[^\]]*)\]\((https?:\/\/[^)]+)\)/g
  const seen = new Set<string>()
  const links: string[] = []
  let match: RegExpExecArray | null

  while ((match = MD_LINK_RE.exec(markdown)) !== null) {
    const href = match[1]
    let resolved: URL
    try { resolved = new URL(href) } catch { continue }
    if (resolved.host !== base.host) continue
    const canonical = `${resolved.protocol}//${resolved.host}${resolved.pathname.replace(/\/$/, '') || '/'}`
    if (seen.has(canonical)) continue
    seen.add(canonical)
    const path = resolved.pathname.toLowerCase()
    if (RELEVANT_PATH_KEYWORDS.some((kw) => path.includes(kw))) {
      links.push(canonical)
    }
  }
  return links
}
