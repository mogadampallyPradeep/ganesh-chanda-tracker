import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { FundSettings } from '../../types/db'

export const fundSettingsKeys = {
  detail: ['fundSettings'] as const,
}

// Single-fund design: exactly one fund_settings row exists in the whole app.
export function useFundSettings() {
  return useQuery({
    queryKey: fundSettingsKeys.detail,
    queryFn: async () => {
      const { data, error } = await supabase.from('fund_settings').select('*').single()
      if (error) throw new Error(error.message)
      return data as FundSettings
    },
  })
}

// public_token is system-generated and intentionally excluded — never editable.
export interface UpdateFundSettingsInput {
  id: string
  mandal_name: string
  festival_year: number
  receipt_prefix: string
  currency: string
}

// Admin-only in practice: RLS denies the update for non-admins, and the UI
// (FundSettingsPage) never renders editable fields or calls this unless
// useAuth().isAdmin is true.
export function useUpdateFundSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateFundSettingsInput) => {
      const { data, error } = await supabase
        .from('fund_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as FundSettings
    },
    onSuccess: (data) => {
      queryClient.setQueryData(fundSettingsKeys.detail, data)
    },
  })
}
