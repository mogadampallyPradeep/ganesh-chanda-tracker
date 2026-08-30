interface PayeeContactProps {
  payee: string | null
  phone: string | null
}

/** A tappable line for the person a spend was paid to, so next year's committee
 *  can reach the band or the tent house without asking around. */
export function PayeeContact({ payee, phone }: PayeeContactProps) {
  if (!payee && !phone) return null

  return (
    <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-soft tracking-wide">Paid to</p>
        <p className="text-ink truncate">{payee ?? 'Not recorded'}</p>
      </div>

      {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, '')}`}
          className="shrink-0 rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-b from-primary to-primary-deep"
        >
          Call {phone}
        </a>
      )}
    </div>
  )
}
