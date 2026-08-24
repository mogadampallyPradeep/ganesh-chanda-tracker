import { useMemo, useState } from 'react'
import { useActivity } from './useActivity'
import { useCommitteeMembers } from '../committee/useCommittee'
import { formatINR, formatDate } from '../../lib/format'
import type { ActivityKind } from '../../domain/activity'

type TypeFilter = 'all' | ActivityKind

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'collected', label: 'Collected' },
  { value: 'spent', label: 'Spent' },
  { value: 'settled', label: 'Settled' },
]

const kindStyle: Record<ActivityKind, { icon: string; color: string; sign: string }> = {
  collected: { icon: '↓', color: 'text-pos', sign: '+' },
  spent: { icon: '↑', color: 'text-neg', sign: '−' },
  settled: { icon: '⇄', color: 'text-primary-deep', sign: '−' },
}

export function ActivityPage() {
  const { items, isLoading, error } = useActivity()
  const membersQuery = useCommitteeMembers()
  const [type, setType] = useState<TypeFilter>('all')
  const [member, setMember] = useState<string>('all')

  const filtered = useMemo(() => {
    return items.filter(
      (a) => (type === 'all' || a.kind === type) && (member === 'all' || a.involves.includes(member)),
    )
  }, [items, type, member])

  const total = useMemo(
    () => filtered.reduce((t, a) => t + (a.kind === 'collected' ? a.amount : -a.amount), 0),
    [filtered],
  )

  if (isLoading) {
    return <div className="p-6 text-center text-ink-soft">Loading activity…</div>
  }
  if (error) {
    return (
      <div className="p-6 text-center text-neg">
        {error instanceof Error ? error.message : 'Could not load activity'}
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <h1 className="font-display text-2xl font-bold text-ink">Activity</h1>

      {/* Type filter chips */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-line">
        {typeFilters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={type === f.value}
            onClick={() => setType(f.value)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              type === f.value ? 'bg-primary text-white shadow-sm' : 'text-ink-soft'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Member filter */}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-soft shrink-0">Member</span>
        <select
          value={member}
          onChange={(e) => setMember(e.target.value)}
          className="flex-1 border border-line bg-bg rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary"
        >
          <option value="all">All members</option>
          {(membersQuery.data ?? []).map((m) => (
            <option key={m.mobile} value={m.mobile}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {/* Net total for the current filter */}
      <div className="bg-surface border border-line rounded-2xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-ink-soft">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
        <span className={`font-display font-bold ${total < 0 ? 'text-neg' : 'text-ink'}`}>
          Net {formatINR(total)}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink-soft text-sm text-center py-6">No activity for this filter.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((a) => {
            const s = kindStyle[a.kind]
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3"
              >
                <span
                  className={`grid place-items-center w-9 h-9 rounded-full shrink-0 bg-surface-2 text-lg font-bold ${s.color}`}
                >
                  {s.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {a.detail} · {formatDate(a.createdAt)}
                  </p>
                </div>
                <span className={`font-bold whitespace-nowrap ${s.color}`}>
                  {s.sign}
                  {formatINR(a.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
