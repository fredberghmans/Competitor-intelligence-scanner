import { describe, it, expect } from 'vitest'
import { cleanContent, extractTitle } from '@/lib/crawler/clean'

const FULL_PAGE = `
<html>
  <head><title>Kraken Pricing</title></head>
  <body>
    <nav>Home | Pricing | Blog</nav>
    <header>Site header</header>
    <main>
      <h1>Trading Fees</h1>
      <p>Our spot trading fee is 0.16% for makers and 0.26% for takers.</p>
      <p>Staking yield: up to 5% APY on eligible assets.</p>
      <p>Custody options include cold storage and multi-sig wallets.</p>
    </main>
    <aside>Related articles</aside>
    <footer>© 2024 Kraken</footer>
    <script>window.__DATA__ = {}; analytics.track('pageview');</script>
    <style>.hidden { display: none }</style>
  </body>
</html>
`

describe('cleanContent', () => {
  it('removes <script> tags and their content', () => {
    const text = cleanContent(FULL_PAGE)
    expect(text).not.toContain('analytics')
    expect(text).not.toContain('pageview')
  })

  it('removes <style> tags', () => {
    expect(cleanContent(FULL_PAGE)).not.toContain('display: none')
  })

  it('removes <nav> elements', () => {
    expect(cleanContent(FULL_PAGE)).not.toContain('Home | Pricing | Blog')
  })

  it('removes <header> elements', () => {
    expect(cleanContent(FULL_PAGE)).not.toContain('Site header')
  })

  it('removes <footer> elements', () => {
    expect(cleanContent(FULL_PAGE)).not.toContain('© 2024 Kraken')
  })

  it('removes <aside> elements', () => {
    expect(cleanContent(FULL_PAGE)).not.toContain('Related articles')
  })

  it('preserves main content text', () => {
    const text = cleanContent(FULL_PAGE)
    expect(text).toContain('0.16%')
    expect(text).toContain('Staking yield')
    expect(text).toContain('Custody options')
  })

  it('collapses excess whitespace', () => {
    const text = cleanContent(FULL_PAGE)
    expect(text).not.toMatch(/\n{3,}/)   // no triple newlines
    expect(text).not.toMatch(/[ \t]{2,}/) // no double spaces
  })

  it('does not throw on empty input', () => {
    expect(() => cleanContent('')).not.toThrow()
  })

  it('does not throw on malformed HTML', () => {
    expect(() => cleanContent('<div>unclosed <p>tags')).not.toThrow()
  })

  it('returns a trimmed string', () => {
    const text = cleanContent(FULL_PAGE)
    expect(text).toBe(text.trim())
  })
})

describe('extractTitle', () => {
  it('extracts the <title> tag content', () => {
    expect(extractTitle(FULL_PAGE)).toBe('Kraken Pricing')
  })

  it('returns empty string when no <title> tag exists', () => {
    expect(extractTitle('<html><body>no title here</body></html>')).toBe('')
  })

  it('trims whitespace from the title', () => {
    expect(extractTitle('<html><head><title>  Spaced Title  </title></head></html>')).toBe('Spaced Title')
  })
})
