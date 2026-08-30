import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { pledgeKeys } from '../pledges/keys'
import type { Donation, DonationMethod } from '../../types/db'

export const donationKeys = {
  all: ['donations'] as const,
  detail: (id: string) => ['donations', id] as const,
}

export function useDonations() {
  return useQuery({
    queryKey: donationKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as Donation[]
    },
  })
}

export function useDonation(id: string) {
  return useQuery({
    queryKey: donationKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      return data as Donation
    },
    enabled: !!id,
  })
}

// 23503 = foreign key violation. donations has TWO foreign keys: pledge_id and
// collected_by. Only the pledge_id one is safe to explain away, so the constraint
// name or the key detail has to actually name it — an admin deleting a logged-in
// member breaks collected_by, and telling her to retry on the Received tab would
// send her round a loop that fails identically.
const FK_VIOLATION = '23503'

function donationError(error: { code?: string; message: string; details?: string | null }): Error {
  const mentionsPledge = `${error.message} ${error.details ?? ''}`.includes('pledge_id')
  if (error.code === FK_VIOLATION && mentionsPledge) {
    return new Error(
      'That pledge has been deleted, so nothing was saved. Record this money on the Received tab with "+ New Donation".',
    )
  }
  return new Error(error.message)
}

/** Returned from onSuccess so the mutation stays pending — and the Save button stays
 *  "Saving…" — until the lists it feeds are actually fresh. Without this, mutateAsync
 *  resolves while both pledge queries are still refetching; React Query keeps serving
 *  the OLD rows at status 'success' during a refetch, so a pledge that was just settled
 *  in full would still render as open, at its full amount, with a live Record receipt
 *  button. invalidateQueries never rejects (each refetch is caught internally) and a
 *  paused refetch resolves immediately, so awaiting it cannot strand her in "Saving…". */
function refreshDonationViews(queryClient: QueryClient, donationId?: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: donationKeys.all }),
    ...(donationId ? [queryClient.invalidateQueries({ queryKey: donationKeys.detail(donationId) })] : []),
    queryClient.invalidateQueries({ queryKey: pledgeKeys.all }),
    queryClient.invalidateQueries({ queryKey: pledgeKeys.status }),
  ])
}

export interface CreateDonationInput {
  donor_name: string
  address: string | null
  phone: string | null
  amount: number
  method: DonationMethod
  note: string | null
  pledge_id?: string | null
}

export function useCreateDonation() {
  const queryClient = useQueryClient()
  const { member } = useAuth()

  return useMutation({
    mutationFn: async (input: CreateDonationInput) => {
      const { data, error } = await supabase
        .from('donations')
        .insert({ ...input, collected_by: member?.mobile ?? null })
        .select()
        .single()
      if (error) throw donationError(error)
      return data as Donation
    },
    onSuccess: () => refreshDonationViews(queryClient),
  })
}

export type UpdateDonationInput = Partial<CreateDonationInput> & { id: string }

export function useUpdateDonation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateDonationInput) => {
      const { data, error } = await supabase
        .from('donations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw donationError(error)
      return data as Donation
    },
    onSuccess: (data) => refreshDonationViews(queryClient, data.id),
  })
}

export function useDeleteDonation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('donations').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: (id) => refreshDonationViews(queryClient, id),
  })
}
