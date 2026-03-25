import type { DiffChunk } from '@/lib/diff'
import type { Criteria, Competitor, DataPoint } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Stage 1 — Classification
// ---------------------------------------------------------------------------

export type Relevance = 'high' | 'medium' | 'low'

export type ClassifiedChunk = {
  chunk: DiffChunk
  /** Criteria names matched by the AI — resolved to IDs in Stage 2 */
  criteria: string[]
  relevance: Relevance
  /** One-line explanation of why the chunk was classified this way */
  reasoning: string
}

// ---------------------------------------------------------------------------
// Stage 2 — Extraction
// ---------------------------------------------------------------------------

export type ExtractedDataPoint = {
  criteria_name: string
  /** Resolved during save — may be undefined if name doesn't match DB */
  criteria_id?: string
  /** The extracted fact, e.g. "Staking yield: 5% APY" */
  value: string
  confidence: 'high' | 'medium'
  source_url: string
  /** Original chunk text — kept for full traceability */
  raw_chunk: string
}

// ---------------------------------------------------------------------------
// Stage 3 — Insights
// ---------------------------------------------------------------------------

export type BenchmarkItem = {
  dimension: string
  competitor_value: string
  our_value?: string
  gap?: string
  direction?: 'ahead' | 'behind' | 'equal' | 'unknown'
}

export type StrategicRecommendation = {
  action: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
}

export type InsightOutput = {
  executive_summary: {
    tldr: string
    strengths: string[]
    weaknesses: string[]
    positioning: string
  }
  changes_summary: {
    summary: string
    highlights: string[]
  }
  benchmarks: BenchmarkItem[]
  recommendations: StrategicRecommendation[]
}

// ---------------------------------------------------------------------------
// Pipeline I/O
// ---------------------------------------------------------------------------

export type PipelineInput = {
  competitor: Competitor
  /** The page URL the chunks came from */
  pageUrl: string
  changedChunks: DiffChunk[]
  criteria: Criteria[]
  scanId: string
  /** Our own data points — enables the decision engine / benchmark stage */
  referenceDataPoints?: DataPoint[]
}

export type PipelineOutput = {
  classified: ClassifiedChunk[]
  dataPoints: ExtractedDataPoint[]
  insights: InsightOutput | null
  /** True when no relevant chunks passed Stage 1 — nothing was processed */
  skipped: boolean
  usage: {
    classificationCalls: number
    extractionCalls: number
    insightCalls: number
  }
}
