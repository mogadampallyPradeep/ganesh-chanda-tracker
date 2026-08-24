import { Link, useParams } from 'react-router-dom'
import { useDonation } from './useDonations'
import { buildReceiptText, buildWhatsAppLink } from '../../domain/receipt'
import { formatINR, formatDate } from '../../lib/format'
import type { Donation } from '../../types/db'

export function ReceiptView({ mandalName, donation }: { mandalName: string; donation: Donation }) {
  const receiptNo = donation.receipt_no ?? '—'
  const text = buildReceiptText({
    mandalName,
    receiptNo,
    donorName: donation.donor_name,
    amount: donation.amount,
    method: donation.method,
    date: donation.created_at,
  })
  const waLink = buildWhatsAppLink(donation.phone ?? '', text)
  const hasPhone = (donation.phone ?? '').replace(/\D/g, '').length >= 10

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${donation.receipt_no ?? donation.id}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3 text-center">
          <p className="text-gold text-base" style={{ fontFamily: 'Noto Sans Devanagari, Nirmala UI, system-ui' }}>
            ॥ श्री गणेशाय नमः ॥
          </p>
          <h1 className="font-display text-2xl font-bold text-ink">{mandalName}</h1>
          <p className="text-ink-soft text-xs tracking-wide">
            Receipt {receiptNo} · {formatDate(donation.created_at)}
          </p>

          <div className="w-full border-t border-line my-1" />

          <div className="flex flex-col gap-1">
            <p className="text-ink-soft text-xs">Received with thanks from</p>
            <p className="text-ink text-lg font-semibold">{donation.donor_name}</p>
          </div>

          <p className="font-display text-3xl font-bold text-primary-deep">{formatINR(donation.amount)}</p>
          <p className="text-ink-soft text-xs uppercase tracking-wide">
            {donation.method === 'offline' ? 'Cash' : 'Online'}
          </p>

          {donation.note && <p className="text-ink-soft text-sm italic">{donation.note}</p>}

          <p className="text-gold text-sm mt-2">Towards Ganesh Chaturthi. Dhanyawad! 🌺</p>
        </div>

        <div className="flex flex-col gap-3 mt-5 print:hidden">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!hasPhone}
            onClick={(e) => {
              if (!hasPhone) e.preventDefault()
            }}
            className={`text-center rounded-xl py-3 font-bold text-white bg-wa ${
              hasPhone ? '' : 'opacity-50 pointer-events-none'
            }`}
          >
            Send Receipt on WhatsApp
          </a>
          {!hasPhone && (
            <p className="text-ink-soft text-xs text-center -mt-2">No phone number on file for this donor.</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-xl py-3 font-semibold text-ink bg-surface-2 border border-line"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 rounded-xl py-3 font-semibold text-ink bg-surface-2 border border-line"
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const { data: donation, isLoading, isError } = useDonation(id ?? '')

  if (isLoading) {
    return (
      <div className="min-h-full grid place-items-center p-6">
        <p className="text-ink-soft text-sm">Loading receipt…</p>
      </div>
    )
  }

  if (isError || !donation) {
    return (
      <div className="min-h-full grid place-items-center p-6">
        <div className="text-center">
          <p className="text-ink text-base font-semibold">Receipt not found</p>
          <p className="text-ink-soft text-sm mt-1">This donation could not be loaded.</p>
          <Link to="/" className="inline-block mt-4 text-primary-deep font-semibold">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <ReceiptView mandalName="Atharva Nidhi" donation={donation} />
}
