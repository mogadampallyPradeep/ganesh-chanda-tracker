import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { expenseKeys, paymentKeys } from './keys'
import type { ExpensePayment, ExpenseStatus, SpendSource } from '../../types/db'

export { paymentKeys }

export function useExpensePayments() {
  return useQuery({
    queryKey: paymentKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_payments')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return data as ExpensePayment[]
    },
  })
}

export function useExpenseStatus() {
  return useQuery({
    queryKey: paymentKeys.status,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_status').select('*')
      if (error) throw new Error(error.message)
      return data as ExpenseStatus[]
    },
  })
}

export interface CreatePaymentInput {
  expense_id: string
  amount: number
  source: SpendSource
  paid_by: string | null
  note?: string | null
}

/** One payment moves the fund balance, member custody and the activity feed,
 *  so every dependent key is invalidated together. */
function invalidateMoney(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: paymentKeys.all })
  queryClient.invalidateQueries({ queryKey: paymentKeys.status })
  queryClient.invalidateQueries({ queryKey: expenseKeys.all })
}

export function useAddPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase.from('expense_payments').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data as ExpensePayment
    },
    onSuccess: () => invalidateMoney(queryClient),
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_payments').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidateMoney(queryClient),
  })
}
