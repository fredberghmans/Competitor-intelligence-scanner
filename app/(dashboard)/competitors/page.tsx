import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'
import { getCompetitors } from '@/lib/competitors'
import CompetitorCard from '@/components/competitors/CompetitorCard'
import type { Competitor } from '@/lib/supabase/types'

export default async function CompetitorsPage() {
  let competitors: Competitor[] = []

  try {
    competitors = await getCompetitors()
  } catch {
    // DB not yet configured — show empty state
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Competitors</h1>
          <p className="text-sm text-slate-500 mt-1">
            {competitors.length > 0
              ? `${competitors.length} tracked competitor${competitors.length !== 1 ? 's' : ''}`
              : 'No competitors yet'}
          </p>
        </div>
        <Link
          href="/competitors/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add competitor
        </Link>
      </div>

      {/* Grid */}
      {competitors.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map((c) => (
            <CompetitorCard key={c.id} competitor={c} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Building2 size={24} className="text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">No competitors yet</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        Add your first competitor to start tracking their product, pricing, and strategy.
      </p>
      <Link
        href="/competitors/new"
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={15} />
        Add first competitor
      </Link>
    </div>
  )
}
