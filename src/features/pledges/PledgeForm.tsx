import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pledgeSchema, type PledgeInput } from './pledgeSchema'
import { useCreatePledge, useUpdatePledge, type CreatePledgeInput } from './usePledges'
import { useCommitteeMembers } from '../committee/useCommittee'
import { AmountInput } from '../../components/common/AmountInput'
import type { Pledge } from '../../types/db'

const blankToNull = (value: string | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export function PledgeForm({
  pledge,
  onSaved,
}: {
  pledge?: Pledge
  onSaved: () => void
}) {
  const isEdit = pledge != null
  const { data: members } = useCommitteeMembers()

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PledgeInput>({
    resolver: zodResolver(pledgeSchema),
    defaultValues: pledge
      ? {
          donor_name: pledge.donor_name,
          address: pledge.address ?? '',
          phone: pledge.phone ?? '',
          amount: pledge.amount,
          assigned_to: pledge.assigned_to ?? '',
          note: pledge.note ?? '',
        }
      : {
          donor_name: '',
          address: '',
          phone: '',
          amount: 0,
          assigned_to: '',
          note: '',
        },
  })

  const createPledge = useCreatePledge()
  const updatePledge = useUpdatePledge()
  const [saving, setSaving] = useState(false)

  const submit = async (data: PledgeInput) => {
    setSaving(true)
    try {
      const input: CreatePledgeInput = {
        donor_name: data.donor_name.trim(),
        phone: blankToNull(data.phone),
        address: blankToNull(data.address),
        amount: data.amount,
        note: blankToNull(data.note),
        assigned_to: blankToNull(data.assigned_to),
      }
      if (isEdit) {
        await updatePledge.mutateAsync({ id: pledge.id, ...input })
      } else {
        await createPledge.mutateAsync(input)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const activeMutation = isEdit ? updatePledge : createPledge

  return (
    <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-sm">
      <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Donor name</span>
          <input
            {...register('donor_name')}
            placeholder="Full name"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
          {errors.donor_name && <span className="text-neg text-xs">{errors.donor_name.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Phone</span>
          <input
            type="tel"
            inputMode="numeric"
            {...register('phone')}
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

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Who's chasing</span>
          <select
            {...register('assigned_to')}
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          >
            <option value="">Unassigned</option>
            {(members ?? []).map((m) => (
              <option key={m.mobile} value={m.mobile}>
                {m.name}
              </option>
            ))}
          </select>
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
            {activeMutation.error instanceof Error ? activeMutation.error.message : 'Could not save pledge'}
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
