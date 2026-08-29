import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenses } from './useExpenses'
import { useExpensePayments, useExpenseStatus } from './useExpensePayments'
import { ExpenseForm } from './ExpenseForm'
import { useCategories } from '../categories/useCategories'
import { formatINR } from '../../lib/format'
import type { Category, ExpenseStatus, SpendSource } from '../../types/db'

// Where the money actually came from, read off the payments. The expense row's
// own `source` is a leftover from before payments existed and lies as soon as
// an expense is booked one way and settled another.
type PaidFrom = SpendSource | 'mixed' | 'unpaid'

const paidFromLabel: Record<PaidFrom, string> = {
  cash: 'Cash',
  bank: 'Bank',
  personal: 'Self',
  mixed: 'Mixed',
  unpaid: 'Unpaid',
}

function SourcePill({ paidFrom }: { paidFrom: PaidFrom }) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        paidFrom === 'personal' ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-soft'
      }`}
    >
      {paidFromLabel[paidFrom]}
    </span>
  )
}

export function ExpensesListPage() {
  const { data: expenses, isLoading, isError, error } = useExpenses()
  const { data: categories } = useCategories()
  const { data: statuses } = useExpenseStatus()
  const { data: payments } = useExpensePayments()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories ?? []) map.set(c.id, c)
    return map
  }, [categories])

  const statusByExpenseId = useMemo(() => {
    const map = new Map<string, ExpenseStatus>()
    for (const s of statuses ?? []) map.set(s.expense_id, s)
    return map
  }, [statuses])

  const paidFromByExpenseId = useMemo(() => {
    const sources = new Map<string, Set<SpendSource>>()
    for (const p of payments ?? []) {
      const seen = sources.get(p.expense_id) ?? new Set<SpendSource>()
      seen.add(p.source)
      sources.set(p.expense_id, seen)
    }
    const map = new Map<string, PaidFrom>()
    for (const [expenseId, seen] of sources) {
      map.set(expenseId, seen.size === 1 ? [...seen][0] : 'mixed')
    }
    return map
  }, [payments])

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
        {filtered.map((expense) => {
          const status = statusByExpenseId.get(expense.id)
          return (
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
                    <SourcePill paidFrom={paidFromByExpenseId.get(expense.id) ?? 'unpaid'} />
                    {status && status.balance > 0 && (
                      <span className="text-xs text-neg border border-line rounded-full px-2 py-0.5">
                        {formatINR(status.balance)} due
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-ink font-bold whitespace-nowrap">{formatINR(expense.amount)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
