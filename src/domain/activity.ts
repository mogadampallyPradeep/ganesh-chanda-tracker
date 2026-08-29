import type { Donation, Expense, ExpensePayment, Reimbursement, Category, CommitteeMember } from '../types/db'

// A single, unified ledger of everything money-related that happened, so nothing
// (a donation, a spend, or a settlement) is invisible. Settlements are their own
// kind — they are NOT spends (the money already left as the payer's out-of-pocket
// expense), so surfacing them here gives visibility without double-counting.
export type ActivityKind = 'collected' | 'spent' | 'settled'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  involves: string[] // member mobiles this row relates to (for the member filter)
  amount: number
  createdAt: string
}

export function buildActivity(
  donations: Donation[],
  expenses: Expense[],
  payments: ExpensePayment[],
  reimbursements: Reimbursement[],
  categories: Category[],
  members: CommitteeMember[],
): ActivityItem[] {
  const memberName = new Map(members.map((m) => [m.mobile, m.name]))
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const nameOf = (mobile: string | null) => (mobile ? (memberName.get(mobile) ?? mobile) : '—')

  const sourceLabel: Record<ExpensePayment['source'], string> = {
    cash: 'Cash',
    bank: 'Bank',
    personal: 'From pocket',
  }

  const collected: ActivityItem[] = donations.map((d) => ({
    id: `d-${d.id}`,
    kind: 'collected',
    title: d.donor_name,
    detail: `${d.method === 'online' ? 'Online' : 'Offline'} · by ${nameOf(d.collected_by)}`,
    involves: d.collected_by ? [d.collected_by] : [],
    amount: d.amount,
    createdAt: d.created_at,
  }))

  const expenseById = new Map(expenses.map((e) => [e.id, e]))
  const paymentCount = new Map<string, number>()
  for (const p of payments) paymentCount.set(p.expense_id, (paymentCount.get(p.expense_id) ?? 0) + 1)

  const orderOf = new Map<string, number>()
  const spent: ActivityItem[] = payments.map((p) => {
    const expense = expenseById.get(p.expense_id)
    const seq = (orderOf.get(p.expense_id) ?? 0) + 1
    orderOf.set(p.expense_id, seq)

    // Only qualify the amount when an expense was actually paid in instalments;
    // a single full payment reads exactly as it did before this feature.
    const isSplit = (paymentCount.get(p.expense_id) ?? 0) > 1
    const qualifier = isSplit ? (seq === 1 ? 'advance · ' : 'part payment · ') : ''

    return {
      id: `p-${p.id}`,
      kind: 'spent',
      title: expense ? (catName.get(expense.category_id) ?? 'Spend') : 'Spend',
      detail: `${expense?.description ?? ''} · ${qualifier}${sourceLabel[p.source]} · by ${nameOf(p.paid_by)}`,
      involves: p.paid_by ? [p.paid_by] : [],
      amount: p.amount,
      createdAt: p.created_at,
    }
  })

  const settled: ActivityItem[] = reimbursements.map((r) => ({
    id: `r-${r.id}`,
    kind: 'settled',
    title: `Reimbursed ${nameOf(r.member_id)}`,
    detail: `${r.source === 'bank' ? 'Bank' : 'Cash'} · by ${nameOf(r.from_member_id)}`,
    involves: [r.member_id, r.from_member_id].filter((m): m is string => !!m),
    amount: r.amount,
    createdAt: r.created_at,
  }))

  return [...collected, ...spent, ...settled].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
