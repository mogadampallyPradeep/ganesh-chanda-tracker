import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PublicDonationRow, PublicExpenseRow, StatementSummary } from '../../domain/statement'

export interface PublicStatement {
  mandalName: string
  donations: PublicDonationRow[]
  expenses: PublicExpenseRow[]
  summary: StatementSummary
}

// Raw shape of the public_summary view (snake_case) before mapping to StatementSummary.
interface PublicSummaryRow {
  collected: number
  committed: number
  spent: number
  outstanding: number
  cash_in_hand: number
  in_bank: number
  available: number
}

export function usePublicStatement(token: string | undefined) {
  return useQuery({
    queryKey: ['public-statement', token],
    queryFn: async (): Promise<PublicStatement | null> => {
      const { data: fundSettings, error: fundError } = await supabase
        .from('fund_settings')
        .select('mandal_name, public_token')
        .eq('public_token', token)
        .maybeSingle()
      if (fundError) throw new Error(fundError.message)
      if (!fundSettings) return null

      const [donationsRes, expensesRes, summaryRes] = await Promise.all([
        supabase.from('public_donations').select('receipt_no, donor_name, amount, method'),
        supabase.from('public_expenses').select('category_name, description, amount, paid, balance'),
        supabase
          .from('public_summary')
          .select('collected, committed, spent, outstanding, cash_in_hand, in_bank, available')
          .single(),
      ])
      if (donationsRes.error) throw new Error(donationsRes.error.message)
      if (expensesRes.error) throw new Error(expensesRes.error.message)
      if (summaryRes.error) throw new Error(summaryRes.error.message)

      const s = summaryRes.data as PublicSummaryRow
      const summary: StatementSummary = {
        collected: s.collected,
        committed: s.committed,
        spent: s.spent,
        outstanding: s.outstanding,
        available: s.available,
        cashInHand: s.cash_in_hand,
        inBank: s.in_bank,
      }

      return {
        mandalName: fundSettings.mandal_name,
        donations: donationsRes.data as PublicDonationRow[],
        expenses: expensesRes.data as PublicExpenseRow[],
        summary,
      }
    },
    enabled: !!token,
    retry: false,
  })
}
