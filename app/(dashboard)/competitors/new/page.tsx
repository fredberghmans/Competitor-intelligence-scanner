import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import CompetitorForm from '@/components/competitors/CompetitorForm'

export default function NewCompetitorPage() {
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add competitor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Add a competitor to start monitoring their public presence.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <CompetitorForm />
      </div>
    </div>
  )
}
