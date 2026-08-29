import { useMemo } from 'react'
import { useDonations } from '../donations/useDonations'
import { useExpenses } from '../expenses/useExpenses'
import { useExpensePayments } from '../expenses/useExpensePayments'
import { useCategories } from '../categories/useCategories'
import { useCommitteeMembers, useCommitteeReimbursements } from '../committee/useCommittee'
import { buildActivity, type ActivityItem } from '../../domain/activity'

// Assembles the unified activity ledger from the already-cached queries and
// resolves member mobiles to names. Read-only; no new backend.
export function useActivity(): {
  items: ActivityItem[]
  isLoading: boolean
  error: Error | null
} {
  const donations = useDonations()
  const expenses = useExpenses()
  const payments = useExpensePayments()
  const reimbursements = useCommitteeReimbursements()
  const categories = useCategories()
  const members = useCommitteeMembers()

  const isLoading =
    donations.isLoading ||
    expenses.isLoading ||
    payments.isLoading ||
    reimbursements.isLoading ||
    categories.isLoading ||
    members.isLoading

  const error =
    (donations.error ??
      expenses.error ??
      payments.error ??
      reimbursements.error ??
      categories.error ??
      members.error) as Error | null

  const items = useMemo(
    () =>
      buildActivity(
        donations.data ?? [],
        expenses.data ?? [],
        payments.data ?? [],
        reimbursements.data ?? [],
        categories.data ?? [],
        members.data ?? [],
      ),
    [donations.data, expenses.data, payments.data, reimbursements.data, categories.data, members.data],
  )

  return { items, isLoading, error }
}
