import type { DonationMethod, SpendSource } from '../types/db'

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
  source: SpendSource
}
export interface StatementSummary {
  collected: number
  spent: number
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

  const expenses: Sheet = [['Category', 'Description', 'Source', 'Amount']]
  input.expenses.forEach((e) => expenses.push([e.category_name, e.description, e.source, e.amount]))
  expenses.push(['', '', 'Total Spent', input.summary.spent])

  const s = input.summary
  const summary: Sheet = [
    ['Collected', s.collected],
    ['Spent', s.spent],
    ['Available (cash + bank)', s.available],
    ['Cash in hand', s.cashInHand],
    ['In bank', s.inBank],
  ]

  return { donations, expenses, summary }
}
