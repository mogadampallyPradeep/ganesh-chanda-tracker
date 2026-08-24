import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenses } from './useExpenses'
import { ExpenseForm } from './ExpenseForm'
import { useCategories } from '../categories/useCategories'
import { formatINR } from '../../lib/format'
import type { Category, SpendSource } from '../../types/db'

function SourcePill({ source }: { source: SpendSource }) {
  const label = source === 'cash' ? 'Cash' : source === 'bank' ? 'Bank' : 'Self'
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        source === 'personal' ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-soft'
      }`}
    >
      {label}
    </span>
  )
}

export function ExpensesListPage() {
  const { data: expenses, isLoading, isError, error } = useExpenses()
  const { data: categories } = useCategories()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories ?? []) map.set(c.id, c)
    return map
  }, [categories])

  const filtered = useMemo(() => {
    const rows = expenses ?? []
    const q = search.trim().toLowerCase()
    if (q === '') return rows
    return rows.filter((e) => {
      const categoryName = categoryById.get(e.category_id)?.name ?? ''
      return e.description.toLowerCase().includes(q) || categoryName.toLowerCase().includes(q)
    })
  }, [expenses, search, categoryById])

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Spend</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
        >
          {showForm ? 'Cancel' : '+ New Spend'}
        </button>
      </div>

      {showForm && (
        <ExpenseForm
          onSaved={() => {
            setShowForm(false)
          }}
        />
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-soft tracking-wide">Search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by description or category"
          className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
        />
      </label>

      {isLoading && <p className="text-ink-soft text-sm">Loading expenses…</p>}
      {isError && (
        <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load expenses'}</p>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <p className="text-ink-soft text-sm">No expenses found.</p>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((expense) => (
          <li key={expense.id}>
            <button
              type="button"
              onClick={() => navigate(`/spend/${expense.id}`)}
              className="w-full flex items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-3 text-left"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-ink font-semibold truncate">{expense.description}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft truncate">
                    {categoryById.get(expense.category_id)?.name ?? 'Uncategorized'}
                  </span>
                  <SourcePill source={expense.source} />
                </div>
              </div>
              <span className="text-ink font-bold whitespace-nowrap">{formatINR(expense.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
