import { describe, it, expect } from 'vitest'
import { generateHash } from '@/lib/crawler/hash'

describe('generateHash', () => {
  it('produces a 64-character hex string', () => {
    const hash = generateHash('hello world')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('is deterministic — same input always yields same hash', () => {
    const content = 'Staking yield: 5% APY for all users'
    expect(generateHash(content)).toBe(generateHash(content))
  })

  it('is sensitive — different inputs produce different hashes', () => {
    expect(generateHash('staking yield: 5%')).not.toBe(generateHash('staking yield: 6%'))
  })

  it('handles empty string without throwing', () => {
    expect(() => generateHash('')).not.toThrow()
    expect(generateHash('')).toHaveLength(64)
  })

  it('handles unicode content', () => {
    const hash = generateHash('Gebühren: 0.1% · Staking: 5%')
    expect(hash).toHaveLength(64)
  })
})
