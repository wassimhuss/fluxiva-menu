import type { Language, ShopBilling } from './types'

const zone = 'Asia/Beirut'
const wallFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
function wallParts(date: Date) {
  const parts = Object.fromEntries(wallFormatter.formatToParts(date).map(p => [p.type, p.value]))
  return [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second].map(Number)
}
function wallTimestamp(parts: number[]) {
  return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3] ?? 0, parts[4] ?? 0, parts[5] ?? 0)
}
function fromWall(parts: number[]) {
  const desired = wallTimestamp(parts)
  let guess = desired
  for (let i = 0; i < 3; i++) guess += desired - wallTimestamp(wallParts(new Date(guess)))
  if (wallTimestamp(wallParts(new Date(guess))) !== desired) throw new Error('Enter a valid Beirut collection date')
  return new Date(guess)
}
export function beirutInput(date = new Date()) {
  const [y, m, d, h, minute] = wallParts(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return y + '-' + pad(m) + '-' + pad(d) + 'T' + pad(h) + ':' + pad(minute)
}
export function parseBeirutInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Enter a valid Beirut collection date')
  const result = fromWall(match.slice(1).map(Number))
  if (beirutInput(result) !== value) throw new Error('Enter a valid Beirut collection date')
  return result.toISOString()
}
export function usdCents(value: string) {
  const normalized = value.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace('٫', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Enter a USD amount with at most two decimal places')
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) throw new Error('Enter a positive USD amount up to 1,000,000')
  return cents
}
export function cashMoney(cents: number | null | undefined, language: Language = 'en') {
  return cents == null ? '—' : new Intl.NumberFormat(language === 'ar' ? 'ar-LB' : 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(cents / 100)
}
export function cashDate(iso: string | null | undefined, language: Language = 'en', time = false) {
  return iso ? new Intl.DateTimeFormat(language === 'ar' ? 'ar-LB' : 'en-GB', {
    timeZone: zone, day: 'numeric', month: 'short', year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(new Date(iso)) : '—'
}
/** Demo calculation mirrors the SQL calendar operation; SQL remains authoritative. */
export function calendarCoverage(anchor: string, cents: number, annual: number) {
  const parts = wallParts(new Date(anchor))
  const months = Math.floor(12 * cents / annual)
  const remainder = (12 * cents) % annual
  function boundary(offset: number) {
    const date = new Date(Date.UTC(parts[0], parts[1] - 1 + offset, 1))
    const year = date.getUTCFullYear(), month = date.getUTCMonth()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return fromWall([year, month + 1, Math.min(parts[2], lastDay), ...parts.slice(3)]).getTime()
  }
  const start = boundary(months), end = boundary(months + 1)
  return new Date(start + Math.floor((end - start) / 1000 * remainder / annual) * 1000).toISOString()
}
export function billingStatus(shop: ShopBilling): 'Archived' | 'Suspended' | 'Trial' | 'Active' | 'Expired' {
  if (shop.archived) return 'Archived'
  if (shop.subscription_status === 'suspended') return 'Suspended'
  if (shop.paid_until && new Date(shop.paid_until).getTime() <= Date.now()) return 'Expired'
  return shop.subscription_status === 'trial' ? 'Trial' : 'Active'
}
