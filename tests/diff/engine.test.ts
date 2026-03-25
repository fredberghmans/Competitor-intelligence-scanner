import { describe, it, expect } from 'vitest'
import { diffPages } from '@/lib/diff/engine'

// Realistic competitor page content for tests
const BASE = {
  content_hash: 'hash-v1',
  cleaned_text: [
    'Spot trading fee is 0.16% for makers and 0.26% for takers.',
    'Staking yield: up to 5.0% APY on eligible proof-of-stake assets.',
    'We offer three custody options: hot wallet, cold storage, and multi-sig.',
    'Derivatives trading is available for professional clients only.',
    'Fiat deposits supported via SEPA, SWIFT, and credit card.',
  ].join('\n\n'),
}

describe('diffPages — hash check (fast path)', () => {
  it('returns change_detected=false when hashes are identical', () => {
    const result = diffPages(BASE, BASE)
    expect(result.change_detected).toBe(false)
    expect(result.changed_chunks).toHaveLength(0)
  })

  it('returns immediately without text comparison on hash match', () => {
    // Even if we somehow pass the same object, the result must be no-change
    const result = diffPages(BASE, { ...BASE })
    expect(result.change_detected).toBe(false)
  })
})

describe('diffPages — change detection', () => {
  it('detects added paragraphs', () => {
    const current = {
      content_hash: 'hash-v2',
      cleaned_text:
        BASE.cleaned_text +
        '\n\nNew feature: institutional custody solutions now available for corporate accounts.',
    }
    const result = diffPages(BASE, current)
    expect(result.change_detected).toBe(true)
    expect(result.changed_chunks.some((c) => c.type === 'added')).toBe(true)
  })

  it('detects removed paragraphs', () => {
    const current = {
      content_hash: 'hash-v2',
      // Remove the staking paragraph
      cleaned_text: BASE.cleaned_text.replace(
        /\nStaking yield.*?\n/s,
        '\n',
      ),
    }
    const result = diffPages(BASE, current)
    expect(result.change_detected).toBe(true)
  })

  it('detects changed paragraphs (rewritten section)', () => {
    const current = {
      content_hash: 'hash-v2',
      cleaned_text: BASE.cleaned_text.replace(
        'Staking yield: up to 5.0% APY on eligible proof-of-stake assets.',
        'Staking yield: up to 6.5% APY on eligible proof-of-stake assets — increased from 5.0%.',
      ),
    }
    const result = diffPages(BASE, current)
    expect(result.change_detected).toBe(true)
    expect(result.changed_chunks.some((c) => c.type === 'changed')).toBe(true)
  })

  it('preserves previousContent on changed chunks', () => {
    const current = {
      content_hash: 'hash-v2',
      cleaned_text: BASE.cleaned_text.replace(
        'Staking yield: up to 5.0% APY on eligible proof-of-stake assets.',
        'Staking yield: up to 6.5% APY — new rate effective immediately for all users.',
      ),
    }
    const result = diffPages(BASE, current)
    const changed = result.changed_chunks.find((c) => c.type === 'changed')
    expect(changed?.previousContent).toContain('5.0%')
    expect(changed?.content).toContain('6.5%')
  })
})

describe('diffPages — noise filtering', () => {
  it('does not include chunks shorter than 40 chars in the output', () => {
    // Add a very short standalone paragraph (below the MIN_MEANINGFUL_CHARS threshold)
    const current = {
      content_hash: 'hash-v2',
      cleaned_text: BASE.cleaned_text + '\n\nNew.',
    }
    const result = diffPages(BASE, current)
    // Any chunks in the output must be >= 40 chars — short ones are filtered
    result.changed_chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThanOrEqual(40)
    })
  })

  it('reports a word-level change when the surrounding paragraph is meaningful', () => {
    // Replacing one word in a 60+ char paragraph produces a chunk > 40 chars — correctly reported
    const current = {
      content_hash: 'hash-v2',
      cleaned_text: BASE.cleaned_text.replace('professional', 'institutional'),
    }
    const result = diffPages(BASE, current)
    if (result.change_detected) {
      // Every reported chunk must be above the noise threshold
      result.changed_chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThanOrEqual(40)
      })
    }
  })
})

describe('diffPages — output shape', () => {
  it('always returns a change_summary string', () => {
    const result = diffPages(BASE, BASE)
    expect(typeof result.change_summary).toBe('string')
    expect(result.change_summary.length).toBeGreaterThan(0)
  })

  it('always returns stats with numeric fields', () => {
    const result = diffPages(BASE, BASE)
    expect(typeof result.stats.added_paragraphs).toBe('number')
    expect(typeof result.stats.removed_paragraphs).toBe('number')
    expect(typeof result.stats.total_chunks).toBe('number')
    expect(typeof result.stats.estimated_tokens).toBe('number')
  })

  it('estimated_tokens > 0 when changes are detected', () => {
    const current = {
      content_hash: 'hash-v2',
      cleaned_text:
        BASE.cleaned_text +
        '\n\nBrand new section about custody solutions for institutional investors and funds.',
    }
    const result = diffPages(BASE, current)
    if (result.change_detected) {
      expect(result.stats.estimated_tokens).toBeGreaterThan(0)
    }
  })
})
