import type { DonationMethod } from '../../types/db'

const options: { value: DonationMethod; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
]

export function MethodToggle({
  value,
  onChange,
}: {
  value: DonationMethod
  onChange: (m: DonationMethod) => void
}) {
  return (
    <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-line">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            value === opt.value ? 'bg-primary text-white shadow-sm' : 'text-ink-soft'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
