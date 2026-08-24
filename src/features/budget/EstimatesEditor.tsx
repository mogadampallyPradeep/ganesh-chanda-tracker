import { useState } from 'react'
import { AmountInput } from '../../components/common/AmountInput'
import { useUpsertEstimate } from './useEstimates'
import type { Category, Estimate } from '../../types/db'

// One AmountInput per category (already ordered by display_order by the caller),
// saving on blur via an upsert keyed on category_id — estimates rows always
// pre-exist (one per category, seeded at 0), so this never creates duplicates.
export function EstimatesEditor({
  categories,
  estimates,
  onDone,
}: {
  categories: Category[]
  estimates: Estimate[]
  onDone: () => void
}) {
  const upsertEstimate = useUpsertEstimate()
  const estByCat = new Map(estimates.map((e) => [e.category_id, e.estimated_amount]))

  const [drafts, setDrafts] = useState<Record<string, number>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, estByCat.get(c.id) ?? 0])),
  )
  const [savedId, setSavedId] = useState<string | null>(null)

  const save = async (categoryId: string) => {
    const estimated_amount = drafts[categoryId] ?? 0
    if (estimated_amount === (estByCat.get(categoryId) ?? 0)) return
    await upsertEstimate.mutateAsync({ category_id: categoryId, estimated_amount })
    setSavedId(categoryId)
    setTimeout(() => setSavedId((id) => (id === categoryId ? null : id)), 1200)
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">Edit estimates</h2>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-soft">
          Done
        </button>
      </div>

      {upsertEstimate.isError && (
        <p className="text-neg text-sm">
          {upsertEstimate.error instanceof Error ? upsertEstimate.error.message : 'Could not save estimate'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <label key={category.id} className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide flex items-center gap-1.5">
              {category.name}
              {savedId === category.id && <span className="text-pos font-semibold">Saved</span>}
            </span>
            <AmountInput
              value={drafts[category.id] ?? 0}
              onChange={(n) => setDrafts((d) => ({ ...d, [category.id]: n }))}
            />
            <button
              type="button"
              disabled={upsertEstimate.isPending || (drafts[category.id] ?? 0) === (estByCat.get(category.id) ?? 0)}
              onClick={() => void save(category.id)}
              className="self-start rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-primary-deep disabled:opacity-50"
            >
              Save
            </button>
          </label>
        ))}
      </div>
    </div>
  )
}
