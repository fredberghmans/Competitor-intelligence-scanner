import { Target } from 'lucide-react'
import { getCriteriaTree } from '@/lib/criteria'
import CriteriaManager from '@/components/criteria/CriteriaManager'
import type { CriteriaTree } from '@/lib/criteria'

export default async function CriteriaPage() {
  let tree: CriteriaTree[] = []

  try {
    tree = await getCriteriaTree()
  } catch {
    // DB not yet configured — show empty state
  }

  const totalCriteria = tree.reduce((sum, c) => sum + c.children.length, 0)

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Evaluation Criteria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tree.length > 0
              ? `${tree.length} categor${tree.length !== 1 ? 'ies' : 'y'} · ${totalCriteria} criteria`
              : 'Define the dimensions used to evaluate competitors'}
          </p>
        </div>

        {/* Info pill */}
        {tree.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
            <Target size={13} className="text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600">
              {totalCriteria} tracked criteria
            </span>
          </div>
        )}
      </div>

      {/* Explanation card */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex gap-3">
        <Target size={16} className="text-indigo-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-800 mb-0.5">
            How criteria work
          </p>
          <p className="text-xs text-indigo-600 leading-relaxed">
            Criteria are organised as <strong>categories</strong> (e.g. Trading) with{' '}
            <strong>subcriteria</strong> (e.g. Spot, Fees, Derivatives). The AI pipeline maps
            competitor data to these dimensions to produce structured intelligence.
          </p>
        </div>
      </div>

      {/* Tree manager */}
      {tree.length === 0 ? (
        <EmptyState />
      ) : (
        <CriteriaManager tree={tree} />
      )}

      {/* Show the manager even when empty so user can add */}
      {tree.length === 0 && (
        <div className="mt-4">
          <CriteriaManager tree={[]} />
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Target size={24} className="text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">No criteria defined</h3>
      <p className="text-slate-500 text-sm max-w-xs">
        Create your first category below to define how competitors will be evaluated.
      </p>
    </div>
  )
}
