import { formatMoney } from './format'
import type { Currency, MenuItem } from './types'

export const roundUsd = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export interface MenuPrice { price: number; price_secondary?: number | null }

/** Missing means not entered, never a converted amount or a free price. */
export function secondaryPrice(source: MenuPrice) {
  return source.price_secondary ?? null
}

/** An incomplete alternate total must not look like a complete quoted price. */
export function sumSecondaryPrices(parts: MenuPrice[]) {
  if (parts.some(part => secondaryPrice(part) === null)) return null
  return roundUsd(parts.reduce((sum, part) => sum + part.price_secondary!, 0))
}

export function formatMenuPrice(value: number, currency: Currency = 'LBP', secondary?: number | null) {
  const alternate = secondaryPrice({ price: value, price_secondary: secondary })
  if (alternate === null) return formatMoney(value, currency)
  const lbp = currency === 'LBP' ? value : alternate
  const usd = currency === 'USD' ? value : alternate
  return `${formatMoney(lbp, 'LBP')} / ${formatMoney(usd, 'USD')}`
}

export function formatStartingPrice(item: MenuPrice & { variants: MenuPrice[] }, currency: Currency = 'LBP') {
  const cheapest = item.variants.reduce<MenuPrice>((best, row) => row.price < best.price ? row : best, item.variants[0] ?? item)
  return formatMenuPrice(cheapest.price, currency, cheapest.price_secondary)
}

export function swapMenuCurrency(item: MenuItem): MenuItem {
  const swap = <T extends MenuPrice>(row: T): T => {
    const alternate = secondaryPrice(row)
    if (alternate === null) throw new Error('Enter both LBP and USD prices for every item, size and extra before changing currency.')
    return { ...row, price: alternate, price_secondary: row.price }
  }
  return { ...swap(item), variants: item.variants.map(swap), extras: item.extras.map(swap) }
}
