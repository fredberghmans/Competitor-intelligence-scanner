import type { Criteria } from '@/lib/supabase/types'
import type { Competitor } from '@/lib/supabase/types'

/**
 * System prompt for the research agent.
 * Provides exact criteria names and instructs Claude to use web search
 * to find structured competitor intelligence.
 */
export function researchSystemPrompt(criteria: Criteria[]): string {
  const criteriaList = criteria
    .map((c, i) => `${i + 1}. ${c.name}`)
    .join('\n')

  return `You are a competitive intelligence researcher for a fintech company.
Your task is to research a competitor and extract structured data about them.

You have access to a web search tool. Use it to find accurate, up-to-date information.
Search specifically on the company's own website, official documentation, fee schedules, and factsheets.

CRITERIA TO RESEARCH:
${criteriaList}

OUTPUT FORMAT:
After completing your research, respond with ONLY a JSON array (no prose, no markdown fences):
[
  {
    "criteria_name": "<exact name from the list above, copied verbatim>",
    "value": "<concise factual statement, e.g. 'CHF 0 — no account opening fee'>",
    "confidence": "high" | "medium",
    "source_url": "<URL where you found this information>"
  }
]

Rules:
- Use the criteria names EXACTLY as listed above (copy them verbatim)
- "high" confidence = explicitly stated on their website
- "medium" confidence = clearly implied or stated in secondary sources
- Only include data points you actually found via search — never invent values
- If you cannot find information for a criterion, omit it from the array
- Include source_url for every data point`
}

/**
 * User prompt for the research agent.
 * Asks Claude to research a specific competitor using their known domains.
 */
export function researchUserPrompt(competitor: Competitor, criteria: Criteria[]): string {
  const domainHints = competitor.domains.length > 0
    ? `Their known domains: ${competitor.domains.map((d) => d.url).join(', ')}`
    : ''

  const criteriaNames = criteria.map((c) => c.name).join(', ')

  return `Research this competitor and extract structured intelligence.

COMPETITOR: ${competitor.name}
${domainHints}
REGION: ${competitor.region ?? 'unknown'}

Find information about: ${criteriaNames}

Search their website, fee schedules, factsheets, regulatory disclosures, and product pages.
Focus on factual, verifiable information. When you are done researching, output the JSON array.`
}
