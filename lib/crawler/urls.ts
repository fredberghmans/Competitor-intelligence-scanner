import * as cheerio from 'cheerio'
import type { CrawlTarget, PageType } from './types'

/**
 * Candidate paths per page type, in priority order.
 *
 * We try all of them; the fetch stage filters out non-200s and the
 * orchestrator deduplicates by final URL (handles redirects like
 * /plans → /pricing automatically).
 *
 * Keep this list short and high-signal. Avoid deep paths — the goal is to
 * find the primary page for each topic, not to crawl the whole site.
 */
const CANDIDATES: Array<{ path: string; type: PageType }> = [
  // Landing
  { path: '/', type: 'landing' },

  // Pricing
  { path: '/pricing', type: 'pricing' },
  { path: '/plans', type: 'pricing' },
  { path: '/price', type: 'pricing' },

  // Features / products
  { path: '/features', type: 'features' },
  { path: '/products', type: 'features' },
  { path: '/platform', type: 'features' },
  { path: '/solutions', type: 'features' },

  // Blog / news
  { path: '/blog', type: 'blog' },
  { path: '/news', type: 'blog' },
  { path: '/updates', type: 'blog' },

  // FAQ / help
  { path: '/faq', type: 'faq' },
  { path: '/help', type: 'faq' },
  { path: '/support', type: 'faq' },
]

/**
 * Returns all candidate URLs to crawl for a given domain.
 *
 * Does NOT make network requests — it simply constructs URLs from the
 * candidate list. The fetch stage validates them (skipping 404s, non-HTML,
 * timeouts) and the orchestrator deduplicates by final URL.
 *
 * This keeps URL discovery fast and deterministic.
 */
export function getRelevantUrls(domain: string): CrawlTarget[] {
  const base = normalizeBase(domain)
  return CANDIDATES.map(({ path, type }) => ({ url: `${base}${path}`, type }))
}

/**
 * Strips trailing slashes and ensures the URL has a protocol.
 * Normalises to https by default.
 */
export function normalizeBase(url: string): string {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(withProtocol)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return `https://${url.replace(/\/$/, '')}`
  }
}

/**
 * Keywords used to decide whether a discovered link is worth crawling.
 * Covers the common criteria categories: fees, regulation, products, about, crypto.
 * Exported so the crawler can reuse these for Markdown link filtering (Jina pages).
 */
export const RELEVANT_PATH_KEYWORDS = [
  // Fees & pricing
  'fee', 'fees', 'pricing', 'price', 'prices', 'cost', 'costs', 'tariff', 'rate', 'rates', 'charge', 'charges',
  // About / company
  'about', 'company', 'group', 'team', 'management', 'overview', 'history', 'who-we-are',
  // Regulatory / legal
  'regulat', 'compliance', 'license', 'licen', 'legal', 'governance', 'disclosure',
  // Crypto / digital assets
  'crypto', 'bitcoin', 'blockchain', 'digital-asset', 'digital-assets', 'custody', 'token',
  // Products & services
  'product', 'service', 'solution', 'platform', 'offering', 'invest', 'trading', 'wealth', 'banking',
]

/**
 * Extracts internal links from an HTML page that are likely to contain relevant content.
 *
 * Only returns same-host links whose path contains at least one relevance keyword.
 * Strips query strings and fragments to keep URLs canonical.
 */
export function extractInternalLinks(html: string, pageUrl: string): string[] {
  let base: URL
  try {
    base = new URL(pageUrl)
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const links: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

    let resolved: URL
    try {
      resolved = new URL(href, base)
    } catch {
      return
    }

    // Same host only
    if (resolved.host !== base.host) return

    // Canonical form: strip query + fragment
    const canonical = `${resolved.protocol}//${resolved.host}${resolved.pathname.replace(/\/$/, '') || '/'}`

    if (seen.has(canonical)) return
    seen.add(canonical)

    const path = resolved.pathname.toLowerCase()
    const isRelevant = RELEVANT_PATH_KEYWORDS.some((kw) => path.includes(kw))
    if (isRelevant) links.push(canonical)
  })

  return links
}
