import { useCallback, useEffect, useMemo, useState } from 'react'
import { addOrderLine, lineKey, orderCount, parseOrderLines, setOrderLineQuantity, updateOrderLineNote, type OrderLine } from './order'

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
    return parseOrderLines(window.sessionStorage.getItem(storageKey(slug)))
  } catch { return [] }
}

export interface OrderApi {
  lines: OrderLine[]
  count: number
  /** Without extraIds, returns the total across every customization. */
  quantityOf: (itemId: string, variantIndex: number, extraIds?: string[], note?: string) => number
  add: (itemId: string, variantIndex: number, extraIds?: string[], note?: string) => void
  setQuantity: (itemId: string, variantIndex: number, quantity: number, extraIds?: string[], note?: string) => void
  updateNote: (line: OrderLine, note: string) => void
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

  const setQuantity = useCallback((itemId: string, variantIndex: number, quantity: number, extraIds: string[] = [], note = '') => {
    setLines(current => setOrderLineQuantity(current, {itemId, variantIndex, extraIds, note, quantity}, quantity))
  }, [])

  const quantityOf = useCallback((itemId: string, variantIndex: number, extraIds?: string[], note = '') => {
    if (extraIds === undefined) {
      return lines.filter((line) => line.itemId === itemId && line.variantIndex === variantIndex)
        .reduce((sum, line) => sum + line.quantity, 0)
    }
    const key = lineKey(itemId, variantIndex, extraIds, note)
    return lines.find((line) => lineKey(line.itemId, line.variantIndex, line.extraIds, line.note) === key)?.quantity ?? 0
  }, [lines])

  const add = useCallback((itemId: string, variantIndex: number, extraIds: string[] = [], note = '') => {
    setLines(current => addOrderLine(current, {itemId, variantIndex, extraIds, note, quantity: 1}))
  }, [])

  const updateNote = useCallback((line: OrderLine, note: string) => {
    setLines(current => updateOrderLineNote(current, line, note))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  return useMemo(
    () => ({ lines, count: orderCount(lines), quantityOf, add, setQuantity, updateNote, clear }),
    [lines, quantityOf, add, setQuantity, updateNote, clear],
  )
}
