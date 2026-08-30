export type DonationMethod = 'online' | 'offline'
export type SpendSource = 'cash' | 'bank' | 'personal'
export type ReimbSource = 'cash' | 'bank'

export interface FundSettings {
  id: string
  mandal_name: string
  festival_year: number
  receipt_prefix: string
  currency: string
  public_token: string
}

export interface Category {
  id: string
  name: string
  display_order: number
  is_locked: boolean
}

export interface Estimate {
  id: string
  category_id: string
  estimated_amount: number
}

export interface CommitteeMember {
  mobile: string
  name: string
  is_admin: boolean
  created_at?: string
}

export interface Donation {
  id: string
  receipt_no: string | null
  donor_name: string
  address: string | null
  phone: string | null
  amount: number
  method: DonationMethod
  note: string | null
  collected_by: string | null
  created_at: string
}

export interface Expense {
  id: string
  category_id: string
  description: string
  payee: string | null
  payee_phone: string | null
  amount: number
  paid_by: string | null
  source: SpendSource
  note: string | null
  created_at: string
}

export interface Reimbursement {
  id: string
  member_id: string
  from_member_id: string | null
  amount: number
  source: ReimbSource
  created_at: string
}

export interface ExpensePayment {
  id: string
  expense_id: string
  amount: number
  source: SpendSource
  paid_by: string | null
  note: string | null
  created_at: string
}

export interface ExpenseStatus {
  expense_id: string
  total: number
  paid: number
  balance: number
  is_settled: boolean
}
