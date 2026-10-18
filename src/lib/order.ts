import type { ItemExtra, Language, MenuItem } from './types'
import { sumSecondaryPrices, roundUsd } from './pricing'

/**
 * A takeaway order, held only in the diner's browser.
 *
 * Nothing about an order is stored server-side. It leaves as a WhatsApp
 * message and the restaurant answers it like any other message — so this is a
 * way of composing a message, not an order system, and the wording shown to
 * the diner has to stay honest about that.
 */
export interface OrderLine {
  itemId: string
  /** Which size was chosen; 0 when the dish has no sizes. */
  variantIndex: number
  /** Stable ids of the optional add-ons selected for this line. */
  extraIds: string[]
  /** Preparation instructions for this exact size/extra combination. */
  note?: string
  quantity: number
}

/** A line joined back to the dish it refers to, ready to render or send. */
export interface ResolvedLine extends OrderLine {
  item: MenuItem
  variantName: string
  extras: ItemExtra[]
  unitPrice: number
  lineTotal: number
  unitPriceSecondary: number | null
  lineTotalSecondary: number | null
}

export const MAX_QUANTITY = 99
export const MAX_ITEM_NOTE_LENGTH = 200

export function normalizeItemNote(note: unknown = '') {
  return typeof note === 'string' ? note.replace(/\r\n?/g, '\n').replace(/\p{Cc}/gu, character => character === '\n' || character === '\t' ? character : '').slice(0, MAX_ITEM_NOTE_LENGTH).replace(/\p{Surrogate}/gu, '\uFFFD').trim() : ''
}

export function normalizeExtraIds(extraIds: string[] = []) {
  return [...new Set(extraIds.filter(Boolean))].sort()
}

export function lineKey(itemId: string, variantIndex: number, extraIds: string[] = [], note = '') {
  return JSON.stringify([itemId, variantIndex, normalizeExtraIds(extraIds), normalizeItemNote(note)])
}

const keyOf = (line: OrderLine) => lineKey(line.itemId, line.variantIndex, line.extraIds, line.note)

/** Backwards-compatible session hydration: old baskets simply have no item notes. */
export function parseOrderLines(raw: string | null): OrderLine[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((line): OrderLine[] => {
      if (typeof line?.itemId !== 'string' || !Number.isInteger(line?.variantIndex) || line.variantIndex < 0
        || !Number.isInteger(line?.quantity) || line.quantity <= 0) return []
      const extraIds = Array.isArray(line.extraIds) ? line.extraIds.filter((id: unknown): id is string => typeof id === 'string') : []
      return [{itemId: line.itemId, variantIndex: line.variantIndex, extraIds: normalizeExtraIds(extraIds), quantity: Math.min(line.quantity, MAX_QUANTITY), note: normalizeItemNote(line.note)}]
    })
  } catch { return [] }
}

export function setOrderLineQuantity(lines: OrderLine[], target: OrderLine, quantity: number): OrderLine[] {
  if (!Number.isFinite(quantity)) return lines
  const next = Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY)
  const key = keyOf(target)
  const existing = lines.findIndex(line => keyOf(line) === key)
  if (next <= 0) return existing < 0 ? lines : lines.filter((_, index) => index !== existing)
  if (existing < 0) return [...lines, {...target, extraIds: normalizeExtraIds(target.extraIds), note: normalizeItemNote(target.note), quantity: next}]
  return lines.map((line, index) => index === existing ? {...line, quantity: next} : line)
}

export function addOrderLine(lines: OrderLine[], target: OrderLine): OrderLine[] {
  const existing = lines.find(line => keyOf(line) === keyOf(target))
  return setOrderLineQuantity(lines, target, (existing?.quantity ?? 0) + 1)
}

export function canUpdateOrderLineNote(lines: OrderLine[], target: OrderLine, note: string) {
  const source = lines.find(line => keyOf(line) === keyOf(target))
  const other = lines.find(line => keyOf(line) !== keyOf(target) && keyOf(line) === keyOf({...target, note}))
  return !source || !other || source.quantity + other.quantity <= MAX_QUANTITY
}

/** Merge matching instructions after an edit, without dropping quantity at the cap. */
export function updateOrderLineNote(lines: OrderLine[], target: OrderLine, note: string): OrderLine[] {
  if (!canUpdateOrderLineNote(lines, target, note)) return lines
  const source = lines.find(line => keyOf(line) === keyOf(target))
  if (!source) return lines
  const updated = {...source, note: normalizeItemNote(note)}
  if (keyOf(updated) === keyOf(source)) return lines
  const other = lines.find(line => keyOf(line) === keyOf(updated))
  if (other) return lines.filter(line => keyOf(line) !== keyOf(source)).map(line => line === other ? {...line, quantity: line.quantity + source.quantity} : line)
  return lines.map(line => line === source ? updated : line)
}

/**
 * Joins stored lines to the live menu, dropping anything that no longer
 * exists. A menu can change between the diner adding a dish and sending the
 * order — an item deleted or marked unavailable must not travel with it.
 */
export function resolveLines(lines: OrderLine[], items: MenuItem[]): ResolvedLine[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const resolved: ResolvedLine[] = []
  for (const line of lines) {
    const item = byId.get(line.itemId)
    if (!item || !item.available) continue
    const variant = item.variants?.[line.variantIndex]
    // A size that has since been removed falls back to the base price rather
    // than sending a price nobody offers.
    const selectedIds = new Set(normalizeExtraIds(line.extraIds))
    const extras = (item.extras ?? []).filter((extra) => extra.id && selectedIds.has(extra.id))
    const unitPrice = roundUsd((variant?.price ?? item.price) + extras.reduce((sum, extra) => sum + extra.price, 0))
    const unitPriceSecondary = sumSecondaryPrices([variant ?? item, ...extras])
    resolved.push({
      ...line,
      // Keep the stored key stable even if the owner removes an extra while a
      // diner has the menu open. Removed extras stop affecting price/text, but
      // the remaining line can still be increased or removed correctly.
      extraIds: normalizeExtraIds(line.extraIds),
      note: normalizeItemNote(line.note),
      item,
      variantName: variant?.name_en ?? '',
      extras,
      unitPrice,
      lineTotal: roundUsd(unitPrice * line.quantity),
      unitPriceSecondary,
      lineTotalSecondary: unitPriceSecondary === null ? null : roundUsd(unitPriceSecondary * line.quantity),
    })
  }
  return resolved
}

export function orderTotal(lines: ResolvedLine[]) {
  return roundUsd(lines.reduce((sum, line) => sum + line.lineTotal, 0))
}

export function orderTotalSecondary(lines: ResolvedLine[]) {
  if (lines.some(line => line.lineTotalSecondary === null)) return null
  return roundUsd(lines.reduce((sum, line) => sum + line.lineTotalSecondary!, 0))
}

export function orderCount(lines: OrderLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

/* wa.me refuses very long links, and the ceiling varies by client and
   platform. Staying well under the smallest one people report is worth more
   than squeezing in two extra lines. Measured against the encoded text, which
   is what actually travels. */
export const MAX_ENCODED_TEXT = 1400

export function orderMessageTooLong(message: string) {
  return encodeURIComponent(message).length > MAX_ENCODED_TEXT
}

interface MessageInput {
  restaurantName: string
  lines: ResolvedLine[]
  language: Language
  formatPrice: (value: number, secondary?: number | null) => string
  note?: string
}

/**
 * The message the diner sends. Written in whichever language they were reading
 * the menu in, because that is the language they are about to type in.
 */
export function buildOrderMessage({ restaurantName, lines, language, formatPrice, note }: MessageInput) {
  const ar = language === 'ar'
  const head = ar ? `طلب دليفري من ${restaurantName}` : `Takeaway order from ${restaurantName}`
  const totalLabel = ar ? 'المجموع' : 'Total'
  const noteLabel = ar ? 'ملاحظة' : 'Note'

  const rendered = lines.map((line) => {
    const name = ar ? line.item.name_ar : line.item.name_en
    const size = line.variantName ? ` (${line.variantName})` : ''
    const extras = line.extras.length
      ? ` + ${line.extras.map((extra) => ar ? extra.name_ar : extra.name_en).join(', ')}`
      : ''
    const itemNote = normalizeItemNote(line.note)
    return `${line.quantity} × ${name}${size}${extras} — ${formatPrice(line.lineTotal, line.lineTotalSecondary)}${itemNote ? `\n  ${noteLabel}: ${itemNote.replace(/\n/g, '\n  ')}` : ''}`
  })

  const tail = () => {
    const parts = [`${totalLabel}: ${formatPrice(orderTotal(lines), orderTotalSecondary(lines))}`]
    if (note?.trim()) parts.push(`${noteLabel}: ${note.trim()}`)
    return parts
  }

  // Never silently omit a dish or its preparation instructions to fit a URL.
  // The basket blocks oversized links and asks the diner to shorten the order.
  return [
    head,
    '',
    ...rendered,
    '',
    ...tail(),
  ].join('\n')

}

export function whatsappOrderLink(whatsapp: string, message: string) {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}
