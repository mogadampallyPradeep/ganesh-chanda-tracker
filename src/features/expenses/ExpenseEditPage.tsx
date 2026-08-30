import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useExpense, useDeleteExpense } from './useExpenses'
import { ExpenseForm } from './ExpenseForm'
import { ExpensePayments } from './ExpensePayments'
import { PayeeContact } from './PayeeContact'
import { useAuth } from '../auth/useAuth'

export function ExpenseEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { data: expense, isLoading, isError, error } = useExpense(id ?? '')
  const deleteExpense = useDeleteExpense()
  const [deleting, setDeleting] = useState(false)

  const onDelete = async () => {
    if (!expense) return
    if (!window.confirm(`Delete expense "${expense.description}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteExpense.mutateAsync(expense.id)
      navigate('/spend', { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Edit Spend</h1>

      {isLoading && <p className="text-ink-soft text-sm">Loading expense…</p>}
      {isError && (
        <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load expense'}</p>
      )}

      {expense && (
        <>
          <ExpenseForm
            expense={expense}
            onSaved={() => {
              navigate('/spend', { replace: true })
            }}
          />

          <PayeeContact payee={expense.payee} phone={expense.payee_phone} />

          <div className="w-full max-w-sm">
            <ExpensePayments expenseId={expense.id} total={expense.amount} />
          </div>

          {isAdmin && (
            <div className="w-full max-w-sm flex flex-col gap-2">
              {deleteExpense.isError && (
                <p className="text-neg text-sm">
                  {deleteExpense.error instanceof Error ? deleteExpense.error.message : 'Could not delete expense'}
                </p>
              )}
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="rounded-xl py-3 font-semibold text-neg bg-surface border border-neg/40 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Expense'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
