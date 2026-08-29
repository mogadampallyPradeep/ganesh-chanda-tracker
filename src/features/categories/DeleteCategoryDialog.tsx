import { useState } from 'react'
import { formatINR } from '../../lib/format'
import type { Category } from '../../types/db'

interface DeleteCategoryDialogProps {
  category: Category
  /** Every other category — the possible destinations for existing expenses. */
  destinations: Category[]
  expenseCount: number
  totalAmount: number
  isPending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (moveToId?: string) => void
}

export function DeleteCategoryDialog({
  category,
  destinations,
  expenseCount,
  totalAmount,
  isPending,
  error,
  onCancel,
  onConfirm,
}: DeleteCategoryDialogProps) {
  const hasExpenses = expenseCount > 0
  const [moveToId, setMoveToId] = useState(destinations[0]?.id ?? '')

  const blocked = hasExpenses && !moveToId

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Remove ${category.name}`}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-40 max-w-sm mx-auto bg-surface border border-line rounded-2xl p-5 shadow-md flex flex-col gap-3"
      >
        <h2 className="font-display text-lg font-bold text-ink">Remove {category.name}?</h2>

        {hasExpenses ? (
          <>
            <p className="text-sm text-ink-soft">
              {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'} totalling{' '}
              <span className="font-semibold text-ink">{formatINR(totalAmount)}</span>{' '}
              {expenseCount === 1 ? 'is' : 'are'} filed here. Nothing is deleted — they move to the
              category you choose.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-soft tracking-wide">Move them to</span>
              <select
                value={moveToId}
                onChange={(e) => setMoveToId(e.target.value)}
                className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
              >
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p className="text-sm text-ink-soft">
            Nothing is filed under this category, so it can be removed safely. Its budget estimate
            goes with it.
          </p>
        )}

        {error && <p className="text-neg text-sm">{error}</p>}

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            disabled={isPending || blocked}
            onClick={() => onConfirm(hasExpenses ? moveToId : undefined)}
            className="flex-1 rounded-xl px-4 py-3 font-bold text-white bg-neg disabled:opacity-50"
          >
            {isPending ? 'Removing…' : hasExpenses ? 'Move & Remove' : 'Remove'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-3 text-ink-soft border border-line"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
