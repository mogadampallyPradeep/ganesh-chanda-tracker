import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useFundSettings, useUpdateFundSettings } from './useFundSettings'

// Editing is admin-only (design spec Auth section: admins "manage committee &
// fund settings"). Non-admins always see plain text, never inputs — `canEdit`
// below is gated on isAdmin regardless of local `editing` state, so there is
// no path for a non-admin to make this form editable.
// public_token is system-generated and is never shown here as an editable field.
export function FundSettingsPage() {
  const { isAdmin } = useAuth()
  const settingsQuery = useFundSettings()
  const updateSettings = useUpdateFundSettings()

  const [editing, setEditing] = useState(false)
  const [mandalName, setMandalName] = useState('')
  const [festivalYear, setFestivalYear] = useState(0)
  const [receiptPrefix, setReceiptPrefix] = useState('')
  const [currency, setCurrency] = useState('')

  useEffect(() => {
    if (!settingsQuery.data) return
    setMandalName(settingsQuery.data.mandal_name)
    setFestivalYear(settingsQuery.data.festival_year)
    setReceiptPrefix(settingsQuery.data.receipt_prefix)
    setCurrency(settingsQuery.data.currency)
  }, [settingsQuery.data])

  if (settingsQuery.isLoading) {
    return <div className="p-6 text-center text-ink-soft">Loading fund settings…</div>
  }

  if (settingsQuery.error || !settingsQuery.data) {
    return (
      <div className="p-6 text-center text-neg">
        {settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Could not load fund settings'}
      </div>
    )
  }

  const settings = settingsQuery.data
  const canEdit = isAdmin && editing

  const startEdit = () => setEditing(true)

  const cancel = () => {
    setMandalName(settings.mandal_name)
    setFestivalYear(settings.festival_year)
    setReceiptPrefix(settings.receipt_prefix)
    setCurrency(settings.currency)
    setEditing(false)
  }

  const submit = async () => {
    if (!isAdmin) return
    await updateSettings.mutateAsync({
      id: settings.id,
      mandal_name: mandalName.trim(),
      festival_year: festivalYear,
      receipt_prefix: receiptPrefix.trim(),
      currency: currency.trim(),
    })
    setEditing(false)
  }

  const canSubmit =
    !updateSettings.isPending && mandalName.trim().length > 0 && receiptPrefix.trim().length > 0 && festivalYear > 0

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Fund settings</h1>
        {isAdmin && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
          >
            Edit
          </button>
        )}
      </div>

      <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <Field label="Mandal name" value={mandalName} onChange={setMandalName} editable={canEdit} />
        <Field
          label="Festival year"
          value={String(festivalYear)}
          onChange={(v) => setFestivalYear(Number(v) || 0)}
          editable={canEdit}
          type="number"
        />
        <Field label="Receipt prefix" value={receiptPrefix} onChange={setReceiptPrefix} editable={canEdit} />
        <Field label="Currency" value={currency} onChange={setCurrency} editable={canEdit} />

        {!isAdmin && <p className="text-xs text-ink-soft">Only admins can edit fund settings.</p>}

        {updateSettings.isError && (
          <p className="text-neg text-sm">
            {updateSettings.error instanceof Error ? updateSettings.error.message : 'Could not save fund settings'}
          </p>
        )}

        {isAdmin && editing && (
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
            >
              {updateSettings.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-soft border border-line"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  editable,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  editable: boolean
  type?: 'text' | 'number'
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-soft tracking-wide">{label}</span>
      {editable ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
        />
      ) : (
        <p className="text-ink font-medium px-0.5 py-1">{value}</p>
      )}
    </label>
  )
}
