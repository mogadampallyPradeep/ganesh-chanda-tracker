import type { Donation, Expense, ExpensePayment, Reimbursement } from '../types/db'

export interface Balance {
  collected: number
  committed: number // total agreed across all expenses
  paidOut: number // money that has actually left the fund
  outstanding: number // committed − paidOut, i.e. yet to pay
  available: number // cash in hand + in bank (real money)
  unreimbursedPersonal: number // owed back to members for out-of-pocket spends; netted and floored PER MEMBER, so over-settling one member cannot cancel a debt owed to another. An over-reimbursement is a real cash loss already reflected in cashInHand, not a reserve to offset.
  freeAfterDues: number // available − outstanding − unreimbursedPersonal; negative is a real warning
  cashInHand: number
  inBank: number
}

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((t, r) => t + pick(r), 0)

/**
 * Fund balance, derived from rows (never stored).
 * Cash and bank move on PAYMENTS, not on expense totals — an unpaid balance
 * has not left the fund and must not be deducted from it.
 */
export function computeBalance(
  donations: Pick<Donation, 'amount' | 'method'>[],
  expenses: Pick<Expense, 'amount'>[],
  payments: Pick<ExpensePayment, 'amount' | 'source' | 'paid_by'>[],
  reimbursements: Pick<Reimbursement, 'amount' | 'source' | 'member_id'>[] = [],
): Balance {
  const collected = sum(donations, (d) => d.amount)
  const committed = sum(expenses, (e) => e.amount)
  const paidOut = sum(payments, (p) => p.amount)

  const cashInHand =
    sum(donations.filter((d) => d.method === 'offline'), (d) => d.amount) -
    sum(payments.filter((p) => p.source === 'cash'), (p) => p.amount) -
    sum(reimbursements.filter((r) => r.source === 'cash'), (r) => r.amount)

  const inBank =
    sum(donations.filter((d) => d.method === 'online'), (d) => d.amount) -
    sum(payments.filter((p) => p.source === 'bank'), (p) => p.amount) -
    sum(reimbursements.filter((r) => r.source === 'bank'), (r) => r.amount)

  const available = cashInHand + inBank
  const outstanding = committed - paidOut

  const owedByMember = new Map<string, number>()
  for (const p of payments) {
    if (p.source === 'personal' && p.paid_by) {
      owedByMember.set(p.paid_by, (owedByMember.get(p.paid_by) ?? 0) + p.amount)
    }
  }
  for (const r of reimbursements) {
    owedByMember.set(r.member_id, (owedByMember.get(r.member_id) ?? 0) - r.amount)
  }
  const unreimbursedPersonal = [...owedByMember.values()].reduce((t, v) => t + Math.max(0, v), 0)

  return {
    collected,
    committed,
    paidOut,
    outstanding,
    available,
    unreimbursedPersonal,
    freeAfterDues: available - outstanding - unreimbursedPersonal,
    cashInHand,
    inBank,
  }
}
