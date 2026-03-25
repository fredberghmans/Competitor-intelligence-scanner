/**
 * In-memory cache for AI pipeline results.
 *
 * SCOPE: Per-process (one Next.js server instance / one serverless invocation).
 *
 * WHY IN-MEMORY AND NOT SUPABASE
 * ────────────────────────────────
 * For repeated pipeline runs within the same process (e.g. retries, dev
 * reloads), in-memory is instant and has zero latency. For production
 * cross-invocation caching, the data_points table already acts as a
 * persistent cache — if a criteria×competitor value hasn't changed, the
 * upsert in store.ts keeps the existing row and the insights stage is
 * skipped by the pipeline orchestrator.
 *
 * EXTENSION POINT
 * ────────────────
 * Replace get/setCache with a Redis or Supabase-backed implementation
 * without changing any caller. The interface is intentionally minimal.
 *
 * TTL
 * ────
 * No TTL is implemented — the cache lives for the lifetime of the process.
 * This is intentional: a scan completes within minutes; stale cache entries
 * from a previous scan are irrelevant because the cache key includes the
 * chunk content hash, which changes when the page changes.
 */

const store = new Map<string, unknown>()

export function getCache<T>(key: string): T | null {
  const hit = store.get(key)
  return hit !== undefined ? (hit as T) : null
}

export function setCache<T>(key: string, value: T): void {
  store.set(key, value)
}

export function clearCache(): void {
  store.clear()
}

export function cacheSize(): number {
  return store.size
}
