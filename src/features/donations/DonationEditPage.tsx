import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDonation, useDeleteDonation } from './useDonations'
import { DonationForm } from './DonationForm'
import { useAuth } from '../auth/useAuth'

export function DonationEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { data: donation, isLoading, isError, error } = useDonation(id ?? '')
  const deleteDonation = useDeleteDonation()
  const [deleting, setDeleting] = useState(false)

  const onDelete = async () => {
    if (!donation) return
    if (!window.confirm(`Delete donation from ${donation.donor_name}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteDonation.mutateAsync(donation.id)
      navigate('/collect', { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Edit Donation</h1>

      {isLoading && <p className="text-ink-soft text-sm">Loading donation…</p>}
      {isError && (
        <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load donation'}</p>
      )}

      {donation && (
        <>
          <DonationForm
            donation={donation}
            onSaved={() => {
              navigate('/collect', { replace: true })
            }}
          />

          {isAdmin && (
            <div className="w-full max-w-sm flex flex-col gap-2">
              {deleteDonation.isError && (
                <p className="text-neg text-sm">
                  {deleteDonation.error instanceof Error ? deleteDonation.error.message : 'Could not delete donation'}
                </p>
              )}
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="rounded-xl py-3 font-semibold text-neg bg-surface border border-neg/40 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Donation'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
