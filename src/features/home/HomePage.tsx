import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useDonations } from '../donations/useDonations'
import { useExpenses } from '../expenses/useExpenses'
import { useExpensePayments } from '../expenses/useExpensePayments'
import { useCategories } from '../categories/useCategories'
import { useEstimates } from '../budget/useEstimates'
import { useCommitteeReimbursements } from '../committee/useCommittee'
import { computeBalance } from '../../domain/balance'
import { computeBudget, computeShortfall } from '../../domain/budget'
import { formatINR, formatDate } from '../../lib/format'

interface Activity {
  id: string
  kind: 'in' | 'out'
  title: string
  subtitle: string
  amount: number
  createdAt: string
}

export function HomePage() {
  const { member, isAdmin } = useAuth()
  const navigate = useNavigate()

  const donationsQuery = useDonations()
  const expensesQuery = useExpenses()
  const paymentsQuery = useExpensePayments()
  const categoriesQuery = useCategories()
  const estimatesQuery = useEstimates()
  const reimbursementsQuery = useCommitteeReimbursements()

  const loading =
    donationsQuery.isLoading ||
    expensesQuery.isLoading ||
    paymentsQuery.isLoading ||
    categoriesQuery.isLoading ||
    estimatesQuery.isLoading ||
    reimbursementsQuery.isLoading
  const loadError =
    donationsQuery.error ??
    expensesQuery.error ??
    paymentsQuery.error ??
    categoriesQuery.error ??
    estimatesQuery.error ??
    reimbursementsQuery.error

  const donations = donationsQuery.data ?? []
  const expenses = expensesQuery.data ?? []
  const payments = paymentsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const estimates = estimatesQuery.data ?? []
  const reimbursements = reimbursementsQuery.data ?? []

  const balance = useMemo(
    () => computeBalance(donations, expenses, payments, reimbursements),
    [donations, expenses, payments, reimbursements],
  )
  const budget = useMemo(
    () => computeBudget(categories, estimates, expenses, payments),
    [categories, estimates, expenses, payments],
  )
  const shortfall = useMemo(
    () => computeShortfall(budget.totalEstimated, balance.collected, balance.committed),
    [budget.totalEstimated, balance.collected, balance.committed],
  )

  const recent = useMemo<Activity[]>(() => {
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const ins: Activity[] = donations.map((d) => ({
      id: `d-${d.id}`,
      kind: 'in',
      title: d.donor_name,
      subtitle: d.method === 'online' ? 'Online' : 'Offline',
      amount: d.amount,
      createdAt: d.created_at,
    }))
    const outs: Activity[] = expenses.map((e) => ({
      id: `e-${e.id}`,
      kind: 'out',
      title: catName.get(e.category_id) ?? 'Spend',
      subtitle: e.description,
      amount: e.amount,
      createdAt: e.created_at,
    }))
    return [...ins, ...outs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  }, [donations, expenses, categories])

  if (loading) {
    return <div className="p-6 text-center text-ink-soft">Loading dashboard…</div>
  }
  if (loadError) {
    return (
      <div className="p-6 text-center text-neg">
        {loadError instanceof Error ? loadError.message : 'Could not load dashboard'}
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <header className="text-center">
        <p className="text-gold text-sm" style={{ fontFamily: 'Noto Sans Telugu, Gautami, Nirmala UI, system-ui' }}>
          శ్రీ గణేశాయ నమః
        </p>
        <p className="text-ink-soft text-sm mt-0.5">
          Namaste, <b className="text-ink">{member?.name}</b>
          {isAdmin && <span className="ml-1 text-primary-deep">(admin)</span>}
        </p>
      </header>

      {/* Balance hero */}
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-primary to-primary-deep shadow-sm">
        <p className="text-sm/none opacity-90">Available balance</p>
        <p className="font-display text-4xl font-bold mt-1.5">{formatINR(balance.available)}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-xs opacity-90">Collected</p>
            <p className="font-bold text-lg mt-0.5">{formatINR(balance.collected)}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-xs opacity-90">Spent</p>
            <p className="font-bold text-lg mt-0.5">{formatINR(balance.paidOut)}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/collect')}
          className="rounded-2xl px-4 py-3.5 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep shadow-sm"
        >
          + Collect Chanda
        </button>
        <button
          type="button"
          onClick={() => navigate('/spend')}
          className="rounded-2xl px-4 py-3.5 font-semibold text-primary-deep bg-surface border border-line shadow-sm"
        >
          + Add Spend
        </button>
      </div>

      {/* Cash / bank split */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-line rounded-2xl p-4">
          <p className="text-xs text-ink-soft tracking-wide">Cash in hand</p>
          <p className="font-display text-2xl font-bold text-ink mt-1">{formatINR(balance.cashInHand)}</p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-4">
          <p className="text-xs text-ink-soft tracking-wide">In bank</p>
          <p className="font-display text-2xl font-bold text-ink mt-1">{formatINR(balance.inBank)}</p>
        </div>
      </div>

      {/* Budget progress */}
      {budget.totalEstimated > 0 && (
        <button
          type="button"
          onClick={() => navigate('/budget')}
          className="text-left bg-surface border border-line rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink">Budget goal</p>
            <p className="text-sm text-ink-soft">{shortfall.collectedPercent}%</p>
          </div>
          <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden mt-2">
            <div className="h-full rounded-full bg-pos" style={{ width: `${shortfall.collectedPercent}%` }} />
          </div>
          <p className="text-xs text-ink-soft mt-2">
            {shortfall.toRaise > 0 ? (
              <>
                Need <span className="font-semibold text-ink">{formatINR(shortfall.toRaise)}</span> more of{' '}
                {formatINR(budget.totalEstimated)} estimated
              </>
            ) : (
              <span className="text-pos font-semibold">Goal reached — {formatINR(budget.totalEstimated)} estimated</span>
            )}
          </p>
        </button>
      )}

      {/* Recent activity */}
      <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-ink">Recent activity</p>
          <button
            type="button"
            onClick={() => navigate('/activity')}
            className="text-sm font-semibold text-primary-deep"
          >
            See all →
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-ink-soft text-sm">No entries yet. Start by collecting chanda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`grid place-items-center w-8 h-8 rounded-full shrink-0 bg-surface-2 text-base font-bold ${
                    a.kind === 'in' ? 'text-pos' : 'text-neg'
                  }`}
                >
                  {a.kind === 'in' ? '↓' : '↑'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">{a.title}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {a.subtitle} · {formatDate(a.createdAt)}
                  </p>
                </div>
                <p className={`font-bold whitespace-nowrap ${a.kind === 'in' ? 'text-pos' : 'text-neg'}`}>
                  {a.kind === 'in' ? '+' : '−'}
                  {formatINR(a.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
