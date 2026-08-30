import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

// 23503 = foreign key violation. The only FK a donation can break is pledge_id,
// which means the pledge was deleted between opening the receipt form and saving.
// Nothing is written, so the raw Postgres text has to become an instruction.
const FK_VIOLATION = '23503'

function donationError(error: { code?: string; message: string }): Error {
  if (error.code === FK_VIOLATION) {
    return new Error(
      'That pledge has been deleted, so nothing was saved. Record this money on the Received tab with "+ New Donation".',
    )
  }
  return new Error(error.message)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: donationKeys.all })
      queryClient.invalidateQueries({ queryKey: pledgeKeys.all })
      queryClient.invalidateQueries({ queryKey: pledgeKeys.status })
    },
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: donationKeys.all })
      queryClient.invalidateQueries({ queryKey: donationKeys.detail(data.id) })
      queryClient.invalidateQueries({ queryKey: pledgeKeys.all })
      queryClient.invalidateQueries({ queryKey: pledgeKeys.status })
    },
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
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: donationKeys.all })
      queryClient.invalidateQueries({ queryKey: donationKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: pledgeKeys.all })
      queryClient.invalidateQueries({ queryKey: pledgeKeys.status })
    },
  })
}
