import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CommitteeMember, ReimbSource, Reimbursement } from '../../types/db'

export const committeeKeys = {
  members: ['committee', 'members'] as const,
  reimbursements: ['committee', 'reimbursements'] as const,
}

// Safe, RLS-friendly view (no password_hash) — never query committee_members
// directly from the client, its RLS denies direct access.
export function useCommitteeMembers() {
  return useQuery({
    queryKey: committeeKeys.members,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('committee_public')
        .select('*')
        .order('is_admin', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw new Error(error.message)
      return data as CommitteeMember[]
    },
  })
}

export function useCommitteeReimbursements() {
  return useQuery({
    queryKey: committeeKeys.reimbursements,
    queryFn: async () => {
      const { data, error } = await supabase.from('reimbursements').select('*')
      if (error) throw new Error(error.message)
      return data as Reimbursement[]
    },
  })
}

export interface SettleReimbursementInput {
  member_id: string // the member being paid back
  from_member_id: string // the fund holder doing the settling (current user)
  amount: number
  source: ReimbSource
}

export function useSettleReimbursement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SettleReimbursementInput) => {
      const { data, error } = await supabase.from('reimbursements').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data as Reimbursement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: committeeKeys.reimbursements })
    },
  })
}

// --- Admin-only member management (thin RPC wrappers) ---

export interface AddMemberInput {
  mobile: string
  name: string
  password: string
  is_admin?: boolean
}

export function useAddMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AddMemberInput) => {
      const { error } = await supabase.rpc('add_member', {
        p_mobile: input.mobile,
        p_name: input.name,
        p_password: input.password,
        p_is_admin: input.is_admin ?? false,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: committeeKeys.members })
    },
  })
}

// Rename a member. add_member is an upsert; on an existing mobile it updates
// name + is_admin only (password_hash is left untouched), so passing the member's
// current is_admin renames them without changing their role or password. Used for
// self "edit my name" — the placeholder password is ignored on the conflict path.
export function useUpdateMemberName() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ mobile, name, is_admin }: { mobile: string; name: string; is_admin: boolean }) => {
      const { error } = await supabase.rpc('add_member', {
        p_mobile: mobile,
        p_name: name,
        p_password: '__unchanged__',
        p_is_admin: is_admin,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: committeeKeys.members })
    },
  })
}

export function useSetMemberAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ mobile, is_admin }: { mobile: string; is_admin: boolean }) => {
      const { error } = await supabase.rpc('set_member_admin', { p_mobile: mobile, p_is_admin: is_admin })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: committeeKeys.members })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (mobile: string) => {
      const { error } = await supabase.rpc('remove_member', { p_mobile: mobile })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: committeeKeys.members })
    },
  })
}
