import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Category } from '../../types/db'

export const categoryKeys = {
  all: ['categories'] as const,
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw new Error(error.message)
      return data as Category[]
    },
  })
}

export function canDeleteCategory(c: Category) {
  return !c.is_locked
}

export interface CreateCategoryInput {
  name: string
  display_order: number
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...input, is_locked: false })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export interface RenameCategoryInput {
  id: string
  name: string
}

export function useRenameCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: RenameCategoryInput) => {
      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (category: Category) => {
      if (!canDeleteCategory(category)) {
        throw new Error('This category is locked and cannot be removed.')
      }
      const { error } = await supabase.from('categories').delete().eq('id', category.id)
      if (error) throw new Error(error.message)
      return category.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export interface ReorderCategoryInput {
  category: Category
  direction: 'up' | 'down'
  ordered: Category[]
}

/**
 * Swaps display_order between a category and its adjacent neighbour
 * (the previous row for 'up', the next row for 'down') within the
 * already-sorted `ordered` list.
 */
export function useReorderCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ category, direction, ordered }: ReorderCategoryInput) => {
      const index = ordered.findIndex((c) => c.id === category.id)
      const neighbourIndex = direction === 'up' ? index - 1 : index + 1
      const neighbour = ordered[neighbourIndex]
      if (index === -1 || !neighbour) {
        throw new Error('Cannot reorder: no adjacent category in that direction.')
      }

      const [a, b] = [
        { id: category.id, display_order: neighbour.display_order },
        { id: neighbour.id, display_order: category.display_order },
      ]

      const results = await Promise.all([
        supabase.from('categories').update({ display_order: a.display_order }).eq('id', a.id),
        supabase.from('categories').update({ display_order: b.display_order }).eq('id', b.id),
      ])
      const failed = results.find((r) => r.error)
      if (failed?.error) throw new Error(failed.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}
