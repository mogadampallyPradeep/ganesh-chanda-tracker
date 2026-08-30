import { z } from 'zod'

export const expenseSchema = z
  .object({
    category_id: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
    payee: z.string().optional(),
    payee_phone: z.string().optional(),
    amount: z.number().int().positive('Enter an amount'),
    paid_now: z.number().int().min(0, 'Cannot be negative'),
    paid_by: z.string().min(1, 'Paid by is required'),
    source: z.enum(['cash', 'bank', 'personal']),
    note: z.string().optional(),
  })
  .refine((v) => v.paid_now <= v.amount, {
    path: ['paid_now'],
    message: 'Paid now cannot exceed the total',
  })

// Edit mode renders neither paid_now, source nor paid_by — they describe money
// that already moved and are corrected on the payment rows instead. Validating
// them here would block a save on fields the treasurer cannot see or fix.
export const expenseEditSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  payee: z.string().optional(),
  payee_phone: z.string().optional(),
  amount: z.number().int().positive('Enter an amount'),
  note: z.string().optional(),
})

export type ExpenseInput = z.infer<typeof expenseSchema>
