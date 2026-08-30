import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDonations } from './useDonations'
import { DonationForm } from './DonationForm'
import { PledgeList } from '../pledges/PledgeList'
import { usePledges, usePledgeStatus } from '../pledges/usePledges'
import { buildPledges, type PledgeRow } from '../../domain/pledges'
import { formatINR } from '../../lib/format'
import type { Donation } from '../../types/db'

function MethodPill({ method }: { method: Donation['method'] }) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        method === 'online' ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-soft'
      }`}
    >
      {method === 'online' ? 'Online' : 'Offline'}
    </span>
  )
}

export function DonationsListPage() {
  const { data: donations, isLoading, isError, error } = useDonations()
  const { data: pledges } = usePledges()
  const { data: statuses } = usePledgeStatus()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<'received' | 'expected'>('received')
  const [receiptFor, setReceiptFor] = useState<PledgeRow | null>(null)

  const filtered = useMemo(() => {
    const rows = donations ?? []
    const q = search.trim().toLowerCase()
    if (q === '') return rows
    return rows.filter((d) => d.donor_name.toLowerCase().includes(q))
  }, [donations, search])

  const { expectedOutstanding } = buildPledges(pledges ?? [], statuses ?? [])
  const expectedLabel = expectedOutstanding > 0 ? `Expected (${formatINR(expectedOutstanding)})` : 'Expected'

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Donations</h1>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('received')}
          className={`rounded-xl px-4 py-2 font-semibold ${
            tab === 'received'
              ? 'bg-gradient-to-b from-primary to-primary-deep text-white'
              : 'bg-surface text-ink-soft border border-line'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onClick={() => setTab('expected')}
          className={`rounded-xl px-4 py-2 font-semibold ${
            tab === 'expected'
              ? 'bg-gradient-to-b from-primary to-primary-deep text-white'
              : 'bg-surface text-ink-soft border border-line'
          }`}
        >
          {expectedLabel}
        </button>
      </div>

      {tab === 'received' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
            >
              {showForm ? 'Cancel' : '+ New Donation'}
            </button>
          </div>

          {showForm && (
            <DonationForm
              onSaved={(donation, action) => {
                setShowForm(false)
                if (action === 'share') {
                  navigate(`/collect/${donation.id}/receipt`)
                }
              }}
            />
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by donor name"
              className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
            />
          </label>

          {isLoading && <p className="text-ink-soft text-sm">Loading donations…</p>}
          {isError && (
            <p className="text-neg text-sm">{error instanceof Error ? error.message : 'Could not load donations'}</p>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <p className="text-ink-soft text-sm">No donations found.</p>
          )}

          <ul className="flex flex-col gap-2">
            {filtered.map((donation) => (
              <li key={donation.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/collect/${donation.id}`)}
                  className="w-full flex items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-3 text-left"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-ink font-semibold truncate">{donation.donor_name}</span>
                    <MethodPill method={donation.method} />
                  </div>
                  <span className="text-ink font-bold whitespace-nowrap">{formatINR(donation.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'expected' && (
        <>
          {receiptFor && (
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-bold text-ink">
                Receipt for {receiptFor.pledge.donor_name}
              </h2>
              <DonationForm
                prefill={{
                  pledge_id: receiptFor.pledge.id,
                  donor_name: receiptFor.pledge.donor_name,
                  phone: receiptFor.pledge.phone,
                  amount: receiptFor.balance,
                }}
                onSaved={(donation, action) => {
                  setReceiptFor(null)
                  if (action === 'share') {
                    navigate(`/collect/${donation.id}/receipt`)
                  }
                }}
              />
            </div>
          )}

          <PledgeList onRecordReceipt={setReceiptFor} />
        </>
      )}
    </div>
  )
}
