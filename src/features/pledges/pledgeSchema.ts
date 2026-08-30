import { z } from 'zod'

export const pledgeSchema = z.object({
  donor_name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  amount: z.number().int().positive('Enter an amount'),
  assigned_to: z.string().optional(),
  note: z.string().optional(),
})

export type PledgeInput = z.infer<typeof pledgeSchema>
