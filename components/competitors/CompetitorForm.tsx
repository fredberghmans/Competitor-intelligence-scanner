'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Globe, Loader2 } from 'lucide-react'
import { createCompetitorAction, updateCompetitorAction } from '@/lib/actions/competitors'
import type { Competitor, CompetitorDomain } from '@/lib/supabase/types'

type Props = {
  competitor?: Competitor
}

const TYPES = [
  { value: 'crypto_exchange', label: 'Crypto Exchange' },
  { value: 'bank', label: 'Bank' },
  { value: 'hybrid', label: 'Hybrid' },
]

export default function CompetitorForm({ competitor }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [domains, setDomains] = useState<CompetitorDomain[]>(
    competitor?.domains?.length ? competitor.domains : [{ url: '', label: '' }],
  )

  function addDomain() {
    setDomains((prev) => [...prev, { url: '', label: '' }])
  }

  function updateDomain(index: number, field: keyof CompetitorDomain, value: string) {
    setDomains((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  function removeDomain(index: number) {
    setDomains((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const cleanedDomains = domains.filter((d) => d.url.trim())
    formData.set('domains', JSON.stringify(cleanedDomains))

    startTransition(async () => {
      try {
        if (competitor) {
          await updateCompetitorAction(competitor.id, formData)
        } else {
          await createCompetitorAction(formData)
        }
        router.push('/competitors')
        router.refresh()
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={competitor?.name}
            placeholder="e.g. Kraken"
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="type" className="block text-sm font-medium text-slate-700">
            Type <span className="text-red-400">*</span>
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue={competitor?.type ?? ''}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition appearance-none"
          >
            <option value="" disabled>
              Select a type…
            </option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Region */}
      <div className="space-y-1.5">
        <label htmlFor="region" className="block text-sm font-medium text-slate-700">
          Region <span className="text-red-400">*</span>
        </label>
        <input
          id="region"
          name="region"
          required
          defaultValue={competitor?.region}
          placeholder="e.g. Global, EU, US, APAC"
          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
      </div>

      {/* Domains */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Domains</label>
          <button
            type="button"
            onClick={addDomain}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            <Plus size={13} />
            Add domain
          </button>
        </div>

        <div className="space-y-2">
          {domains.map((domain, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <input
                  value={domain.url}
                  onChange={(e) => updateDomain(i, 'url', e.target.value)}
                  placeholder="https://example.com"
                  type="text"
                  className="flex-1 text-sm outline-none placeholder:text-slate-400 bg-transparent"
                />
                <input
                  value={domain.label ?? ''}
                  onChange={(e) => updateDomain(i, 'label', e.target.value)}
                  placeholder="Label (optional)"
                  className="w-32 text-sm outline-none placeholder:text-slate-400 bg-transparent border-l border-slate-200 pl-2"
                />
              </div>
              {domains.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDomain(i)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Add the main website and any relevant sub-domains (pricing, blog, etc.)
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {competitor ? 'Save changes' : 'Add competitor'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
