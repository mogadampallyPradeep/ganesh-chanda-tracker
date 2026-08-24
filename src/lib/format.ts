// All money is integer rupees. Indian-grouped display with the rupee sign.

export function formatINR(n: number): string {
  const sign = n < 0 ? '-' : ''
  const grouped = new Intl.NumberFormat('en-IN').format(Math.abs(Math.round(n)))
  return `${sign}₹${grouped}`
}

export function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(/,/g, '')
}

// Digits-only mobile for display grouping, e.g. "98765 43210"
export function formatMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`
  return mobile
}
