import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatINR } from '../../lib/format'
import type { Expense, SpendSource } from '../../types/db'
import { invalidateMoney } from './useExpensePayments'

export { expenseKeys } from './keys'
import { expenseKeys } from './keys'

export function useExpenses() {
  return useQuery({
    queryKey: expenseKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as Expense[]
    },
  })
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      return data as Expense
    },
    enabled: !!id,
  })
}

export interface CreateExpenseWithPaymentInput {
  category_id: string
  description: string
  payee: string | null
  payee_phone: string | null
  amount: number
  paid_now: number
  paid_by: string
  source: SpendSource
  note: string | null
}

export function useCreateExpenseWithPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateExpenseWithPaymentInput) => {
      // paid_by and source describe the first PAYMENT, not the commitment —
      // they are written to expense_payments below, never to expenses.
      const { paid_now, paid_by, source, ...expenseFields } = input

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert(expenseFields)
        .select()
        .single()
      if (error) throw new Error(error.message)

      if (paid_now > 0) {
        const { error: payErr } = await supabase.from('expense_payments').insert({
          expense_id: (expense as Expense).id,
          amount: paid_now,
          source,
          paid_by,
        })
        if (payErr) {
          const { error: deleteErr } = await supabase
            .from('expenses')
            .delete()
            .eq('id', (expense as Expense).id)
          if (deleteErr) {
            throw new Error(
              `"${expenseFields.description}" (${formatINR(expenseFields.amount)}) was recorded, ` +
                `but its payment of ${formatINR(paid_now)} could not be saved and the entry could not be ` +
                `removed automatically. Please open this expense and either add the payment or delete it.`,
            )
          }
          throw new Error(payErr.message)
        }
      }

      return expense as Expense
    },
    onSuccess: () => invalidateMoney(queryClient),
  })
}

// source and paid_by are deliberately absent: those describe money that moved
// and belong to the payment row, so editing them here would silently desync the
// fund ledger. See ExpensePayments for how money is corrected. `amount` is the
// commitment itself, not a movement, so a typo'd total is correctable here —
// trg_expense_total_not_below_paid refuses to drop it below what is paid.
export type UpdateExpenseInput = {
  id: string
  category_id?: string
  description?: string
  payee?: string | null
  payee_phone?: string | null
  amount?: number
  note?: string | null
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateExpenseInput) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Expense
    },
    onSuccess: (data) => {
      invalidateMoney(queryClient)
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(data.id) })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    // The delete cascades to expense_payments, so the payment and status keys
    // are stale too — leaving them cached shows spend with nothing committed.
    onSuccess: (id) => {
      invalidateMoney(queryClient)
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) })
    },
  })
}
