import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { donationSchema, type DonationInput } from './donationSchema'
import { useCreateDonation, useUpdateDonation, type CreateDonationInput } from './useDonations'
import { MethodToggle } from '../../components/common/MethodToggle'
import { AmountInput } from '../../components/common/AmountInput'
import type { Donation } from '../../types/db'

type SaveAction = 'share' | 'save'

const blankToNull = (value: string | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export function DonationForm({
  donation,
  onSaved,
}: {
  donation?: Donation
  onSaved: (donation: Donation, action: SaveAction) => void
}) {
  const isEdit = donation != null
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DonationInput>({
    resolver: zodResolver(donationSchema),
    defaultValues: donation
      ? {
          donor_name: donation.donor_name,
          address: donation.address ?? '',
          phone: donation.phone ?? '',
          amount: donation.amount,
          method: donation.method,
          note: donation.note ?? '',
        }
      : {
          donor_name: '',
          address: '',
          phone: '',
          amount: 0,
          method: 'offline',
          note: '',
        },
  })

  const createDonation = useCreateDonation()
  const updateDonation = useUpdateDonation()
  const [pendingAction, setPendingAction] = useState<SaveAction | null>(null)

  const submit = async (data: DonationInput, action: SaveAction) => {
    setPendingAction(action)
    try {
      const input: CreateDonationInput = {
        donor_name: data.donor_name.trim(),
        address: blankToNull(data.address),
        phone: blankToNull(data.phone),
        amount: data.amount,
        method: data.method,
        note: blankToNull(data.note),
      }
      const saved = isEdit
        ? await updateDonation.mutateAsync({ id: donation.id, ...input })
        : await createDonation.mutateAsync(input)
      onSaved(saved, action)
    } finally {
      setPendingAction(null)
    }
  }

  const activeMutation = isEdit ? updateDonation : createDonation
  const busy = pendingAction !== null

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
          <span className="text-xs text-ink-soft tracking-wide">Address</span>
          <input
            {...register('address')}
            placeholder="Optional"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Phone</span>
          <input
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
          <span className="text-xs text-ink-soft tracking-wide">Method</span>
          <Controller
            control={control}
            name="method"
            render={({ field }) => <MethodToggle value={field.value} onChange={field.onChange} />}
          />
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
            {activeMutation.error instanceof Error ? activeMutation.error.message : 'Could not save donation'}
          </p>
        )}

        {isEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit((data) => submit(data, 'save'))}
            className="mt-1 rounded-xl py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
          >
            {pendingAction === 'save' ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmit((data) => submit(data, 'share'))}
              className="mt-1 rounded-xl py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
            >
              {pendingAction === 'share' ? 'Saving…' : 'Save & Share Receipt'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmit((data) => submit(data, 'save'))}
              className="rounded-xl py-3 font-semibold text-ink bg-surface-2 border border-line disabled:opacity-50"
            >
              {pendingAction === 'save' ? 'Saving…' : 'Save only'}
            </button>
          </>
        )}
      </div>
    </form>
  )
}
