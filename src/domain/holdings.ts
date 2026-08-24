import type { CommitteeMember, Donation, Expense, Reimbursement } from '../types/db'

export interface MemberHolding {
  mobile: string
  name: string
  isAdmin: boolean
  collected: number // total chanda they collected
  holdingCash: number // fund cash they currently hold
  holdingBank: number // fund bank they currently hold
  owedBack: number // personal spends not yet reimbursed
  over: boolean // spent fund money they were not holding
}

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((t, r) => t + pick(r), 0)

/**
 * Per-member custody. Answers "who is holding the money, and did anyone spend
 * fund money they weren't holding?" (over = true), plus who is owed for
 * out-of-pocket (personal) spends.
 */
export function computeHoldings(
  members: CommitteeMember[],
  donations: Pick<Donation, 'amount' | 'method' | 'collected_by'>[],
  expenses: Pick<Expense, 'amount' | 'source' | 'paid_by'>[],
  reimbursements: Pick<Reimbursement, 'amount' | 'source' | 'member_id' | 'from_member_id'>[],
): MemberHolding[] {
  return members.map((m) => {
    const collectedCash = sum(donations.filter((d) => d.collected_by === m.mobile && d.method === 'offline'), (d) => d.amount)
    const collectedBank = sum(donations.filter((d) => d.collected_by === m.mobile && d.method === 'online'), (d) => d.amount)

    const paidCash = sum(expenses.filter((e) => e.paid_by === m.mobile && e.source === 'cash'), (e) => e.amount)
    const paidBank = sum(expenses.filter((e) => e.paid_by === m.mobile && e.source === 'bank'), (e) => e.amount)
    const personal = sum(expenses.filter((e) => e.paid_by === m.mobile && e.source === 'personal'), (e) => e.amount)

    const reimbOutCash = sum(reimbursements.filter((r) => r.from_member_id === m.mobile && r.source === 'cash'), (r) => r.amount)
    const reimbOutBank = sum(reimbursements.filter((r) => r.from_member_id === m.mobile && r.source === 'bank'), (r) => r.amount)
    const reimbursedIn = sum(reimbursements.filter((r) => r.member_id === m.mobile), (r) => r.amount)

    const holdingCash = collectedCash - paidCash - reimbOutCash
    const holdingBank = collectedBank - paidBank - reimbOutBank

    return {
      mobile: m.mobile,
      name: m.name,
      isAdmin: m.is_admin,
      collected: collectedCash + collectedBank,
      holdingCash,
      holdingBank,
      owedBack: personal - reimbursedIn,
      over: holdingCash < 0 || holdingBank < 0,
    }
  })
}
