import type { Currency } from './types'

/**
 * Prices as the restaurant charges them.
 *
 * Pounds are written without decimals — a menu priced in hundreds of thousands
 * has no use for them — while dollars keep their cents, which is the whole
 * reason the stored column had to stop being an integer.
 */
export function formatMoney(value: number, currency: Currency = 'LBP') {
  if (currency === 'USD') {
    return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
  }
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} LBP`
}

/** Kept for call sites that are always pounds, such as platform billing. */
export function formatLbp(value: number) {
  return formatMoney(value, 'LBP')
}

export function localText(language: 'en' | 'ar', english: string, arabic: string) {
  return language === 'ar' ? arabic || english : english || arabic
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
