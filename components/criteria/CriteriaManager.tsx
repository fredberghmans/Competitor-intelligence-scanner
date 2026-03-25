'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, FolderOpen, ChevronRight } from 'lucide-react'
import type { CriteriaTree } from '@/lib/criteria'
import {
  createCriteriaAction,
  updateCriteriaAction,
  deleteCriteriaAction,
} from '@/lib/actions/criteria'

type AddingState =
  | { type: 'category' }
  | { type: 'subcriteria'; parentId: string; parentCategory: string }
  | null

type EditingState =
  | { type: 'category'; id: string; name: string }
  | { type: 'subcriteria'; id: string; name: string }
  | null

export default function CriteriaManager({ tree }: { tree: CriteriaTree[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState<AddingState>(null)
  const [editing, setEditing] = useState<EditingState>(null)

  function refresh() {
    router.refresh()
  }

  function startAdd(state: AddingState) {
    setEditing(null)
    setAdding(state)
  }

  function startEdit(state: EditingState) {
    setAdding(null)
    setEditing(state)
  }

  function cancel() {
    setAdding(null)
    setEditing(null)
  }

  function handleAdd(name: string) {
    if (!adding) return
    startTransition(async () => {
      if (adding.type === 'category') {
        await createCriteriaAction({ name, category: name, parent_id: null })
      } else {
        await createCriteriaAction({
          name,
          category: adding.parentCategory,
          parent_id: adding.parentId,
        })
      }
      setAdding(null)
      refresh()
    })
  }

  function handleEdit(name: string) {
    if (!editing) return
    startTransition(async () => {
      await updateCriteriaAction(editing.id, { name })
      setEditing(null)
      refresh()
    })
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? Subcriteria will also be removed.`)) return
    startTransition(async () => {
      await deleteCriteriaAction(id)
      refresh()
    })
  }

  return (
    <div className={`space-y-2 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      {tree.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          editing={editing}
          adding={adding}
          onStartEdit={startEdit}
          onStartAdd={startAdd}
          onEdit={handleEdit}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onCancel={cancel}
          isPending={isPending}
        />
      ))}

      {/* Add category row */}
      {adding?.type === 'category' ? (
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-4">
          <InlineInput
            placeholder="Category name (e.g. Trading)"
            onConfirm={handleAdd}
            onCancel={cancel}
            isPending={isPending}
          />
        </div>
      ) : (
        <button
          onClick={() => startAdd({ type: 'category' })}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors"
        >
          <Plus size={15} />
          Add category
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function CategoryRow({
  category,
  editing,
  adding,
  onStartEdit,
  onStartAdd,
  onEdit,
  onAdd,
  onDelete,
  onCancel,
  isPending,
}: {
  category: CriteriaTree
  editing: EditingState
  adding: AddingState
  onStartEdit: (s: EditingState) => void
  onStartAdd: (s: AddingState) => void
  onEdit: (name: string) => void
  onAdd: (name: string) => void
  onDelete: (id: string, label: string) => void
  onCancel: () => void
  isPending: boolean
}) {
  const isEditingThis = editing?.type === 'category' && editing.id === category.id
  const isAddingSubcriteria =
    adding?.type === 'subcriteria' && adding.parentId === category.id

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border-b border-slate-200">
        <FolderOpen size={15} className="text-indigo-500 shrink-0" />

        {isEditingThis ? (
          <InlineInput
            initialValue={category.name}
            onConfirm={onEdit}
            onCancel={onCancel}
            isPending={isPending}
          />
        ) : (
          <>
            <span className="font-semibold text-slate-900 text-sm flex-1">
              {category.name}
            </span>
            <span className="text-xs text-slate-400 mr-2">
              {category.children.length} criteria
            </span>
            <div className="flex items-center gap-0.5">
              <IconBtn
                icon={<Plus size={13} />}
                label="Add subcriteria"
                onClick={() =>
                  onStartAdd({
                    type: 'subcriteria',
                    parentId: category.id,
                    parentCategory: category.category,
                  })
                }
              />
              <IconBtn
                icon={<Pencil size={13} />}
                label="Edit"
                onClick={() =>
                  onStartEdit({ type: 'category', id: category.id, name: category.name })
                }
              />
              <IconBtn
                icon={<Trash2 size={13} />}
                label="Delete"
                onClick={() => onDelete(category.id, category.name)}
                danger
              />
            </div>
          </>
        )}
      </div>

      {/* Subcriteria list */}
      <div className="divide-y divide-slate-100">
        {category.children.map((child) => {
          const isEditingChild = editing?.type === 'subcriteria' && editing.id === child.id

          return (
            <div
              key={child.id}
              className="flex items-center gap-3 px-4 py-2.5 group hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={12} className="text-slate-300 shrink-0" />

              {isEditingChild ? (
                <InlineInput
                  initialValue={child.name}
                  onConfirm={onEdit}
                  onCancel={onCancel}
                  isPending={isPending}
                />
              ) : (
                <>
                  <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconBtn
                      icon={<Pencil size={12} />}
                      label="Edit"
                      onClick={() =>
                        onStartEdit({
                          type: 'subcriteria',
                          id: child.id,
                          name: child.name,
                        })
                      }
                      small
                    />
                    <IconBtn
                      icon={<Trash2 size={12} />}
                      label="Delete"
                      onClick={() => onDelete(child.id, child.name)}
                      danger
                      small
                    />
                  </div>
                </>
              )}
            </div>
          )
        })}

        {/* Add subcriteria inline */}
        {isAddingSubcriteria && (
          <div className="px-4 py-3 flex items-center gap-3">
            <ChevronRight size={12} className="text-slate-300 shrink-0" />
            <InlineInput
              placeholder="Subcriteria name (e.g. Spot trading)"
              onConfirm={onAdd}
              onCancel={onCancel}
              isPending={isPending}
            />
          </div>
        )}

        {category.children.length === 0 && !isAddingSubcriteria && (
          <div className="px-4 py-3 flex items-center gap-3">
            <ChevronRight size={12} className="text-slate-200 shrink-0" />
            <p className="text-xs text-slate-400">No subcriteria yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function InlineInput({
  initialValue = '',
  placeholder = 'Name…',
  onConfirm,
  onCancel,
  isPending,
}: {
  initialValue?: string
  placeholder?: string
  onConfirm: (value: string) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm(value.trim())
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className="flex-1 text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <button
        onClick={() => onConfirm(value.trim())}
        disabled={isPending || !value.trim()}
        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors font-medium"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-2.5 py-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

function IconBtn({
  icon,
  label,
  onClick,
  danger,
  small,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`rounded-md transition-colors ${small ? 'p-1' : 'p-1.5'} ${
        danger
          ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
      }`}
    >
      {icon}
    </button>
  )
}
