import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Estimate } from '../../types/db'

export const estimateKeys = {
  all: ['estimates'] as const,
}

export function useEstimates() {
  return useQuery({
    queryKey: estimateKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('estimates').select('*')
      if (error) throw new Error(error.message)
      return data as Estimate[]
    },
  })
}

export interface UpsertEstimateInput {
  category_id: string
  estimated_amount: number
}

// Estimates are pre-seeded one row per category (unique on category_id), so
// setting an estimate is always an upsert keyed on category_id — never an insert.
export function useUpsertEstimate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpsertEstimateInput) => {
      const { data, error } = await supabase
        .from('estimates')
        .upsert(input, { onConflict: 'category_id' })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Estimate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.all })
    },
  })
}
