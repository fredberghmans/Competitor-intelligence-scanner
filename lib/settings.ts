import { createServiceClient } from '@/lib/supabase/server'

export type AIProvider = 'anthropic' | 'gemini'

export type AppSettings = {
  ai_provider: AIProvider
  /**
   * Read-only from the environment — never stored in the database.
   * Set via GEMINI_API_KEY in .env.local.
   */
  gemini_api_key?: string
}

// Module-level cache so we don't hit Supabase on every AI call.
// TTL of 60 seconds — settings changes take effect within a minute.
let cache: { settings: AppSettings; expiresAt: number } | null = null
const CACHE_TTL_MS = 60_000

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() < cache.expiresAt) return cache.settings

  const supabase = createServiceClient()
  const { data } = await supabase.from('settings').select('key, value')

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const settings: AppSettings = {
    ai_provider: (map.ai_provider as AIProvider) ?? 'anthropic',
    // API keys are never stored in the DB — only read from the server environment
    gemini_api_key: process.env.GEMINI_API_KEY,
  }

  cache = { settings, expiresAt: Date.now() + CACHE_TTL_MS }
  return settings
}

export async function saveSettings(updates: Pick<AppSettings, 'ai_provider'>): Promise<void> {
  const supabase = createServiceClient()

  // Only non-sensitive config is persisted to the database.
  // API keys must be set via environment variables (.env.local).
  const allowed: Array<keyof typeof updates> = ['ai_provider']
  const rows = allowed
    .filter((k) => updates[k] !== undefined)
    .map((key) => ({ key, value: String(updates[key]) }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) throw new Error(`Failed to save settings: ${error.message}`)

  // Bust cache so next read reflects the new values
  cache = null
}
