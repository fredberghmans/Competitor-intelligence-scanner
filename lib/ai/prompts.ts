import type { ClassifiedChunk, ExtractedDataPoint } from './types'
import type { Criteria, DataPoint } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Stage 1 — Classification
// ---------------------------------------------------------------------------

export function classificationSystem(): string {
  return `You are a competitive intelligence analyst specialising in fintech and crypto markets.
Your task is to classify text chunks extracted from competitor websites.
You must respond with valid JSON only — no prose, no markdown fences.
Never hallucinate. If a chunk is not relevant to any criteria, say so.`
}

export function classificationUser(chunkText: string, criteria: Criteria[]): string {
  const criteriaList = criteria
    .map((c) => (c.parent_id ? `  - ${c.name} (subcriteria of: ${c.category})` : `- ${c.name}`))
    .join('\n')

  return `Classify this text chunk from a competitor's website.

TEXT CHUNK:
${chunkText}

AVAILABLE CRITERIA:
${criteriaList}

Respond with this JSON structure:
{
  "criteria": ["exact criteria name from the list", "..."],
  "relevance": "high" | "medium" | "low",
  "reasoning": "one sentence explaining the classification"
}

Rules:
- Only use criteria names from the list above, spelled exactly
- relevance "high" = directly relevant, actionable intelligence
- relevance "medium" = useful context
- relevance "low" = marketing noise, irrelevant content
- If no criteria match, return criteria: [] and relevance: "low"`
}

// ---------------------------------------------------------------------------
// Stage 2 — Extraction
// ---------------------------------------------------------------------------

export function extractionSystem(): string {
  return `You are extracting structured intelligence from competitor website content.
You must respond with valid JSON only — no prose, no markdown fences.
Extract only what is explicitly stated. Never invent or infer beyond what the text says.
When in doubt, skip the data point rather than guess.`
}

export function extractionUser(
  chunk: ClassifiedChunk,
  competitorName: string,
  sourceUrl: string,
): string {
  return `Extract structured data points from this competitor content.

COMPETITOR: ${competitorName}
PAGE URL: ${sourceUrl}
CRITERIA: ${chunk.criteria.join(', ')}
CHANGE TYPE: ${chunk.chunk.type}

${chunk.chunk.type === 'changed' && chunk.chunk.previousContent
  ? `PREVIOUS CONTENT:\n${chunk.chunk.previousContent}\n\nCURRENT CONTENT:\n${chunk.chunk.content}`
  : `CONTENT:\n${chunk.chunk.content}`
}

Extract factual data points. Respond with a JSON array:
[
  {
    "criteria_name": "<one of these values, copied verbatim: ${chunk.criteria.map((n, i) => `${i + 1}. ${n}`).join(' | ')}>"
    "value": "concise factual statement, e.g. 'Staking yield: 5% APY'",
    "confidence": "high" | "medium",
    "note": "optional: clarification or caveat"
  }
]

Confidence rules:
- "high" = explicitly and unambiguously stated in the text
- "medium" = clearly implied but not stated verbatim

If nothing concrete can be extracted, return an empty array: []`
}

// ---------------------------------------------------------------------------
// Stage 3 — Insights
// ---------------------------------------------------------------------------

export function insightsSystem(): string {
  return `You are a senior competitive strategist for a fintech/crypto company.
You produce structured intelligence reports based strictly on provided data.
You must respond with valid JSON only — no prose, no markdown fences.
Never hallucinate. Every insight must be grounded in the data provided.
Be specific: use exact values, percentages, and product names when available.`
}

export function insightsUser(
  competitorName: string,
  dataPoints: ExtractedDataPoint[],
  referencePoints?: DataPoint[],
): string {
  const dataSection = dataPoints
    .map((d, i) => `${i + 1}. [${d.criteria_name}] ${d.value} (confidence: ${d.confidence}, source: ${d.source_url})`)
    .join('\n')

  const referenceSection = referencePoints?.length
    ? `\nOUR OWN DATA POINTS (for benchmarking):\n` +
      referencePoints.map((d, i) => `${i + 1}. [criteria_id: ${d.criteria_id}] ${d.value}`).join('\n')
    : ''

  return `Generate a structured intelligence report for this competitor.

COMPETITOR: ${competitorName}

EXTRACTED DATA POINTS:
${dataSection}
${referenceSection}

Respond with this JSON structure:
{
  "executive_summary": {
    "tldr": "2–3 sentence executive overview",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "positioning": "How they position themselves in the market"
  },
  "changes_summary": {
    "summary": "What changed in the most recent scan",
    "highlights": ["key change 1", "key change 2"]
  },
  "benchmarks": [
    {
      "dimension": "metric or feature name",
      "competitor_value": "their value",
      "our_value": "our value if known, else null",
      "gap": "plain-English gap description, e.g. 'they offer 1.2% more'",
      "direction": "ahead" | "behind" | "equal" | "unknown"
    }
  ],
  "recommendations": [
    {
      "action": "specific recommended action",
      "rationale": "why, grounded in the data",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Rules:
- benchmarks: only include if you have data for the dimension; return [] if no reference data
- recommendations: 3–5 items, ordered by priority
- All statements must be traceable to the data points above`
}
