import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Database, ExternalLink, CircleDot } from 'lucide-react'
import { getCompetitorDataPoints } from '@/lib/data-points'
import type { CategoryGroup, DataPointRow } from '@/lib/data-points'
import type { Criteria } from '@/lib/supabase/types'

export default async function DataPointsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getCompetitorDataPoints(id)
  if (!data) notFound()

  const { competitor, groups, totalFilled, totalCriteria } = data
  const coverage = totalCriteria > 0 ? Math.round((totalFilled / totalCriteria) * 100) : 0

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/competitors"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          All competitors
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {competitor.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">Data points extracted by the AI pipeline</p>
          </div>

          {/* Coverage pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shrink-0">
            <CoverageRing pct={coverage} />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {totalFilled} / {totalCriteria}
              </p>
              <p className="text-xs text-slate-400">criteria filled</p>
            </div>
          </div>
        </div>
      </div>

      {totalCriteria === 0 ? (
        <NoCriteria />
      ) : groups.length === 0 || totalFilled === 0 ? (
        <NoData competitorName={competitor.name} competitorId={id} />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <CategorySection key={group.category.id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

function CategorySection({ group }: { group: CategoryGroup }) {
  const hasRows = group.rows.length > 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Category header */}
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CircleDot size={13} className="text-indigo-400" />
          <span className="text-sm font-semibold text-slate-700">{group.category.name}</span>
        </div>
        <span className="text-xs text-slate-400">
          {group.rows.length} / {group.rows.length + group.emptyCriteria.length} filled
        </span>
      </div>

      {/* Table */}
      {hasRows && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2.5 px-5 text-xs font-semibold uppercase tracking-widest text-slate-400 w-1/4">
                Criterion
              </th>
              <th className="text-left py-2.5 px-5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Value
              </th>
              <th className="text-left py-2.5 px-5 text-xs font-semibold uppercase tracking-widest text-slate-400 w-24">
                Confidence
              </th>
              <th className="text-left py-2.5 px-5 text-xs font-semibold uppercase tracking-widest text-slate-400 w-28">
                Updated
              </th>
              <th className="py-2.5 px-5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {group.rows.map((row) => (
              <DataRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      )}

      {/* Empty criteria — greyed out rows */}
      {group.emptyCriteria.length > 0 && (
        <table className="w-full text-sm">
          <tbody className={`divide-y divide-slate-50 ${hasRows ? 'border-t border-slate-100' : ''}`}>
            {group.emptyCriteria.map((c) => (
              <EmptyRow key={c.id} criterion={c} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function DataRow({ row }: { row: DataPointRow }) {
  const ago = relativeTime(row.updated_at)

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="py-3.5 px-5 font-medium text-slate-700 align-top">
        {row.criteria.name}
      </td>
      <td className="py-3.5 px-5 text-slate-600 leading-relaxed align-top max-w-xs">
        {row.value}
      </td>
      <td className="py-3.5 px-5 align-top">
        <ConfidenceBadge confidence={row.confidence} />
      </td>
      <td className="py-3.5 px-5 text-xs text-slate-400 align-top whitespace-nowrap">
        {ago}
      </td>
      <td className="py-3.5 px-5 align-top text-right">
        {row.source_url && (
          <a
            href={row.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-indigo-500 transition-colors"
            title={row.source_url}
          >
            <ExternalLink size={13} />
          </a>
        )}
      </td>
    </tr>
  )
}

function EmptyRow({ criterion }: { criterion: Criteria }) {
  return (
    <tr className="opacity-40">
      <td className="py-3 px-5 text-slate-500 text-sm">{criterion.name}</td>
      <td className="py-3 px-5 text-slate-300 text-sm italic">Not yet extracted</td>
      <td className="py-3 px-5" />
      <td className="py-3 px-5" />
      <td className="py-3 px-5" />
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === 'high') {
    return (
      <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
        High
      </span>
    )
  }
  return (
    <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
      Medium
    </span>
  )
}

function CoverageRing({ pct }: { pct: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <svg width="40" height="40" className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#6366f1"
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90"
        style={{ transform: 'rotate(90deg)', transformOrigin: '20px 20px' }}
        fontSize="9"
        fontWeight="600"
        fill="#6366f1"
      >
        {pct}%
      </text>
    </svg>
  )
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function NoData({
  competitorName,
  competitorId,
}: {
  competitorName: string
  competitorId: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
        <Database size={24} className="text-indigo-400" />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">No data points yet</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        Run a scan for {competitorName} to start extracting structured data points across your
        criteria.
      </p>
      <Link
        href="/competitors"
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Go to competitors
      </Link>
    </div>
  )
}

function NoCriteria() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Database size={24} className="text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">No criteria defined</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        Add criteria first so the AI knows what to extract during scans.
      </p>
      <Link
        href="/criteria"
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Manage criteria
      </Link>
    </div>
  )
}
