export function StatCard({
  label,
  value,
  tone = 'default',
  dense = false,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg' | 'default'
  dense?: boolean
}) {
  const toneClass = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink'
  // dense is the three-up row: a rupee figure at text-2xl has no soft break point and
  // will not fit a third of a 360px screen.
  const sizeClass = dense ? 'p-3 sm:p-4' : 'p-4'
  const valueClass = dense ? 'text-base sm:text-2xl' : 'text-2xl'

  return (
    <div className={`bg-surface border border-line rounded-2xl min-w-0 ${sizeClass}`}>
      <p className="text-xs text-ink-soft tracking-wide">{label}</p>
      <p className={`font-display font-bold mt-1 truncate ${valueClass} ${toneClass}`}>{value}</p>
    </div>
  )
}
