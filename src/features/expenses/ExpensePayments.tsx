import { useEffect, useState } from 'react'
import { useAddPayment, useDeletePayment, useExpensePayments } from './useExpensePayments'
import { useCommitteeMembers } from '../committee/useCommittee'
import { useAuth } from '../auth/useAuth'
import { AmountInput } from '../../components/common/AmountInput'
import { formatINR, formatDate } from '../../lib/format'
import type { CommitteeMember, SpendSource } from '../../types/db'

const sourceOptions: { value: SpendSource; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'personal', label: 'Self' },
]

function SourceToggle({ value, onChange }: { value: SpendSource; onChange: (s: SpendSource) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-line">
      {sourceOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            value === opt.value ? 'bg-primary text-white shadow-sm' : 'text-ink-soft'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function nameOf(members: CommitteeMember[] | undefined, mobile: string | null) {
  if (!mobile) return '—'
  return members?.find((m) => m.mobile === mobile)?.name ?? mobile
}

export function ExpensePayments({ expenseId, total }: { expenseId: string; total: number }) {
  const { data: allPayments } = useExpensePayments()
  const { data: members } = useCommitteeMembers()
  const { member } = useAuth()
  const addPayment = useAddPayment()
  const deletePayment = useDeletePayment()

  const payments = (allPayments ?? []).filter((p) => p.expense_id === expenseId)
  const paid = payments.reduce((t, p) => t + p.amount, 0)
  const balance = total - paid

  const [amount, setAmount] = useState(0)
  const [source, setSource] = useState<SpendSource>('cash')
  const [paidBy, setPaidBy] = useState(member?.mobile ?? '')

  // Default the new payment to whatever is outstanding, so settling is one tap.
  useEffect(() => setAmount(balance), [balance])

  const error = addPayment.error ?? deletePayment.error

  const submit = () => {
    addPayment.mutate(
      { expense_id: expenseId, amount, source, paid_by: paidBy },
      { onSuccess: () => setSource('cash') },
    )
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-ink font-semibold">{formatINR(paid)} paid</span>
        {balance > 0 ? (
          <span className="text-neg text-sm">{formatINR(balance)} due</span>
        ) : (
          <span className="text-xs text-ink-soft border border-line rounded-full px-2 py-0.5">✓ Settled</span>
        )}
      </div>

      {payments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-soft truncate">
                {formatDate(p.created_at)} · {nameOf(members, p.paid_by)} · {p.source}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-ink">{formatINR(p.amount)}</span>
                <button
                  type="button"
                  disabled={deletePayment.isPending}
                  onClick={() => deletePayment.mutate(p.id)}
                  className="text-xs text-neg disabled:opacity-50"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* The trigger's overpayment message must reach the user verbatim. */}
      {error && <p className="text-neg text-sm">{(error as Error).message}</p>}

      {balance > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-line">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Amount</span>
            <AmountInput value={amount} onChange={setAmount} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Paid from</span>
            <SourceToggle value={source} onChange={setSource} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Paid by</span>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
            >
              <option value="" disabled>
                Select member
              </option>
              {(members ?? []).map((m) => (
                <option key={m.mobile} value={m.mobile}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={addPayment.isPending || amount <= 0 || !paidBy}
            onClick={submit}
            className="rounded-xl px-4 py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
          >
            {addPayment.isPending ? 'Adding…' : 'Add payment'}
          </button>
        </div>
      )}
    </div>
  )
}
