import { describe, it, expect } from 'vitest'
import { splitIntoChunks, estimateTokens } from '@/lib/diff/chunker'

describe('splitIntoChunks', () => {
  it('splits text on double newlines (paragraph breaks)', () => {
    const text = [
      'First paragraph with enough content to pass the filter.',
      'Second paragraph with enough content to pass the filter.',
    ].join('\n\n')
    expect(splitIntoChunks(text)).toHaveLength(2)
  })

  it('filters out chunks shorter than 40 characters', () => {
    const text = 'Tiny.\n\nThis paragraph is long enough to pass the minimum length filter easily.'
    const chunks = splitIntoChunks(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('long enough')
  })

  it('returns empty array for empty string', () => {
    expect(splitIntoChunks('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(splitIntoChunks('   \n\n   \n\n   ')).toEqual([])
  })

  it('trims each chunk', () => {
    const text = '  Padded paragraph with sufficient length to pass the filter.  \n\n  Another padded paragraph that is also long enough.  '
    splitIntoChunks(text).forEach((chunk) => {
      expect(chunk).toBe(chunk.trim())
    })
  })

  it('further splits blocks longer than 600 chars on single newlines', () => {
    // 10 lines joined by \n — no blank lines, total > 600 chars
    const longBlock = Array.from({ length: 10 }, (_, i) =>
      `Line ${i + 1}: This sentence is long enough to contribute meaningfully to the total block length.`,
    ).join('\n')
    expect(longBlock.length).toBeGreaterThan(600)
    const chunks = splitIntoChunks(longBlock)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('handles a single long paragraph without splitting', () => {
    const para = 'This is a single paragraph that is under 600 characters and should remain as one chunk without being split further by the algorithm.'
    const chunks = splitIntoChunks(para)
    expect(chunks).toHaveLength(1)
  })
})

describe('estimateTokens', () => {
  it('returns a positive integer for non-empty text', () => {
    const tokens = estimateTokens('hello world')
    expect(tokens).toBeGreaterThan(0)
    expect(Number.isInteger(tokens)).toBe(true)
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('scales monotonically with text length', () => {
    const a = estimateTokens('short text')
    const b = estimateTokens('This is a considerably longer piece of text that should result in a higher token estimate than the short version.')
    expect(b).toBeGreaterThan(a)
  })

  it('uses ~4 chars per token (English text)', () => {
    // 400 chars ≈ 100 tokens
    const text = 'a'.repeat(400)
    expect(estimateTokens(text)).toBe(100)
  })
})
