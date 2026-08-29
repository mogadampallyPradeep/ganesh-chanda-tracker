export const expenseKeys = {
  all: ['expenses'] as const,
  detail: (id: string) => ['expenses', id] as const,
}

export const paymentKeys = {
  all: ['expense_payments'] as const,
  status: ['expense_status'] as const,
}
