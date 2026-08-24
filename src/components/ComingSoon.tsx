export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-full grid place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="text-ink-soft mt-2">Coming soon.</p>
      </div>
    </div>
  )
}
