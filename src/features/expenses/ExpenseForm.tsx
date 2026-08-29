import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, type ExpenseInput } from './expenseSchema'
import {
  useCreateExpenseWithPayment,
  useUpdateExpense,
  type CreateExpenseInput,
  type CreateExpenseWithPaymentInput,
} from './useExpenses'
import { useCategories } from '../categories/useCategories'
import { useCommitteeMembers } from '../committee/useCommittee'
import { useAuth } from '../auth/useAuth'
import { CategorySelect } from '../../components/common/CategorySelect'
import { AmountInput } from '../../components/common/AmountInput'
import { formatINR } from '../../lib/format'
import type { Expense, SpendSource } from '../../types/db'

const blankToNull = (value: string | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

// Paid-from choice: Committee fund (draws down that fund's quota, split
// Cash/Bank) vs Self (an out-of-pocket spend logged as a reimbursement owed
// to the payer — the fund itself is untouched). Directly sets `source`.
const sourceOptions: { value: SpendSource; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'personal', label: 'Self' },
]

function SourceToggle({ value, onChange }: { value: SpendSource; onChange: (s: SpendSource) => void }) {
  return (
    <div className="flex flex-col gap-1">
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
      <span className="text-xs text-ink-soft">
        {value === 'personal'
          ? 'Self: out-of-pocket, owed back to the payer as a reimbursement'
          : 'Committee fund: paid from mandal cash or bank'}
      </span>
    </div>
  )
}

export function ExpenseForm({
  expense,
  onSaved,
}: {
  expense?: Expense
  onSaved: (expense: Expense) => void
}) {
  const isEdit = expense != null
  const { data: categories } = useCategories()
  const { data: members } = useCommitteeMembers()
  const { member } = useAuth()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          category_id: expense.category_id,
          description: expense.description,
          payee: expense.payee ?? '',
          amount: expense.amount,
          paid_now: expense.amount,
          paid_by: expense.paid_by ?? '',
          source: expense.source,
          note: expense.note ?? '',
        }
      : {
          category_id: '',
          description: '',
          payee: '',
          amount: 0,
          paid_now: 0,
          paid_by: member?.mobile ?? '',
          source: 'cash',
          note: '',
        },
  })

  const amount = useWatch({ control, name: 'amount' })
  const paidNow = useWatch({ control, name: 'paid_now' })
  const [paidNowTouched, setPaidNowTouched] = useState(false)

  // Mirror the total until the user takes control of this field, so a user who
  // never touches "Paid now" gets exactly today's behaviour.
  useEffect(() => {
    if (!paidNowTouched) setValue('paid_now', amount)
  }, [amount, paidNowTouched, setValue])

  const createExpenseWithPayment = useCreateExpenseWithPayment()
  const updateExpense = useUpdateExpense()
  const [saving, setSaving] = useState(false)

  const submit = async (data: ExpenseInput) => {
    setSaving(true)
    try {
      let saved: Expense
      if (isEdit) {
        const input: CreateExpenseInput = {
          category_id: data.category_id,
          description: data.description.trim(),
          payee: blankToNull(data.payee),
          amount: data.amount,
          paid_by: data.paid_by,
          source: data.source,
          note: blankToNull(data.note),
        }
        saved = await updateExpense.mutateAsync({ id: expense.id, ...input })
      } else {
        const input: CreateExpenseWithPaymentInput = {
          category_id: data.category_id,
          description: data.description.trim(),
          payee: blankToNull(data.payee),
          amount: data.amount,
          paid_now: data.paid_now,
          paid_by: data.paid_by,
          source: data.source,
          note: blankToNull(data.note),
        }
        saved = await createExpenseWithPayment.mutateAsync(input)
      }
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  const activeMutation = isEdit ? updateExpense : createExpenseWithPayment

  return (
    <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-sm">
      <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Category</span>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <CategorySelect categories={categories ?? []} value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.category_id && <span className="text-neg text-xs">{errors.category_id.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Description</span>
          <input
            {...register('description')}
            placeholder="What was this for?"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
          {errors.description && <span className="text-neg text-xs">{errors.description.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Payee</span>
          <input
            {...register('payee')}
            placeholder="Optional"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Amount</span>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => <AmountInput value={field.value} onChange={field.onChange} />}
          />
          {errors.amount && <span className="text-neg text-xs">{errors.amount.message}</span>}
        </label>

        {!isEdit && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Paid now</span>
            <Controller
              control={control}
              name="paid_now"
              render={({ field }) => (
                <AmountInput
                  value={field.value}
                  onChange={(v) => {
                    setPaidNowTouched(true)
                    field.onChange(v)
                  }}
                />
              )}
            />
            {errors.paid_now && <span className="text-neg text-xs">{errors.paid_now.message}</span>}
            {paidNow < amount ? (
              <span className="text-xs text-ink-soft">
                Balance {formatINR(amount - paidNow)} due later
              </span>
            ) : (
              <span className="text-xs text-ink-soft">
                Leave as the full amount unless you are paying an advance.
              </span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Paid from</span>
          <Controller
            control={control}
            name="source"
            render={({ field }) => <SourceToggle value={field.value} onChange={field.onChange} />}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Paid by</span>
          <select
            {...register('paid_by')}
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
          {errors.paid_by && <span className="text-neg text-xs">{errors.paid_by.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Note</span>
          <input
            {...register('note')}
            placeholder="Optional"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
        </label>

        {activeMutation.isError && (
          <p className="text-neg text-sm">
            {activeMutation.error instanceof Error ? activeMutation.error.message : 'Could not save expense'}
          </p>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit(submit)}
          className="mt-1 rounded-xl py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
