import type { Donation, Expense, ExpensePayment, Reimbursement } from '../types/db'

export interface Balance {
  collected: number
  committed: number // total agreed across all expenses
  paidOut: number // money that has actually left the fund
  outstanding: number // committed − paidOut, i.e. yet to pay
  available: number // cash in hand + in bank (real money)
  unreimbursedPersonal: number // owed back to members for out-of-pocket spends
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
  payments: Pick<ExpensePayment, 'amount' | 'source'>[],
  reimbursements: Pick<Reimbursement, 'amount' | 'source'>[] = [],
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

  const unreimbursedPersonal =
    sum(payments.filter((p) => p.source === 'personal'), (p) => p.amount) -
    sum(reimbursements, (r) => r.amount)

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
