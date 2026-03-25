import { describe, it, expect } from 'vitest'
import { getRelevantUrls, normalizeBase } from '@/lib/crawler/urls'

describe('normalizeBase', () => {
  it('adds https when no protocol provided', () => {
    expect(normalizeBase('example.com')).toBe('https://example.com')
  })

  it('strips trailing slash', () => {
    expect(normalizeBase('https://example.com/')).toBe('https://example.com')
  })

  it('preserves http protocol', () => {
    expect(normalizeBase('http://example.com')).toBe('http://example.com')
  })

  it('keeps subdomain', () => {
    expect(normalizeBase('https://www.kraken.com')).toBe('https://www.kraken.com')
  })

  it('strips path — only origin is kept', () => {
    expect(normalizeBase('https://example.com/some/path')).toBe('https://example.com')
  })
})

describe('getRelevantUrls', () => {
  it('returns a non-empty list of targets', () => {
    const targets = getRelevantUrls('https://example.com')
    expect(targets.length).toBeGreaterThan(0)
  })

  it('always includes a landing page target', () => {
    const targets = getRelevantUrls('https://example.com')
    const landing = targets.find((t) => t.type === 'landing')
    expect(landing).toBeDefined()
    expect(landing!.url).toBe('https://example.com/')
  })

  it('covers all four non-landing page types', () => {
    const targets = getRelevantUrls('https://example.com')
    const types = new Set(targets.map((t) => t.type))
    expect(types).toContain('pricing')
    expect(types).toContain('features')
    expect(types).toContain('blog')
    expect(types).toContain('faq')
  })

  it('produces syntactically valid URLs', () => {
    const targets = getRelevantUrls('example.com') // no protocol
    expect(() => targets.forEach((t) => new URL(t.url))).not.toThrow()
  })

  it('all URLs start with the normalised base', () => {
    const targets = getRelevantUrls('https://kraken.com/')
    targets.forEach((t) => {
      expect(t.url.startsWith('https://kraken.com')).toBe(true)
    })
  })

  it('each target has a defined type', () => {
    const targets = getRelevantUrls('https://example.com')
    targets.forEach((t) => {
      expect(t.type).toBeTruthy()
    })
  })
})
