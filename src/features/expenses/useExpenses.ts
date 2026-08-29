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

export interface CreateExpenseInput {
  category_id: string
  description: string
  payee: string | null
  amount: number
  paid_by: string
  source: SpendSource
  note: string | null
}

export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const { data, error } = await supabase.from('expenses').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
    },
  })
}

export interface CreateExpenseWithPaymentInput {
  category_id: string
  description: string
  payee: string | null
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
      const { paid_now, paid_by, source, ...expenseFields } = input

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({ ...expenseFields, paid_by, source })
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

export type UpdateExpenseInput = Partial<CreateExpenseInput> & { id: string }

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
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
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
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) })
    },
  })
}
