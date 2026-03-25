'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Globe, MapPin } from 'lucide-react'
import Badge, { competitorTypeBadge, competitorTypeLabel } from '@/components/ui/badge'
import { deleteCompetitorAction } from '@/lib/actions/competitors'
import type { Competitor } from '@/lib/supabase/types'

export default function CompetitorCard({ competitor }: { competitor: Competitor }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Delete "${competitor.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteCompetitorAction(competitor.id)
      router.refresh()
    })
  }

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 transition-opacity ${
        isPending ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-base truncate">
            {competitor.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">{competitor.region}</span>
          </div>
        </div>
        <Badge variant={competitorTypeBadge(competitor.type)}>
          {competitorTypeLabel(competitor.type)}
        </Badge>
      </div>

      {/* Domains */}
      {competitor.domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competitor.domains.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-md transition-colors max-w-[180px]"
            >
              <Globe size={10} className="shrink-0" />
              <span className="truncate">{d.label || d.url.replace(/^https?:\/\//, '')}</span>
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <Link
          href={`/competitors/${competitor.id}/edit`}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Pencil size={12} />
          Edit
        </Link>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  )
}
