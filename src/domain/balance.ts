import type { Donation, Expense, Reimbursement } from '../types/db'

export interface Balance {
  collected: number
  spent: number
  available: number
  cashInHand: number
  inBank: number
}

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((t, r) => t + pick(r), 0)

/**
 * Fund balance, derived from rows (never stored).
 * - collected = all donations, spent = all expenses (any source)
 * - cash in hand = offline donations − cash spends − cash reimbursements
 * - in bank      = online donations − bank spends − bank reimbursements
 * - available    = cash in hand + in bank (the real money on hand)
 */
export function computeBalance(
  donations: Pick<Donation, 'amount' | 'method'>[],
  expenses: Pick<Expense, 'amount' | 'source'>[],
  reimbursements: Pick<Reimbursement, 'amount' | 'source'>[] = [],
): Balance {
  const collected = sum(donations, (d) => d.amount)
  const spent = sum(expenses, (e) => e.amount)

  const cashInHand =
    sum(donations.filter((d) => d.method === 'offline'), (d) => d.amount) -
    sum(expenses.filter((e) => e.source === 'cash'), (e) => e.amount) -
    sum(reimbursements.filter((r) => r.source === 'cash'), (r) => r.amount)

  const inBank =
    sum(donations.filter((d) => d.method === 'online'), (d) => d.amount) -
    sum(expenses.filter((e) => e.source === 'bank'), (e) => e.amount) -
    sum(reimbursements.filter((r) => r.source === 'bank'), (r) => r.amount)

  return { collected, spent, cashInHand, inBank, available: cashInHand + inBank }
}
