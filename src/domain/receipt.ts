import type { DonationMethod } from '../types/db'
import { formatINR, formatDate } from '../lib/format'

export interface ReceiptInfo {
  mandalName: string
  receiptNo: string
  donorName: string
  amount: number
  method: DonationMethod
  date: string
}

/** Thank-you receipt text for WhatsApp / print. */
export function buildReceiptText(o: ReceiptInfo): string {
  const kind = o.method === 'offline' ? 'Cash' : 'Online'
  return [
    `🙏 ${o.mandalName}`,
    `Receipt ${o.receiptNo} · ${formatDate(o.date)}`,
    ``,
    `Received with thanks from ${o.donorName}`,
    `Amount: ${formatINR(o.amount)} (${kind})`,
    ``,
    `Towards Ganesh Chaturthi. Dhanyawad! 🌺`,
  ].join('\n')
}

/** wa.me deep link to a mobile number with prefilled text. Normalises Indian
 *  numbers to include the country code. No API — opens the WhatsApp chat. */
export function buildWhatsAppLink(phone: string, text: string, defaultCountry = '91'): string {
  let digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) digits = defaultCountry + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
