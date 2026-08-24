import { z } from 'zod'

export const expenseSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  payee: z.string().optional(),
  amount: z.number().int().positive('Enter an amount'),
  paid_by: z.string().min(1, 'Paid by is required'),
  source: z.enum(['cash', 'bank', 'personal']),
  note: z.string().optional(),
})

export type ExpenseInput = z.infer<typeof expenseSchema>
