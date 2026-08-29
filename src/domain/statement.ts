import type { DonationMethod } from '../types/db'

export interface PublicDonationRow {
  receipt_no: string | null
  donor_name: string
  amount: number
  method: DonationMethod
}
export interface PublicExpenseRow {
  category_name: string
  description: string
  amount: number
  paid: number
  balance: number
}
export interface StatementSummary {
  collected: number
  committed: number
  spent: number
  outstanding: number
  available: number
  cashInHand: number
  inBank: number
}

type Cell = string | number
type Sheet = Cell[][]

/** Arrays-of-rows for Excel export (aoa_to_sheet), each with a bold total row. */
export function buildStatementSheets(input: {
  donations: PublicDonationRow[]
  expenses: PublicExpenseRow[]
  summary: StatementSummary
}): { donations: Sheet; expenses: Sheet; summary: Sheet } {
  const donations: Sheet = [['Receipt No', 'Donor', 'Method', 'Amount']]
  input.donations.forEach((d) => donations.push([d.receipt_no ?? '', d.donor_name, d.method, d.amount]))
  donations.push(['', '', 'Total Collected', input.summary.collected])

  const expenses: Sheet = [['Category', 'Description', 'Total', 'Paid', 'Balance']]
  input.expenses.forEach((e) =>
    expenses.push([e.category_name, e.description, e.amount, e.paid, e.balance])
  )
  expenses.push(['', 'Total Committed', input.summary.committed, '', ''])

  const s = input.summary
  const summary: Sheet = [
    ['Collected', s.collected],
    ['Committed', s.committed],
    ['Paid out', s.spent],
    ['Yet to pay', s.outstanding],
    ['Available (cash + bank)', s.available],
    ['Cash in hand', s.cashInHand],
    ['In bank', s.inBank],
  ]

  return { donations, expenses, summary }
}
