'use server'

import { saveSettings } from '@/lib/settings'
import { revalidatePath } from 'next/cache'

export async function saveSettingsAction(formData: FormData) {
  const provider = formData.get('ai_provider') as 'anthropic' | 'gemini'

  // Only the provider choice is saved to the database.
  // API keys are never accepted via form — they must be set in .env.local.
  await saveSettings({ ai_provider: provider })

  revalidatePath('/settings')
}
