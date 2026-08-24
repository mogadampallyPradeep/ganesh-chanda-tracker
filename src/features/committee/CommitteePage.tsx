import { useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useDonations } from '../donations/useDonations'
import {
  useAddMember,
  useCommitteeExpenses,
  useCommitteeMembers,
  useCommitteeReimbursements,
  useRemoveMember,
  useSetMemberAdmin,
  useSettleReimbursement,
} from './useCommittee'
import { computeHoldings, type MemberHolding } from '../../domain/holdings'
import { AmountInput } from '../../components/common/AmountInput'
import { StatCard } from '../../components/common/StatCard'
import { formatINR, formatMobile } from '../../lib/format'
import type { ReimbSource } from '../../types/db'

export function CommitteePage() {
  const { member: currentMember, isAdmin } = useAuth()
  const membersQuery = useCommitteeMembers()
  const donationsQuery = useDonations()
  const expensesQuery = useCommitteeExpenses()
  const reimbursementsQuery = useCommitteeReimbursements()

  const loading =
    membersQuery.isLoading || donationsQuery.isLoading || expensesQuery.isLoading || reimbursementsQuery.isLoading
  const loadError = membersQuery.error ?? donationsQuery.error ?? expensesQuery.error ?? reimbursementsQuery.error

  const holdings = useMemo(() => {
    if (!membersQuery.data) return []
    return computeHoldings(
      membersQuery.data,
      donationsQuery.data ?? [],
      expensesQuery.data ?? [],
      reimbursementsQuery.data ?? [],
    )
  }, [membersQuery.data, donationsQuery.data, expensesQuery.data, reimbursementsQuery.data])

  const [settlingFor, setSettlingFor] = useState<string | null>(null)
  const [addingMember, setAddingMember] = useState(false)

  if (loading) {
    return <div className="p-6 text-center text-ink-soft">Loading committee…</div>
  }

  if (loadError) {
    return (
      <div className="p-6 text-center text-neg">
        {loadError instanceof Error ? loadError.message : 'Could not load committee'}
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Committee</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddingMember(true)}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
          >
            + Add member
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {holdings.map((holding) => (
          <MemberCard
            key={holding.mobile}
            holding={holding}
            isCurrentUser={holding.mobile === currentMember?.mobile}
            isAdmin={isAdmin}
            currentUserMobile={currentMember?.mobile ?? ''}
            settling={settlingFor === holding.mobile}
            onStartSettle={() => setSettlingFor(holding.mobile)}
            onCancelSettle={() => setSettlingFor(null)}
          />
        ))}
      </div>

      {addingMember && <AddMemberDialog onClose={() => setAddingMember(false)} />}
    </div>
  )
}

function MemberCard({
  holding,
  isCurrentUser,
  isAdmin,
  currentUserMobile,
  settling,
  onStartSettle,
  onCancelSettle,
}: {
  holding: MemberHolding
  isCurrentUser: boolean
  isAdmin: boolean
  currentUserMobile: string
  settling: boolean
  onStartSettle: () => void
  onCancelSettle: () => void
}) {
  const settleReimbursement = useSettleReimbursement()
  const setMemberAdmin = useSetMemberAdmin()
  const removeMember = useRemoveMember()

  const [amount, setAmount] = useState(holding.owedBack)
  const [source, setSource] = useState<ReimbSource>('cash')

  // Reset defaults (full owed amount, cash) each time the settle form opens.
  const openSettle = () => {
    setAmount(holding.owedBack)
    setSource('cash')
    onStartSettle()
  }

  const confirmSettle = async () => {
    if (!currentUserMobile || amount <= 0) return
    await settleReimbursement.mutateAsync({
      member_id: holding.mobile,
      from_member_id: currentUserMobile,
      amount,
      source,
    })
    onCancelSettle()
  }

  return (
    <div
      className={`bg-surface border rounded-2xl p-4 ${
        isCurrentUser ? 'border-primary ring-1 ring-primary/40' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
            {holding.name}
            {holding.isAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary-deep bg-primary/10 rounded-full px-1.5 py-0.5">
                Admin
              </span>
            )}
            {isCurrentUser && <span className="text-[10px] font-semibold text-ink-soft">(you)</span>}
          </p>
          <p className="text-xs text-ink-soft mt-0.5">{formatMobile(holding.mobile)}</p>
        </div>
        {holding.over && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-neg bg-neg/10 rounded-full px-2 py-1 whitespace-nowrap">
            Over-spent
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <StatCard label="Collected" value={formatINR(holding.collected)} />
        <StatCard
          label="Holding cash"
          value={formatINR(holding.holdingCash)}
          tone={holding.holdingCash < 0 ? 'neg' : 'default'}
        />
        <StatCard
          label="Holding bank"
          value={formatINR(holding.holdingBank)}
          tone={holding.holdingBank < 0 ? 'neg' : 'default'}
        />
        <StatCard
          label="Owed back"
          value={formatINR(holding.owedBack)}
          tone={holding.owedBack > 0 ? 'pos' : 'default'}
        />
      </div>

      {holding.owedBack > 0 && !settling && (
        <button
          type="button"
          onClick={openSettle}
          className="mt-3 rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
        >
          Settle
        </button>
      )}

      {settling && (
        <div className="mt-3 border-t border-line pt-3 flex flex-col gap-2">
          <AmountInput value={amount} onChange={setAmount} />
          <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-line">
            {(['cash', 'bank'] as ReimbSource[]).map((opt) => (
              <button
                key={opt}
                type="button"
                aria-pressed={source === opt}
                onClick={() => setSource(opt)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                  source === opt ? 'bg-primary text-white shadow-sm' : 'text-ink-soft'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {settleReimbursement.isError && (
            <p className="text-neg text-xs">
              {settleReimbursement.error instanceof Error ? settleReimbursement.error.message : 'Could not settle'}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={settleReimbursement.isPending || amount <= 0}
              onClick={confirmSettle}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
            >
              {settleReimbursement.isPending ? 'Settling…' : `Confirm ${formatINR(amount)}`}
            </button>
            <button
              type="button"
              onClick={onCancelSettle}
              className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-soft border border-line"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-3 border-t border-line pt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={setMemberAdmin.isPending}
            onClick={() => setMemberAdmin.mutate({ mobile: holding.mobile, is_admin: !holding.isAdmin })}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft border border-line disabled:opacity-50"
          >
            {holding.isAdmin ? 'Demote from admin' : 'Promote to admin'}
          </button>
          <button
            type="button"
            disabled={removeMember.isPending}
            onClick={() => {
              if (window.confirm(`Remove ${holding.name} from the committee?`)) removeMember.mutate(holding.mobile)
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neg border border-line disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const addMember = useAddMember()
  const [mobile, setMobile] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isAdminChecked, setIsAdminChecked] = useState(false)

  const submit = async () => {
    if (!mobile.trim() || !name.trim() || !password) return
    await addMember.mutateAsync({ mobile: mobile.trim(), name: name.trim(), password, is_admin: isAdminChecked })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-40 max-w-sm mx-auto bg-surface border border-line rounded-2xl p-5 shadow-md flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Add member</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Mobile number</span>
          <input
            inputMode="numeric"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="98765 43210"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft tracking-wide">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isAdminChecked} onChange={(e) => setIsAdminChecked(e.target.checked)} />
          <span className="text-sm text-ink-soft">Grant admin access</span>
        </label>

        {addMember.isError && (
          <p className="text-neg text-sm">
            {addMember.error instanceof Error ? addMember.error.message : 'Could not add member'}
          </p>
        )}

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            disabled={addMember.isPending || !mobile.trim() || !name.trim() || !password}
            onClick={submit}
            className="flex-1 rounded-xl py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
          >
            {addMember.isPending ? 'Adding…' : 'Add member'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-3 font-semibold text-ink-soft border border-line"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
