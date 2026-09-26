import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAX_QUANTITY, orderCount, type OrderLine } from './order'

const storageKey = (slug: string) => `fluxiva-order:${slug}`

/**
 * Reads the order back after a reload. Session storage rather than local: an
 * order belongs to this visit, and a half-built order resurfacing days later
 * would be confusing rather than helpful.
 *
 * Every access is guarded — a private window, or blocked site data, makes
 * these throw rather than return empty, and a diner losing their menu over a
 * storage setting would be a poor trade for the convenience.
 */
function readStored(slug: string): OrderLine[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(slug))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((line): line is OrderLine =>
      typeof line?.itemId === 'string'
      && Number.isInteger(line?.variantIndex)
      && Number.isInteger(line?.quantity)
      && line.quantity > 0)
  } catch { return [] }
}

export interface OrderApi {
  lines: OrderLine[]
  count: number
  quantityOf: (itemId: string, variantIndex: number) => number
  add: (itemId: string, variantIndex: number) => void
  setQuantity: (itemId: string, variantIndex: number, quantity: number) => void
  clear: () => void
}

export function useOrder(slug: string, enabled: boolean): OrderApi {
  const [lines, setLines] = useState<OrderLine[]>([])
  /* Which slug the stored order has been read back for. Ordering is not
     enabled until the menu has loaded, so reading once at mount would always
     run against `enabled: false` and silently drop a saved order — and the
     save effect below would then write the empty list straight over it. */
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !slug || hydratedFor === slug) return
    setLines(readStored(slug))
    setHydratedFor(slug)
  }, [enabled, slug, hydratedFor])

  useEffect(() => {
    // Never write before the read: see the note on `hydratedFor`.
    if (!enabled || !slug || hydratedFor !== slug) return
    try {
      if (lines.length) window.sessionStorage.setItem(storageKey(slug), JSON.stringify(lines))
      else window.sessionStorage.removeItem(storageKey(slug))
    } catch { /* storage unavailable; the order simply does not survive a reload */ }
  }, [lines, slug, enabled, hydratedFor])

  const setQuantity = useCallback((itemId: string, variantIndex: number, quantity: number) => {
    const next = Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY)
    setLines((current) => {
      const existing = current.findIndex((line) => line.itemId === itemId && line.variantIndex === variantIndex)
      if (next <= 0) return existing < 0 ? current : current.filter((_, index) => index !== existing)
      if (existing < 0) return [...current, { itemId, variantIndex, quantity: next }]
      return current.map((line, index) => (index === existing ? { ...line, quantity: next } : line))
    })
  }, [])

  const quantityOf = useCallback((itemId: string, variantIndex: number) =>
    lines.find((line) => line.itemId === itemId && line.variantIndex === variantIndex)?.quantity ?? 0, [lines])

  const add = useCallback((itemId: string, variantIndex: number) => {
    setLines((current) => {
      const existing = current.findIndex((line) => line.itemId === itemId && line.variantIndex === variantIndex)
      if (existing < 0) return [...current, { itemId, variantIndex, quantity: 1 }]
      return current.map((line, index) =>
        (index === existing ? { ...line, quantity: Math.min(line.quantity + 1, MAX_QUANTITY) } : line))
    })
  }, [])

  const clear = useCallback(() => setLines([]), [])

  return useMemo(
    () => ({ lines, count: orderCount(lines), quantityOf, add, setQuantity, clear }),
    [lines, quantityOf, add, setQuantity, clear],
  )
}
