import { useEffect, useRef, useState } from 'react'
import { usePledges, usePledgeStatus, useClosePledge, useReopenPledge, useDeletePledge } from './usePledges'
import { buildPledges, type PledgeRow } from '../../domain/pledges'
import { PledgeForm } from './PledgeForm'
import { useCommitteeMembers } from '../committee/useCommittee'
import { useAuth } from '../auth/useAuth'
import { formatINR } from '../../lib/format'

type OpenForm = { kind: 'new' } | { kind: 'edit'; id: string } | null

export function PledgeList({ onRecordReceipt }: { onRecordReceipt: (pledgeId: string) => void }) {
  const { data: pledges, isLoading, isError, error } = usePledges()
  const {
    data: statuses,
    isPending: isStatusPending,
    isSuccess: isStatusLoaded,
    isError: isStatusError,
    error: statusError,
    isPaused: isStatusPaused,
  } = usePledgeStatus()
  const { data: members } = useCommitteeMembers()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState<OpenForm>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const closePledge = useClosePledge()
  const reopenPledge = useReopenPledge()
  const deletePledge = useDeletePledge()

  const { open, done } = buildPledges(pledges ?? [], statuses)

  // Amounts received are only known once the status query has genuinely landed.
  // Until then no row and, above all, no Record receipt button: a pledge that is
  // already fully paid would otherwise sit at the top of the open list at its full
  // promised amount, two taps from a duplicate receipt.
  const listsReady = !isLoading && !isError && isStatusLoaded

  // Awaiting the invalidation keeps a slow refresh honest, but React Query resolves a
  // refetch it has PARKED for being offline immediately, so 'success' can still be
  // serving pre-save rows. Offline she cannot save a donation anyway — that mutation
  // parks too — so withholding the one money action costs her nothing and closes the
  // window where a just-settled pledge still offers a second receipt.
  const canRecordReceipt = listsReady && !isStatusPaused

  const editingId = form?.kind === 'edit' ? form.id : null
  const editing = editingId ? pledges?.find((p) => p.id === editingId) ?? null : null

  useEffect(() => {
    if (editingId && pledges && !pledges.some((p) => p.id === editingId)) setForm(null)
  }, [editingId, pledges])

  // Only one of the two forms is ever mounted, so they share a ref. Keyed to which
  // form opened, so it fires once per open rather than on every background refetch.
  const openFormKey = form?.kind === 'new' ? 'new' : editingId

  useEffect(() => {
    if (!openFormKey) return
    const el = formRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.querySelector('input')?.focus({ preventScroll: true })
  }, [openFormKey])

  const nameFor = (mobile: string | null) => {
    if (!mobile) return 'Unassigned'
    return members?.find((m) => m.mobile === mobile)?.name ?? mobile
  }

  const busyPledgeId = (): string | null => {
    if (closePledge.isPending) return closePledge.variables?.id ?? null
    if (reopenPledge.isPending) return reopenPledge.variables ?? null
    if (deletePledge.isPending) return deletePledge.variables ?? null
    return null
  }
  const pendingId = busyPledgeId()

  // A failed close/reopen/delete leaves the row exactly where it was, so the message
  // belongs on that row — where she tapped — not only in a banner off the top of a
  // twelve-pledge list.
  const failureFor = (id: string): string | null => {
    if (closePledge.isError && closePledge.variables?.id === id) {
      const reason = closePledge.error instanceof Error ? closePledge.error.message : 'Could not close this pledge'
      return `${reason} — nothing changed, it is still expected.`
    }
    if (reopenPledge.isError && reopenPledge.variables === id) {
      const reason = reopenPledge.error instanceof Error ? reopenPledge.error.message : 'Could not reopen this pledge'
      return `${reason} — nothing changed, it is still closed.`
    }
    if (deletePledge.isError && deletePledge.variables === id) {
      const reason = deletePledge.error instanceof Error ? deletePledge.error.message : 'Could not delete this pledge'
      return `${reason} — nothing was deleted.`
    }
    return null
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

      {form?.kind === 'new' && (
        <div ref={formRef} className="scroll-mt-4">
          <PledgeForm onSaved={() => setForm(null)} />
        </div>
      )}

      {editing && (
        <div ref={formRef} className="flex flex-col gap-2 scroll-mt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-ink">Editing {editing.donor_name}</h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2"
            >
              Cancel
            </button>
          </div>
          <PledgeForm key={editing.id} pledge={editing} onSaved={() => setForm(null)} />
        </div>
      )}

      {(isLoading || isStatusPending) && <p className="text-ink-soft text-sm">Loading pledges…</p>}
      {isError && (
        <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load pledges'}</p>
      )}
      {isStatusError && (
        <p className="text-neg text-sm">
          {statusError instanceof Error ? statusError.message : 'Could not load what has been received'}
          {' — amounts received are missing, so pledges cannot be shown safely. Pull to refresh once you have signal.'}
        </p>
      )}

      {listsReady && isStatusPaused && (
        <p className="text-neg text-sm">
          No connection — amounts received may be out of date, so receipts cannot be recorded until you are
          back online. The figures below are the last ones this phone managed to load.
        </p>
      )}

      {listsReady && open.length === 0 && done.length === 0 && (
        <p className="text-ink-soft text-sm">
          No pledges yet. Add what people have promised so you can see how much more to expect.
        </p>
      )}

      {listsReady && open.length > 0 && (
        <ul className="flex flex-col gap-2">
          {open.map((row) => {
            const busy = pendingId === row.pledge.id
            const failure = failureFor(row.pledge.id)
            return (
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
                    disabled={busy || !canRecordReceipt}
                    onClick={() => onRecordReceipt(row.pledge.id)}
                    className="rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
                  >
                    Record receipt
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setForm({ kind: 'edit', id: row.pledge.id })}
                    className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onClose(row)}
                    className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2 disabled:opacity-50"
                  >
                    {closePledge.isPending && busy ? 'Closing…' : 'Close'}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(row)}
                      className="text-sm text-neg border border-neg/40 rounded-xl px-3 py-2 disabled:opacity-50"
                    >
                      {deletePledge.isPending && busy ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
                {failure && <p className="text-neg text-sm">{failure}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {listsReady && done.length > 0 && (
        <ul className="flex flex-col gap-2">
          {done.map((row) => {
            const busy = pendingId === row.pledge.id
            const failure = failureFor(row.pledge.id)
            return (
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
                      disabled={busy}
                      onClick={() => reopenPledge.mutate(row.pledge.id)}
                      className="self-start text-sm text-ink-soft border border-line rounded-xl px-3 py-2 disabled:opacity-50"
                    >
                      {reopenPledge.isPending && busy ? 'Reopening…' : 'Reopen'}
                    </button>
                  </>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(row)}
                    className="self-start text-sm text-neg border border-neg/40 rounded-xl px-3 py-2 disabled:opacity-50"
                  >
                    {deletePledge.isPending && busy ? 'Deleting…' : 'Delete'}
                  </button>
                )}

                {failure && <p className="text-neg text-sm">{failure}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
