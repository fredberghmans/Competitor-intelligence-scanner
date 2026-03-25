import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getCompetitor } from '@/lib/competitors'
import CompetitorForm from '@/components/competitors/CompetitorForm'

type Props = { params: Promise<{ id: string }> }

export default async function EditCompetitorPage({ params }: Props) {
  const { id } = await params
  const competitor = await getCompetitor(id)

  if (!competitor) notFound()

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/competitors"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ChevronLeft size={14} />
        Competitors
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Edit {competitor.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Update this competitor&apos;s details.</p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <CompetitorForm competitor={competitor} />
      </div>
    </div>
  )
}
