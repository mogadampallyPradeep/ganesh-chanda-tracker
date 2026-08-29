import { useMemo, useState } from 'react'
import { useCategories } from '../categories/useCategories'
import { useExpenses } from '../expenses/useExpenses'
import { useExpensePayments } from '../expenses/useExpensePayments'
import { useDonations } from '../donations/useDonations'
import { useCommitteeReimbursements } from '../committee/useCommittee'
import { useEstimates } from './useEstimates'
import { EstimatesEditor } from './EstimatesEditor'
import { computeBudget, computeShortfall, type BudgetRow } from '../../domain/budget'
import { computeBalance } from '../../domain/balance'
import { StatCard } from '../../components/common/StatCard'
import { formatINR } from '../../lib/format'

export function BudgetPage() {
  const categoriesQuery = useCategories()
  const estimatesQuery = useEstimates()
  const expensesQuery = useExpenses()
  const paymentsQuery = useExpensePayments()
  const donationsQuery = useDonations()
  const reimbursementsQuery = useCommitteeReimbursements()

  const loading =
    categoriesQuery.isLoading ||
    estimatesQuery.isLoading ||
    expensesQuery.isLoading ||
    paymentsQuery.isLoading ||
    donationsQuery.isLoading ||
    reimbursementsQuery.isLoading
  const loadError =
    categoriesQuery.error ??
    estimatesQuery.error ??
    expensesQuery.error ??
    paymentsQuery.error ??
    donationsQuery.error ??
    reimbursementsQuery.error

  const [editingEstimates, setEditingEstimates] = useState(false)

  const categories = categoriesQuery.data ?? []
  const estimates = estimatesQuery.data ?? []
  const expenses = expensesQuery.data ?? []
  const payments = paymentsQuery.data ?? []
  const donations = donationsQuery.data ?? []
  const reimbursements = reimbursementsQuery.data ?? []

  const budget = useMemo(() => computeBudget(categories, estimates, expenses), [categories, estimates, expenses])

  const balance = useMemo(
    () => computeBalance(donations, expenses, payments, reimbursements),
    [donations, expenses, payments, reimbursements],
  )

  const shortfall = useMemo(
    () => computeShortfall(budget.totalEstimated, balance.collected, balance.committed),
    [budget.totalEstimated, balance.collected, balance.committed],
  )

  if (loading) {
    return <div className="p-6 text-center text-ink-soft">Loading budget…</div>
  }

  if (loadError) {
    return (
      <div className="p-6 text-center text-neg">
        {loadError instanceof Error ? loadError.message : 'Could not load budget'}
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Budget</h1>
        <button
          type="button"
          onClick={() => setEditingEstimates((v) => !v)}
          className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
        >
          {editingEstimates ? 'Close editor' : 'Edit estimates'}
        </button>
      </div>

      {editingEstimates && (
        <EstimatesEditor categories={categories} estimates={estimates} onDone={() => setEditingEstimates(false)} />
      )}

      {/* Prominent overall shortfall: how much more needs to be raised, and how much
          budget is left to spend, against the total estimated cost. */}
      <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-ink-soft tracking-wide">Total estimated</p>
        <p className="font-display text-2xl font-bold text-ink mt-1">{formatINR(budget.totalEstimated)}</p>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <StatCard
            label="Still to raise"
            value={formatINR(Math.max(0, shortfall.toRaise))}
            tone={shortfall.toRaise > 0 ? 'neg' : 'pos'}
          />
          <StatCard
            label="Left to spend"
            value={formatINR(Math.max(0, shortfall.leftToSpend))}
            tone={shortfall.leftToSpend < 0 ? 'neg' : 'default'}
          />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-ink-soft mb-1">
            <span>Collected</span>
            <span>{shortfall.collectedPercent}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-pos"
              style={{ width: `${shortfall.collectedPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {budget.rows.map((row) => (
          <BudgetRowCard key={row.categoryId} row={row} />
        ))}

        {budget.unbudgeted > 0 && (
          <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">Unbudgeted</p>
              <p className="text-neg font-semibold">{formatINR(budget.unbudgeted)}</p>
            </div>
            <p className="text-xs text-ink-soft mt-1">Spends in categories with no estimate set.</p>
          </div>
        )}

        <div className="bg-surface-2 border border-line rounded-2xl p-4 flex items-center justify-between">
          <p className="font-bold text-ink">Total</p>
          <p className="text-ink-soft text-sm">
            <span className="font-bold text-ink">{formatINR(budget.totalActual)}</span> / {formatINR(budget.totalEstimated)}
          </p>
        </div>
      </div>
    </div>
  )
}

function BudgetRowCard({ row }: { row: BudgetRow }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink truncate">{row.name}</p>
        <p className="text-sm text-ink-soft whitespace-nowrap">
          <span className={`font-semibold ${row.over ? 'text-neg' : 'text-ink'}`}>{formatINR(row.actual)}</span> /{' '}
          {formatINR(row.estimated)}
        </p>
      </div>

      <div className="h-2 rounded-full bg-surface-2 overflow-hidden mt-2">
        <div
          className={`h-full rounded-full ${row.over ? 'bg-neg' : 'bg-primary'}`}
          style={{ width: `${row.percent}%` }}
        />
      </div>

      {row.over && <p className="text-xs text-neg mt-1">Over by {formatINR(Math.abs(row.remaining))}</p>}
    </div>
  )
}
