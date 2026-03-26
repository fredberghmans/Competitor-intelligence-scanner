import { callAI, parseJSON, log } from './client'
import { normalizationSystem, normalizationUser } from './prompts'

type NormalizationEntry = { competitorId: string; value: string }
type NormalizationResult = { competitorId: string; normalizedValue: string }

/**
 * Given all current values for a single criterion (across all competitors),
 * returns a map of { competitor_id → normalized_value }.
 *
 * Makes ONE Haiku call for all competitors simultaneously — cost is trivial
 * (~200 input + ~100 output tokens per criterion).
 *
 * Returns an empty map when:
 * - Fewer than 2 entries (nothing to normalize cross-competitor)
 * - AI call or parse fails (normalization is best-effort; never throws)
 */
export async function normalizeCriteriaValues(
  criteriaName: string,
  entries: NormalizationEntry[],
): Promise<Map<string, string>> {
  if (entries.length < 2) return new Map()

  try {
    const raw = await callAI(
      'cheap',
      normalizationSystem(),
      normalizationUser(criteriaName, entries),
      512,
    )

    const results = parseJSON<NormalizationResult[]>(raw)

    // Validate: every input competitorId must appear in the response
    const inputIds = new Set(entries.map((e) => e.competitorId))
    const outputIds = new Set(results.map((r) => r.competitorId))
    for (const id of inputIds) {
      if (!outputIds.has(id)) {
        log('store', `Normalization response missing competitorId ${id} for "${criteriaName}" — skipping`)
        return new Map()
      }
    }

    const map = new Map<string, string>()
    for (const { competitorId, normalizedValue } of results) {
      if (inputIds.has(competitorId) && normalizedValue) {
        map.set(competitorId, normalizedValue)
      }
    }
    return map
  } catch (err) {
    log('store', `Normalization failed for "${criteriaName}": ${String(err)}`)
    return new Map()
  }
}
