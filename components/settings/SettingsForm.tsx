'use client'

import { useState } from 'react'
import { Bot, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { AppSettings, AIProvider } from '@/lib/settings'
import { saveSettingsAction } from '@/app/(dashboard)/settings/actions'

const PROVIDERS: { id: AIProvider; label: string; description: string; costNote: string }[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    description: 'Uses Claude Haiku for classification & extraction, Claude Sonnet for insights.',
    costNote: '~$0.007 per crawl scan · ~$0.05–0.20 per research scan',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Uses Gemini 2.0 Flash for all operations. Research uses Gemini 2.0 Flash + Google Search grounding.',
    costNote: '~$0.001 per crawl scan · ~$0.01–0.05 per research scan',
  },
]

export default function SettingsForm({ initialSettings }: { initialSettings: AppSettings }) {
  const [provider, setProvider] = useState<AIProvider>(initialSettings.ai_provider)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')
    try {
      const fd = new FormData()
      fd.set('ai_provider', provider)
      await saveSettingsAction(fd)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Provider selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">AI Provider</label>
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                provider === p.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="ai_provider"
                value={p.id}
                checked={provider === p.id}
                onChange={() => setProvider(p.id)}
                className="mt-0.5 accent-indigo-600"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Bot size={14} className={provider === p.id ? 'text-indigo-600' : 'text-slate-400'} />
                  <span className="text-sm font-medium text-slate-900">{p.label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                <p className="text-xs text-slate-400 mt-1 font-mono">{p.costNote}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Gemini API key status */}
      {provider === 'gemini' && (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${initialSettings.gemini_api_key ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-xs text-slate-500">
            {initialSettings.gemini_api_key
              ? 'Gemini API key detected — ready to use'
              : 'GEMINI_API_KEY not found in .env.local — add it and restart the server'}
          </span>
        </div>
      )}

      {/* Save button + status */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {status === 'saving' && <Loader2 size={13} className="animate-spin" />}
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>

        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle size={14} />
            Saved
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={14} />
            {errorMsg}
          </span>
        )}
      </div>
    </form>
  )
}
