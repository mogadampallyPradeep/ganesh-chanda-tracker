export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg' | 'default'
}) {
  const toneClass = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink'

  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <p className="text-xs text-ink-soft tracking-wide">{label}</p>
      <p className={`font-display text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  )
}
