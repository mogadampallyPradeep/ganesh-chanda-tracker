import { z } from 'zod'

export const donationSchema = z.object({
  donor_name: z.string().min(1, 'Donor name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  amount: z.number().int().positive('Enter an amount'),
  method: z.enum(['online', 'offline']),
  note: z.string().optional(),
})

export type DonationInput = z.infer<typeof donationSchema>
