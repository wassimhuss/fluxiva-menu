import { formatMoney } from './format'
import type { Currency, MenuItem } from './types'

/** Product-defined conversion, not a live exchange-rate feed. */
export const LBP_PER_USD = 89500
export const roundUsd = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export const lbpToUsd = (value: number) => roundUsd(value / LBP_PER_USD)
export const usdToLbp = (value: number) => Math.round(value * LBP_PER_USD)

export interface MenuPrice { price: number; price_secondary?: number | null }

/** The existing price remains in the restaurant's currency. A null alternate
 * price means automatic conversion; zero is a legitimate manual override. */
export function secondaryPrice(source: MenuPrice, currency: Currency = 'LBP') {
  return source.price_secondary ?? (currency === 'LBP' ? lbpToUsd(source.price) : usdToLbp(source.price))
}

export function formatMenuPrice(value: number, currency: Currency = 'LBP', secondary?: number | null) {
  const alternate = secondaryPrice({ price: value, price_secondary: secondary }, currency)
  const lbp = currency === 'LBP' ? value : alternate
  const usd = currency === 'USD' ? value : alternate
  return `${formatMoney(lbp, 'LBP')} / ${formatMoney(usd, 'USD')}`
}

export function formatStartingPrice(item: MenuPrice & { variants: MenuPrice[] }, currency: Currency = 'LBP') {
  const cheapest = item.variants.reduce<MenuPrice>((best, row) => row.price < best.price ? row : best, item.variants[0] ?? item)
  return formatMenuPrice(cheapest.price, currency, cheapest.price_secondary)
}

export function swapMenuCurrency(item: MenuItem, previous: Currency): MenuItem {
  const swap = <T extends MenuPrice>(row: T): T => ({ ...row, price: secondaryPrice(row, previous), price_secondary: row.price })
  return { ...swap(item), variants: item.variants.map(swap), extras: item.extras.map(swap) }
}
