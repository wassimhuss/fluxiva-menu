import type { ItemExtra, Language, MenuItem } from './types'

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
  quantity: number
}

/** A line joined back to the dish it refers to, ready to render or send. */
export interface ResolvedLine extends OrderLine {
  item: MenuItem
  variantName: string
  extras: ItemExtra[]
  unitPrice: number
  lineTotal: number
}

export const MAX_QUANTITY = 99

export function normalizeExtraIds(extraIds: string[] = []) {
  return [...new Set(extraIds.filter(Boolean))].sort()
}

export function lineKey(itemId: string, variantIndex: number, extraIds: string[] = []) {
  return `${itemId}::${variantIndex}::${normalizeExtraIds(extraIds).join(',')}`
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
    const unitPrice = (variant?.price ?? item.price) + extras.reduce((sum, extra) => sum + extra.price, 0)
    resolved.push({
      ...line,
      // Keep the stored key stable even if the owner removes an extra while a
      // diner has the menu open. Removed extras stop affecting price/text, but
      // the remaining line can still be increased or removed correctly.
      extraIds: normalizeExtraIds(line.extraIds),
      item,
      variantName: variant?.name_en ?? '',
      extras,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
    })
  }
  return resolved
}

export function orderTotal(lines: ResolvedLine[]) {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0)
}

export function orderCount(lines: OrderLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

/* wa.me refuses very long links, and the ceiling varies by client and
   platform. Staying well under the smallest one people report is worth more
   than squeezing in two extra lines. Measured against the encoded text, which
   is what actually travels. */
const MAX_ENCODED_TEXT = 1400

interface MessageInput {
  restaurantName: string
  lines: ResolvedLine[]
  language: Language
  formatPrice: (value: number) => string
  note?: string
}

/**
 * The message the diner sends. Written in whichever language they were reading
 * the menu in, because that is the language they are about to type in.
 */
export function buildOrderMessage({ restaurantName, lines, language, formatPrice, note }: MessageInput) {
  const ar = language === 'ar'
  const head = ar ? `طلب سفري من ${restaurantName}` : `Takeaway order from ${restaurantName}`
  const totalLabel = ar ? 'المجموع' : 'Total'
  const noteLabel = ar ? 'ملاحظة' : 'Note'
  const moreLabel = (count: number) => (ar ? `…و${count} صنف إضافي` : `…and ${count} more item(s)`)

  const rendered = lines.map((line) => {
    const name = ar ? line.item.name_ar : line.item.name_en
    const size = line.variantName ? ` (${line.variantName})` : ''
    const extras = line.extras.length
      ? ` + ${line.extras.map((extra) => ar ? extra.name_ar : extra.name_en).join(', ')}`
      : ''
    return `${line.quantity} × ${name}${size}${extras} — ${formatPrice(line.lineTotal)}`
  })

  const tail = () => {
    const parts = [`${totalLabel}: ${formatPrice(orderTotal(lines))}`]
    if (note?.trim()) parts.push(`${noteLabel}: ${note.trim()}`)
    return parts
  }

  const assemble = (body: string[], dropped: number) => [
    head,
    '',
    ...body,
    ...(dropped > 0 ? [moreLabel(dropped)] : []),
    '',
    ...tail(),
  ].join('\n')

  let message = assemble(rendered, 0)
  // Trim from the end until the encoded message fits, so the total and any
  // note always survive — those are the parts the restaurant needs most.
  let kept = rendered.length
  while (kept > 0 && encodeURIComponent(message).length > MAX_ENCODED_TEXT) {
    kept -= 1
    message = assemble(rendered.slice(0, kept), rendered.length - kept)
  }
  return message
}

export function whatsappOrderLink(whatsapp: string, message: string) {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}
