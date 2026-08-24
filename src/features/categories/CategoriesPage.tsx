import { useState } from 'react'
import {
  canDeleteCategory,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
  useReorderCategory,
} from './useCategories'
import type { Category } from '../../types/db'

export function CategoriesPage() {
  const { data: categories, isLoading, isError, error } = useCategories()
  const createCategory = useCreateCategory()
  const renameCategory = useRenameCategory()
  const deleteCategory = useDeleteCategory()
  const reorderCategory = useReorderCategory()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const ordered = categories ?? []

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    const nextOrder = ordered.length > 0 ? Math.max(...ordered.map((c) => c.display_order)) + 1 : 1
    await createCategory.mutateAsync({ name, display_order: nextOrder })
    setNewName('')
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async () => {
    const name = editingName.trim()
    if (!editingId || !name) return
    await renameCategory.mutateAsync({ id: editingId, name })
    cancelEdit()
  }

  const handleDelete = async (category: Category) => {
    await deleteCategory.mutateAsync(category)
    setConfirmDeleteId(null)
  }

  const move = (category: Category, direction: 'up' | 'down') => {
    reorderCategory.mutate({ category, direction, ordered })
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-bold text-ink mb-4">Categories</h1>

      <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdd()
          }}
          placeholder="New category name"
          className="flex-1 border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!newName.trim() || createCategory.isPending}
          onClick={() => void handleAdd()}
          className="rounded-xl px-4 py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {createCategory.isError && (
        <p className="text-neg text-sm mb-3">
          {createCategory.error instanceof Error ? createCategory.error.message : 'Could not add category'}
        </p>
      )}

      {isLoading && <p className="text-ink-soft text-sm">Loading categories…</p>}
      {isError && (
        <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load categories'}</p>
      )}

      {!isLoading && !isError && (
        <ul className="flex flex-col gap-2">
          {ordered.map((category, index) => {
            const isEditing = editingId === category.id
            const isConfirmingDelete = confirmDeleteId === category.id
            const canDelete = canDeleteCategory(category)

            return (
              <li
                key={category.id}
                className="bg-surface border border-line rounded-2xl p-3 shadow-sm flex items-center gap-2"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${category.name} up`}
                    disabled={index === 0 || reorderCategory.isPending}
                    onClick={() => move(category, 'up')}
                    className="text-ink-soft disabled:opacity-30 leading-none px-1"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${category.name} down`}
                    disabled={index === ordered.length - 1 || reorderCategory.isPending}
                    onClick={() => move(category, 'down')}
                    className="text-ink-soft disabled:opacity-30 leading-none px-1"
                  >
                    ▼
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="flex-1 border border-line bg-bg rounded-xl px-3 py-2 text-ink text-base outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={!editingName.trim() || renameCategory.isPending}
                        onClick={() => void saveEdit()}
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-white bg-primary-deep disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl px-3 py-2 text-sm text-ink-soft border border-line"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="text-left w-full truncate text-ink"
                    >
                      {category.name}
                      {category.is_locked && (
                        <span className="ml-2 text-xs text-ink-soft">(locked)</span>
                      )}
                    </button>
                  )}
                </div>

                {canDelete && !isEditing && (
                  <>
                    {isConfirmingDelete ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={deleteCategory.isPending}
                          onClick={() => void handleDelete(category)}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-white bg-neg disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-xl px-3 py-2 text-sm text-ink-soft border border-line"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove ${category.name}`}
                        onClick={() => setConfirmDeleteId(category.id)}
                        className="shrink-0 rounded-xl px-3 py-2 text-sm text-neg border border-line"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
