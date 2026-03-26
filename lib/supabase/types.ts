// Auto-generate the full version with: npx supabase gen types typescript --local
// This file provides hand-written types for use before codegen is set up.

export type CompetitorType = 'crypto_exchange' | 'bank' | 'hybrid'

export type CompetitorDomain = {
  url: string
  label?: string
}

export type Competitor = {
  id: string
  name: string
  type: CompetitorType
  region: string
  domains: CompetitorDomain[]
  created_at: string
  updated_at: string
}

export type Criteria = {
  id: string
  name: string
  category: string
  parent_id: string | null
  position: number
  created_at: string
}

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed'

export type Scan = {
  id: string
  competitor_id: string
  status: ScanStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type Page = {
  id: string
  competitor_id: string
  scan_id: string
  url: string
  content_hash: string
  raw_html: string | null
  cleaned_text: string | null
  scanned_at: string
}

export type ChangeType = 'new_page' | 'content_changed' | 'removed'

export type ChangeEvent = {
  id: string
  page_id: string
  scan_id: string
  change_type: ChangeType
  diff_summary: string | null
  created_at: string
}

export type Confidence = 'high' | 'medium' | 'low'

export type DataPoint = {
  id: string
  competitor_id: string
  criteria_id: string
  scan_id: string | null
  value: string
  normalized_value: string | null
  confidence: Confidence
  source_url: string | null
  created_at: string
  updated_at: string
}

export type InsightType =
  | 'executive_summary'
  | 'strategic_recommendation'
  | 'change_highlight'
  | 'benchmark'

export type Insight = {
  id: string
  competitor_id: string
  scan_id: string | null
  type: InsightType
  content: string
  created_at: string
}

// -------------------------------------------------------------
// Composite types used in UI views
// -------------------------------------------------------------

/** One row in the comparison table: criteria + values per competitor */
export type ComparisonRow = {
  criteria: Criteria
  values: Record<string, DataPoint | null> // keyed by competitor_id
}

/** Competitor detail page: all data in one shape */
export type CompetitorDetail = {
  competitor: Competitor
  latestScan: Scan | null
  insights: Insight[]
  dataPoints: DataPoint[]
  recentChanges: ChangeEvent[]
}
