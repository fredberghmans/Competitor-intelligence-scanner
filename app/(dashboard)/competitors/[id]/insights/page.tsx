import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  BarChart2,
  Lightbulb,
  FileText,
} from 'lucide-react'
import { getLatestInsights } from '@/lib/insights'
import type { BenchmarkItem, StrategicRecommendation } from '@/lib/ai/types'

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getLatestInsights(id)
  if (!data) notFound()

  const { competitor, executive_summary, changes_summary, benchmarks, recommendations, scannedAt } =
    data

  const hasAnyInsight =
    executive_summary?.tldr ||
    changes_summary?.summary ||
    benchmarks.length > 0 ||
    recommendations.length > 0

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="mb-8">
        <Link
          href="/competitors"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          All competitors
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {competitor.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {scannedAt
                ? `Last scanned ${new Date(scannedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'No scan data yet'}
            </p>
          </div>
        </div>
      </div>

      {!hasAnyInsight ? (
        <EmptyInsights competitorName={competitor.name} competitorId={id} />
      ) : (
        <div className="space-y-6">
          {/* Executive summary */}
          {executive_summary?.tldr && (
            <Section icon={FileText} title="Executive Summary" iconColor="text-indigo-600" iconBg="bg-indigo-50">
              <p className="text-slate-700 leading-relaxed mb-5">{executive_summary.tldr}</p>

              {executive_summary.positioning && (
                <p className="text-sm text-slate-500 italic border-l-2 border-slate-200 pl-3 mb-5">
                  {executive_summary.positioning}
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {executive_summary.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-2">
                      Strengths
                    </p>
                    <ul className="space-y-1.5">
                      {executive_summary.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {executive_summary.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-2">
                      Weaknesses
                    </p>
                    <ul className="space-y-1.5">
                      {executive_summary.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Changes summary */}
          {changes_summary?.summary && (
            <Section icon={Zap} title="Recent Changes" iconColor="text-amber-600" iconBg="bg-amber-50">
              <p className="text-slate-700 leading-relaxed mb-4">{changes_summary.summary}</p>
              {changes_summary.highlights?.length > 0 && (
                <ul className="space-y-2">
                  {changes_summary.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <ChevronRight size={14} className="text-amber-400 mt-0.5 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Benchmarks */}
          {benchmarks.length > 0 && (
            <Section icon={BarChart2} title="Benchmarks" iconColor="text-violet-600" iconBg="bg-violet-50">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400 w-1/3">
                        Dimension
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Their value
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Our value
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400 w-24">
                        Gap
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {benchmarks.map((b, i) => (
                      <BenchmarkRow key={i} item={b} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Section icon={Lightbulb} title="Recommendations" iconColor="text-sky-600" iconBg="bg-sky-50">
              <div className="space-y-4">
                {recommendations
                  .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
                  .map((r, i) => (
                    <RecommendationCard key={i} rec={r} />
                  ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  iconColor,
  iconBg,
  children,
}: {
  icon: React.ElementType
  title: string
  iconColor: string
  iconBg: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={14} className={iconColor} />
        </div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function BenchmarkRow({ item }: { item: BenchmarkItem }) {
  const directionIcon = {
    ahead: <TrendingUp size={13} className="text-emerald-500" />,
    behind: <TrendingDown size={13} className="text-red-400" />,
    equal: <Minus size={13} className="text-slate-400" />,
    unknown: <Minus size={13} className="text-slate-300" />,
  }

  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      <td className="py-3 px-3 font-medium text-slate-700">{item.dimension}</td>
      <td className="py-3 px-3 text-slate-600">{item.competitor_value || '—'}</td>
      <td className="py-3 px-3 text-slate-400">{item.our_value || '—'}</td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          {item.direction ? directionIcon[item.direction] : null}
          {item.gap && <span className="text-xs text-slate-500">{item.gap}</span>}
        </div>
      </td>
    </tr>
  )
}

function RecommendationCard({ rec }: { rec: StrategicRecommendation }) {
  const priority = {
    high: {
      label: 'High',
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-100',
    },
    medium: {
      label: 'Medium',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
    },
    low: {
      label: 'Low',
      bg: 'bg-slate-50',
      text: 'text-slate-500',
      border: 'border-slate-100',
    },
  }[rec.priority]

  return (
    <div className="flex gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50/50">
      <div className="shrink-0 pt-0.5">
        <span
          className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priority.bg} ${priority.text} ${priority.border}`}
        >
          {priority.label}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 mb-1">{rec.action}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{rec.rationale}</p>
      </div>
    </div>
  )
}

function EmptyInsights({
  competitorName,
  competitorId,
}: {
  competitorName: string
  competitorId: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
        <Lightbulb size={24} className="text-indigo-400" />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">No insights yet</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        Run a scan for {competitorName} to generate AI insights, benchmarks, and recommendations.
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

function priorityOrder(p: StrategicRecommendation['priority']) {
  return p === 'high' ? 0 : p === 'medium' ? 1 : 2
}
