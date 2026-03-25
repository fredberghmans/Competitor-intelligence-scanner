import { getSettings } from '@/lib/settings'
import SettingsForm from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure the AI provider used for scanning and research.</p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  )
}
