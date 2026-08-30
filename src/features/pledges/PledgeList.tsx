import { useState } from 'react'
import { usePledges, usePledgeStatus, useClosePledge, useReopenPledge, useDeletePledge } from './usePledges'
import { buildPledges, type PledgeRow } from '../../domain/pledges'
import { PledgeForm } from './PledgeForm'
import { useCommitteeMembers } from '../committee/useCommittee'
import { useAuth } from '../auth/useAuth'
import { formatINR } from '../../lib/format'
import type { Pledge } from '../../types/db'

type OpenForm = { kind: 'new' } | { kind: 'edit'; pledge: Pledge } | null

export function PledgeList({ onRecordReceipt }: { onRecordReceipt: (row: PledgeRow) => void }) {
  const { data: pledges, isLoading, isError, error } = usePledges()
  const { data: statuses, isError: isStatusError, error: statusError } = usePledgeStatus()
  const { data: members } = useCommitteeMembers()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState<OpenForm>(null)

  const closePledge = useClosePledge()
  const reopenPledge = useReopenPledge()
  const deletePledge = useDeletePledge()

  const { open, done } = buildPledges(pledges ?? [], statuses ?? [])

  const nameFor = (mobile: string | null) => {
    if (!mobile) return 'Unassigned'
    return members?.find((m) => m.mobile === mobile)?.name ?? mobile
  }

  const onClose = (row: PledgeRow) => {
    if (!window.confirm(`Stop expecting ${formatINR(row.balance)} from ${row.pledge.donor_name}?`)) return
    const reason = window.prompt('Reason? (optional)')
    closePledge.mutate({ id: row.pledge.id, closed_note: reason?.trim() || null })
  }

  const onDelete = (row: PledgeRow) => {
    const kept = row.received > 0 ? ` Receipts already recorded (${formatINR(row.received)}) will be kept.` : ''
    if (!window.confirm(`Delete ${row.pledge.donor_name}'s pledge?${kept}`)) return
    deletePledge.mutate(row.pledge.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setForm((f) => (f?.kind === 'new' ? null : { kind: 'new' }))}
          className="rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
        >
          {form?.kind === 'new' ? 'Cancel' : '+ New Pledge'}
        </button>
      </div>

      {form?.kind === 'new' && <PledgeForm onSaved={() => setForm(null)} />}

      {form?.kind === 'edit' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-ink">Editing {form.pledge.donor_name}</h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2"
            >
              Cancel
            </button>
          </div>
          <PledgeForm key={form.pledge.id} pledge={form.pledge} onSaved={() => setForm(null)} />
        </div>
      )}

      {isLoading && <p className="text-ink-soft text-sm">Loading pledges…</p>}
      {isError && (
        <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load pledges'}</p>
      )}
      {isStatusError && (
        <p className="text-neg text-sm">
          {statusError instanceof Error ? statusError.message : 'Could not load what has been received'}
          {' — amounts received are missing, so these figures are not reliable.'}
        </p>
      )}

      {!isLoading && !isError && open.length === 0 && done.length === 0 && (
        <p className="text-ink-soft text-sm">
          No pledges yet. Add what people have promised so you can see how much more to expect.
        </p>
      )}

      {open.length > 0 && (
        <ul className="flex flex-col gap-2">
          {open.map((row) => (
            <li
              key={row.pledge.id}
              className="bg-surface border border-line rounded-2xl px-4 py-3 flex flex-col gap-2"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-ink font-semibold truncate">{row.pledge.donor_name}</span>
                <span className="text-ink font-bold">
                  {row.received > 0
                    ? `${formatINR(row.received)} of ${formatINR(row.pledged)}`
                    : formatINR(row.pledged)}
                </span>
                <span className="text-xs text-ink-soft">{nameFor(row.pledge.assigned_to)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onRecordReceipt(row)}
                  className="rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
                >
                  Record receipt
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ kind: 'edit', pledge: row.pledge })}
                  className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onClose(row)}
                  className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2"
                >
                  Close
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="text-sm text-neg border border-neg/40 rounded-xl px-3 py-2"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <ul className="flex flex-col gap-2">
          {done.map((row) => (
            <li
              key={row.pledge.id}
              className="bg-surface-2 border border-line rounded-2xl px-4 py-3 flex flex-col gap-2 text-ink-soft"
            >
              <span className="font-semibold truncate">{row.pledge.donor_name}</span>

              {row.state === 'received' && <p className="text-xs">✓ {formatINR(row.received)}</p>}

              {row.state === 'closed' && (
                <>
                  <p className="text-xs">
                    {formatINR(row.received)} of {formatINR(row.pledged)} · closed
                    {row.pledge.closed_note ? ` — ${row.pledge.closed_note}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => reopenPledge.mutate(row.pledge.id)}
                    className="self-start text-sm text-ink-soft border border-line rounded-xl px-3 py-2"
                  >
                    Reopen
                  </button>
                </>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  className="self-start text-sm text-neg border border-neg/40 rounded-xl px-3 py-2"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
