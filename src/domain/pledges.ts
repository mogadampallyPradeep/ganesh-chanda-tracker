import type { Pledge, PledgeStatus } from '../types/db'

export type PledgeState = 'open' | 'received' | 'closed'

export interface PledgeRow {
  pledge: Pledge
  pledged: number
  received: number
  balance: number
  state: PledgeState
}

export interface PledgeSummary {
  open: PledgeRow[] // still chasing, largest outstanding first
  done: PledgeRow[] // received or closed, newest first
  expectedOutstanding: number
}

/**
 * State precedence is received -> closed -> open: what actually happened matters
 * more than an administrative flag, and both non-open states are excluded from
 * the expected figure anyway.
 *
 * expectedOutstanding floors EACH pledge at zero before summing. Flooring the
 * total instead would let one donor's over-payment silently cancel another
 * donor's outstanding promise.
 */
export function buildPledges(pledges: Pledge[], statuses: PledgeStatus[]): PledgeSummary {
  const statusById = new Map(statuses.map((s) => [s.pledge_id, s]))

  const rows: PledgeRow[] = pledges.map((pledge) => {
    const status = statusById.get(pledge.id)
    const pledged = status?.pledged ?? pledge.amount
    const received = status?.received ?? 0
    const balance = Math.max(0, pledged - received)

    const state: PledgeState =
      received >= pledged ? 'received' : pledge.closed_at ? 'closed' : 'open'

    return { pledge, pledged, received, balance, state }
  })

  const open = rows
    .filter((r) => r.state === 'open')
    .sort((a, b) => b.balance - a.balance)

  const done = rows
    .filter((r) => r.state !== 'open')
    .sort((a, b) => b.pledge.created_at.localeCompare(a.pledge.created_at))

  return {
    open,
    done,
    expectedOutstanding: open.reduce((total, r) => total + r.balance, 0),
  }
}
