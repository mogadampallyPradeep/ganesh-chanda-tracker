import { useParams } from 'react-router-dom'
import { DataTable } from '../../components/common/DataTable'
import { StatCard } from '../../components/common/StatCard'
import { usePublicStatement } from './usePublicStatement'
import { downloadStatement } from '../export/exportExcel'
import { formatINR } from '../../lib/format'

export function PublicStatementPage() {
  const { token } = useParams<{ token: string }>()
  const { data: statement, isLoading, isError } = usePublicStatement(token)

  if (isLoading) {
    return (
      <div className="min-h-full grid place-items-center p-6">
        <p className="text-ink-soft text-sm">Loading statement…</p>
      </div>
    )
  }

  if (isError || !statement) {
    return (
      <div className="min-h-full grid place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Invalid or expired link</h1>
          <p className="text-ink-soft mt-2">This statement link is not valid. Please ask the mandal for a fresh link.</p>
        </div>
      </div>
    )
  }

  const { mandalName, donations, expenses, summary } = statement

  const handleShare = () => {
    const message = `${mandalName} — Ganesh Chaturthi fund statement: ${window.location.href}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noreferrer')
  }

  const handleExport = () => {
    downloadStatement({ donations, expenses, summary })
  }

  return (
    <div className="min-h-full p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="text-center mb-6">
        <p className="text-gold text-base" style={{ fontFamily: 'Noto Sans Devanagari, Nirmala UI, system-ui' }}>
          ॥ श्री गणेशाय नमः ॥
        </p>
        <h1 className="font-display text-2xl font-bold text-ink mt-1">{mandalName}</h1>
        <p className="text-ink-soft text-sm mt-1">Public fund statement</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Collected" value={formatINR(summary.collected)} tone="pos" />
        <StatCard label="Spent" value={formatINR(summary.spent)} tone="neg" />
        <StatCard label="Available" value={formatINR(summary.available)} />
        <StatCard label="Cash in hand" value={formatINR(summary.cashInHand)} />
        <StatCard label="In bank" value={formatINR(summary.inBank)} />
      </div>

      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 rounded-xl py-3 font-bold text-white bg-wa"
        >
          Share on WhatsApp
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex-1 rounded-xl py-3 font-semibold text-ink bg-surface-2 border border-line"
        >
          Export to Excel
        </button>
      </div>

      <h2 className="font-display text-lg font-bold text-ink mb-2">Donations</h2>
      <DataTable
        columns={[
          { key: 'receipt_no', label: 'Receipt No' },
          { key: 'donor', label: 'Donor' },
          { key: 'amount', label: 'Amount', align: 'right' },
        ]}
        rows={donations.map((d) => ({
          receipt_no: d.receipt_no ?? '—',
          donor: d.donor_name,
          amount: formatINR(d.amount),
        }))}
        totalRow={['', 'Total', formatINR(summary.collected)]}
      />
    </div>
  )
}
