import { useCategories } from '../categories/useCategories'
import { useDonations } from '../donations/useDonations'
import { useExpenses } from '../expenses/useExpenses'
import { useExpensePayments, useExpenseStatus } from '../expenses/useExpensePayments'
import { useCommitteeReimbursements } from '../committee/useCommittee'
import { useFundSettings } from '../settings/useFundSettings'
import { computeBalance } from '../../domain/balance'
import { downloadStatement } from './exportExcel'
import type { PublicDonationRow, PublicExpenseRow, StatementSummary } from '../../domain/statement'

// Assembles the full (authenticated) statement from the already-cached queries
// and downloads it as an .xlsx. Returns a ready flag so callers can disable the
// action until the underlying data is loaded.
export function useExportStatement() {
  const categoriesQuery = useCategories()
  const donationsQuery = useDonations()
  const expensesQuery = useExpenses()
  const paymentsQuery = useExpensePayments()
  const statusQuery = useExpenseStatus()
  const reimbursementsQuery = useCommitteeReimbursements()
  const fundSettingsQuery = useFundSettings()

  const ready =
    categoriesQuery.isSuccess &&
    donationsQuery.isSuccess &&
    expensesQuery.isSuccess &&
    paymentsQuery.isSuccess &&
    statusQuery.isSuccess &&
    reimbursementsQuery.isSuccess

  const exportNow = () => {
    if (!ready) return
    const categories = categoriesQuery.data ?? []
    const donations = donationsQuery.data ?? []
    const expenses = expensesQuery.data ?? []
    const payments = paymentsQuery.data ?? []
    const status = statusQuery.data ?? []
    const reimbursements = reimbursementsQuery.data ?? []
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const statusByExpense = new Map(status.map((s) => [s.expense_id, s]))

    const donationRows: PublicDonationRow[] = donations.map((d) => ({
      receipt_no: d.receipt_no,
      donor_name: d.donor_name,
      amount: d.amount,
      method: d.method,
    }))

    const expenseRows: PublicExpenseRow[] = expenses.map((e) => ({
      category_name: categoryName.get(e.category_id) ?? 'Uncategorised',
      description: e.description,
      amount: e.amount,
      paid: statusByExpense.get(e.id)?.paid ?? 0,
      balance: statusByExpense.get(e.id)?.balance ?? e.amount,
    }))

    const balance = computeBalance(donations, expenses, payments, reimbursements)
    const summary: StatementSummary = {
      collected: balance.collected,
      committed: balance.committed,
      spent: balance.paidOut,
      outstanding: balance.outstanding,
      available: balance.available,
      cashInHand: balance.cashInHand,
      inBank: balance.inBank,
    }
    const year = fundSettingsQuery.data?.festival_year
    const filename = year ? `atharvnidhi-statement-${year}.xlsx` : 'atharvnidhi-statement.xlsx'

    downloadStatement({ donations: donationRows, expenses: expenseRows, summary }, filename)
  }

  return { exportNow, ready }
}
