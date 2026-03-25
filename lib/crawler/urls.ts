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
