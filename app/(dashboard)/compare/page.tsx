import Link from 'next/link'
import { ExternalLink, Minus } from 'lucide-react'
import { getCompareData } from '@/lib/compare'
import type { CompareGroup, CompareCell } from '@/lib/compare'
import type { Competitor } from '@/lib/supabase/types'

export default async function ComparePage() {
  let data: Awaited<ReturnType<typeof getCompareData>> | null = null

  try {
    data = await getCompareData()
  } catch {
    // DB not yet configured
  }

  const competitors = data?.competitors ?? []
  const groups = data?.groups ?? []
  const totalCriteria = data?.totalCriteria ?? 0
  const totalFilled = data?.totalFilled ?? 0

  return (
    <div className="px-8 py-8 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compare</h1>
          <p className="text-sm text-slate-500 mt-1">
            {competitors.length > 0
              ? `${competitors.length} competitor${competitors.length !== 1 ? 's' : ''} · ${totalFilled} of ${competitors.length * totalCriteria} cells filled`
              : 'No competitors yet'}
          </p>
        </div>
        <Link
          href="/competitors"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Manage competitors →
        </Link>
      </div>

      {competitors.length === 0 ? (
        <EmptyCompetitors />
      ) : groups.length === 0 ? (
        <EmptyCriteria />
      ) : (
        <CompareTable competitors={competitors} groups={groups} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function CompareTable({
  competitors,
  groups,
}: {
  competitors: Competitor[]
  groups: CompareGroup[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {/* Criterion label column */}
            <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-widest text-slate-400 w-48 sticky left-0 bg-slate-50 z-10 border-r border-slate-100">
              Criterion
            </th>
            {/* One column per competitor */}
            {competitors.map((c) => (
              <th
                key={c.id}
                className="text-left py-3 px-4 text-xs font-semibold text-slate-700 min-w-[180px] border-r border-slate-100 last:border-r-0"
              >
                <Link
                  href={`/competitors/${c.id}/data`}
                  className="hover:text-indigo-600 transition-colors"
                >
                  {c.name}
                </Link>
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5 normal-case tracking-normal">
                  {c.region}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.category.id} group={group} competitors={competitors} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({
  group,
  competitors,
}: {
  group: CompareGroup
  competitors: Competitor[]
}) {
  return (
    <>
      {/* Category separator row */}
      <tr className="bg-slate-50/70 border-y border-slate-100">
        <td
          colSpan={competitors.length + 1}
          className="py-2 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
        >
          {group.category.name}
        </td>
      </tr>

      {/* Leaf rows */}
      {group.rows.map((row) => (
        <tr key={row.criteria.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
          {/* Sticky criterion label */}
          <td className="py-3.5 px-5 font-medium text-slate-600 sticky left-0 bg-white border-r border-slate-100 align-top z-10 group-hover:bg-slate-50">
            {row.criteria.name}
          </td>

          {/* One cell per competitor */}
          {competitors.map((comp) => (
            <td key={comp.id} className="py-3.5 px-4 align-top border-r border-slate-50 last:border-r-0">
              <Cell cell={row.cells[comp.id]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function Cell({ cell }: { cell: CompareCell }) {
  if (!cell) {
    return <Minus size={13} className="text-slate-200 mt-0.5" />
  }

  return (
    <div className="flex items-start gap-1.5 group/cell">
      <div className="flex-1 min-w-0">
        <p className="text-slate-700 leading-relaxed text-sm">{cell.value}</p>
        <div className="flex items-center gap-2 mt-1">
          <ConfidenceDot confidence={cell.confidence} />
          <span className="text-[10px] text-slate-300">{relativeTime(cell.updated_at)}</span>
        </div>
      </div>
      {cell.source_url && (
        <a
          href={cell.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-200 hover:text-indigo-400 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0 mt-0.5"
          title={cell.source_url}
        >
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${
        confidence === 'high' ? 'bg-emerald-400' : 'bg-amber-300'
      }`}
      title={`${confidence} confidence`}
    />
  )
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyCompetitors() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-slate-500 text-sm mb-4">Add at least one competitor to start comparing.</p>
      <Link
        href="/competitors/new"
        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Add competitor
      </Link>
    </div>
  )
}

function EmptyCriteria() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-slate-500 text-sm mb-4">
        No criteria defined. Add criteria so the AI knows what to extract.
      </p>
      <Link
        href="/criteria"
        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Manage criteria
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
