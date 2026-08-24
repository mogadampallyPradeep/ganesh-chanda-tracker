import * as XLSX from 'xlsx'
import { buildStatementSheets } from '../../domain/statement'
import type { PublicDonationRow, PublicExpenseRow, StatementSummary } from '../../domain/statement'

export function buildWorkbook(input: {
  donations: PublicDonationRow[]
  expenses: PublicExpenseRow[]
  summary: StatementSummary
}): XLSX.WorkBook {
  const s = buildStatementSheets(input)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.donations), 'Donations')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.expenses), 'Spends')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.summary), 'Summary')
  return wb
}

export function downloadStatement(
  input: Parameters<typeof buildWorkbook>[0],
  filename = 'atharva-nidhi-statement.xlsx'
) {
  XLSX.writeFile(buildWorkbook(input), filename)
}
