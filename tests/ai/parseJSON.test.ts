import { describe, it, expect } from 'vitest'
import { parseJSON } from '@/lib/ai/client'

describe('parseJSON', () => {
  it('parses a plain JSON object', () => {
    const result = parseJSON<{ foo: string }>('{"foo": "bar"}')
    expect(result.foo).toBe('bar')
  })

  it('parses a plain JSON array', () => {
    const result = parseJSON<number[]>('[1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })

  it('parses JSON wrapped in ```json fences (common Claude output)', () => {
    const raw = '```json\n{"criteria": ["pricing"], "relevance": "high"}\n```'
    const result = parseJSON<{ criteria: string[]; relevance: string }>(raw)
    expect(result.criteria).toEqual(['pricing'])
    expect(result.relevance).toBe('high')
  })

  it('parses JSON wrapped in plain ``` fences', () => {
    const raw = '```\n{"value": "5% APY"}\n```'
    const result = parseJSON<{ value: string }>(raw)
    expect(result.value).toBe('5% APY')
  })

  it('parses JSON embedded in surrounding prose', () => {
    const raw = 'Here is my analysis: {"confidence": "high", "value": "0.16% maker fee"} based on the text.'
    const result = parseJSON<{ confidence: string; value: string }>(raw)
    expect(result.confidence).toBe('high')
  })

  it('parses a JSON array embedded in prose', () => {
    const raw = 'The extracted points are: [{"criteria_name": "pricing", "value": "5% APY"}]'
    const result = parseJSON<Array<{ criteria_name: string; value: string }>>(raw)
    expect(result).toHaveLength(1)
    expect(result[0].criteria_name).toBe('pricing')
  })

  it('handles nested objects correctly', () => {
    const raw = '{"executive_summary": {"tldr": "Strong exchange", "strengths": ["low fees", "deep liquidity"]}}'
    const result = parseJSON<{ executive_summary: { tldr: string; strengths: string[] } }>(raw)
    expect(result.executive_summary.tldr).toBe('Strong exchange')
    expect(result.executive_summary.strengths).toHaveLength(2)
  })

  it('throws on completely unparseable input', () => {
    expect(() => parseJSON('This is just plain text with no JSON anywhere')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => parseJSON('')).toThrow()
  })
})
