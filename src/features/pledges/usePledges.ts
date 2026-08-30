import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { donationKeys } from '../donations/useDonations'
import { pledgeKeys } from './keys'
import type { Pledge, PledgeStatus } from '../../types/db'

export function usePledges() {
  return useQuery({
    queryKey: pledgeKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as Pledge[]
    },
  })
}

export function usePledgeStatus() {
  return useQuery({
    queryKey: pledgeKeys.status,
    queryFn: async () => {
      const { data, error } = await supabase.from('pledge_status').select('*')
      if (error) throw new Error(error.message)
      return data as PledgeStatus[]
    },
  })
}

/** A pledge change moves the expected figure and, on delete, the donations that
 *  pointed at it, so every dependent key is invalidated together.
 *
 *  The promise is returned so callers can return it from onSuccess: the mutation then
 *  stays pending until the lists are genuinely fresh, instead of settling while React
 *  Query is still serving the pre-change rows at status 'success'. */
export function invalidatePledges(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: pledgeKeys.all }),
    queryClient.invalidateQueries({ queryKey: pledgeKeys.status }),
    queryClient.invalidateQueries({ queryKey: donationKeys.all }),
  ])
}

export interface CreatePledgeInput {
  donor_name: string
  phone: string | null
  address: string | null
  amount: number
  note: string | null
  assigned_to: string | null
}

export function useCreatePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePledgeInput) => {
      const { data, error } = await supabase.from('pledges').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data as Pledge
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export type UpdatePledgeInput = Partial<CreatePledgeInput> & { id: string }

export function useUpdatePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePledgeInput) => {
      const { data, error } = await supabase
        .from('pledges')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Pledge
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export function useClosePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, closed_note }: { id: string; closed_note: string | null }) => {
      const { error } = await supabase
        .from('pledges')
        .update({ closed_at: new Date().toISOString(), closed_note })
        .eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export function useReopenPledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pledges')
        .update({ closed_at: null, closed_note: null })
        .eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export function useDeletePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pledges').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}
