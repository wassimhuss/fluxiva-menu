import { MessageSquare, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildOrderMessage, canUpdateOrderLineNote, lineKey, orderMessageTooLong, orderTotal, orderTotalSecondary, resolveLines, whatsappOrderLink, MAX_ITEM_NOTE_LENGTH, MAX_QUANTITY } from '../lib/order'
import type { Language, MenuItem, Restaurant } from '../lib/types'
import type { OrderApi } from '../lib/useOrder'
import styles from './OrderBar.module.css'

interface Props {
  restaurant: Restaurant
  items: MenuItem[]
  order: OrderApi
  language: Language
  rtl: boolean
  t: (english: string, arabic: string) => string
  formatPrice: (value: number, secondary?: number | null) => string
  brand: string
  brandInk: string
}

/**
 * Takeaway ordering, rendered beside the menu rather than inside it.
 *
 * The diner never leaves the design they scanned into: the button floats over
 * whichever template is running and the order opens in a sheet above it, so
 * adding ordering to a new template costs nothing.
 */
export function OrderBar({ restaurant, items, order, language, rtl, t, formatPrice, brand, brandInk }: Props) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [itemNote, setItemNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState('')
  const [manualCopyMessage, setManualCopyMessage] = useState('')
  const sheet = useRef<HTMLElement>(null)
  const modal = useRef<HTMLDialogElement>(null)

  const lines = resolveLines(order.lines, items)
  const total = orderTotal(lines)

  /* The button floats over whichever design is running, and two of them anchor
     their own content to the bottom edge — on Reel it sat squarely on top of
     the price and the add control, so the dish could not be added at all.
     Rather than have the button dodge each design, it publishes the room it
     occupies and those designs reserve it. */
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--fluxiva-order-space', '78px')
    return () => { root.style.removeProperty('--fluxiva-order-space') }
  }, [])

  // Native modal focus/inertness keeps menu and demo-template controls behind it.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = modal.current
    element?.showModal()
    sheet.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  /* An order can empty itself while the sheet is open — the last line removed,
     or a dish that went unavailable between adding and sending. */
  useEffect(() => { if (open && !lines.length) setNote('') }, [open, lines.length])

  const message = buildOrderMessage({
    restaurantName: t(restaurant.name_en, restaurant.name_ar),
    lines,
    language,
    formatPrice,
    note,
  })
  const tooLong = orderMessageTooLong(message)
  const isEditingNote = lines.some(line => lineKey(line.itemId, line.variantIndex, line.extraIds, line.note) === editingKey)
  const close = () => { setOpen(false); setEditingKey(null) }
  const copyFullOrder = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopiedMessage(message)
      setManualCopyMessage('')
    } catch {
      setManualCopyMessage(message)
    }
  }

  return (
    <div className={styles.root} dir={rtl ? 'rtl' : 'ltr'} style={{ '--order-brand': brand, '--order-ink': brandInk } as React.CSSProperties}>
      {!open && (
        <button className={styles.trigger} onClick={() => setOpen(true)}>
          <ShoppingBag />
          {order.count > 0
            ? <>{t('Your order', 'طلبك')}<span className={styles.count}>{order.count}</span></>
            : t('Order takeaway', 'اطلب دليفري')}
        </button>
      )}

      {open && (
        <dialog ref={modal} className={styles.modal} aria-label={t('Takeaway order', 'طلب دليفري')} onCancel={event => { event.preventDefault(); close() }}>
          <button className={styles.backdrop} tabIndex={-1} aria-label={t('Close order', 'تسكير الطلب')} onClick={close} />
          <section ref={sheet} className={styles.sheet}>
            <header className={styles.head}>
              <div>
                <h2>{t('Takeaway order', 'طلب دليفري')}</h2>
                <p>{t('Sent to the restaurant on WhatsApp. They confirm the order and the price.',
                  'الطلب بينبعت للمطعم عالواتساب، والمطعم بيأكّدلك الطلب والسعر.')}</p>
              </div>
              <button className={styles.close} onClick={close} aria-label={t('Close', 'سكّر')}><X /></button>
            </header>

            {lines.length ? (
              <>
                <div className={styles.body}>
                <div className={styles.lines}>
                  {lines.map((line) => (
                    <div className={styles.line} key={lineKey(line.itemId, line.variantIndex, line.extraIds, line.note)}>
                      <span className={styles.lineName}>{t(line.item.name_en, line.item.name_ar)}</span>
                      <span className={styles.lineTotal} dir="ltr">{formatPrice(line.lineTotal, line.lineTotalSecondary)}</span>
                      <span className={styles.lineMeta}>
                        {[line.variantName, ...line.extras.map((extra) => t(extra.name_en, extra.name_ar))].filter(Boolean).join(' · ')}
                        {(line.variantName || line.extras.length) ? ' · ' : ''}<bdi dir="ltr">{formatPrice(line.unitPrice, line.unitPriceSecondary)}</bdi>
                      </span>
                      <span className={styles.stepper}>
                        <button
                          onClick={() => order.setQuantity(line.itemId, line.variantIndex, line.quantity - 1, line.extraIds, line.note)}
                          aria-label={line.quantity === 1
                            ? t('Remove from order', 'شيل من الطلب')
                            : t('Reduce quantity', 'تقليل الكمية')}
                        >
                          {line.quantity === 1 ? <Trash2 /> : <Minus />}
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          onClick={() => order.setQuantity(line.itemId, line.variantIndex, line.quantity + 1, line.extraIds, line.note)}
                          disabled={line.quantity >= MAX_QUANTITY}
                          aria-label={t('Increase quantity', 'زيادة الكمية')}
                        >
                          <Plus />
                        </button>
                      </span>
                      {editingKey === lineKey(line.itemId, line.variantIndex, line.extraIds, line.note) ? <form className={styles.itemNoteEditor} onSubmit={event => {
                        event.preventDefault()
                        if (!canUpdateOrderLineNote(order.lines, line, itemNote)) { setNoteError(true); return }
                        order.updateNote(line, itemNote)
                        setEditingKey(null)
                        setNoteError(false)
                      }}>
                        <label>{t('Note for this item (optional)', 'ملاحظة لهالصنف (اختياري)')}<textarea autoFocus value={itemNote} maxLength={MAX_ITEM_NOTE_LENGTH} rows={2} onChange={event => { setItemNote(event.target.value); setNoteError(false) }} placeholder={t('No pickles, cut in half…', 'بلا كبيس، قطّعلي ياها…')} /></label>
                        <small>{t('This note applies to the whole quantity on this line.', 'هالملاحظة لكل الكمية بهالسطر.')}</small>
                        {noteError && <p role="alert">{t('These instructions match another line. Reduce the combined quantity to 99 or less before saving.', 'هالملاحظة مطابقة لسطر تاني. خفّض مجموع الكمية لـ٩٩ أو أقل قبل ما تحفظ.')}</p>}
                        <div><button type="submit">{t('Save note', 'احفظ الملاحظة')}</button><button type="button" onClick={() => { setEditingKey(null); setNoteError(false) }}>{t('Cancel', 'إلغاء')}</button></div>
                      </form> : <button className={styles.itemNoteButton} onClick={() => {
                        setEditingKey(lineKey(line.itemId, line.variantIndex, line.extraIds, line.note))
                        setItemNote(line.note ?? '')
                        setNoteError(false)
                      }} aria-label={line.note ? t(`Edit note for ${line.item.name_en}`, `عدّل ملاحظة ${line.item.name_ar}`) : t(`Add note for ${line.item.name_en}`, `ضيف ملاحظة لـ${line.item.name_ar}`)}><MessageSquare /><span>{line.note || t('Add item note', 'ضيف ملاحظة لهالصنف')}</span></button>}
                    </div>
                  ))}
                </div>

                <label className={styles.note}>
                  {t('Note for the restaurant (optional)', 'ملاحظة للمطعم (اختياري)')}
                  <textarea
                    value={note}
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('Cutlery for two, call on arrival…', 'ملاعق لشخصين، رنّلي بس توصل…')}
                  />
                </label>
                </div>

                <footer className={styles.foot}>
                  <div className={styles.totalRow}>
                    <span>{t('Total', 'المجموع')}</span>
                    <b dir="ltr">{formatPrice(total, orderTotalSecondary(lines))}</b>
                  </div>
                  {isEditingNote ? <><p className={styles.lengthWarning} role="status">{t('Save or cancel your item note before sending the order.', 'احفظ ملاحظة الصنف أو الغِ التعديل قبل ما تبعت الطلب.')}</p><button className={styles.send} disabled>{t('Save your item note first', 'احفظ ملاحظة الصنف بالأول')}</button></> : tooLong ? <>
                    <p className={styles.lengthWarning} role="status">{t('Your order is too long for a WhatsApp link. Copy the full order, then open WhatsApp and paste it. No items or notes are left out.', 'طلبك طويل زيادة لرابط واتساب. انسخ الطلب كامل، وبعدين افتح واتساب والصقو. ما رح ينحذف أي صنف أو ملاحظة.')}</p>
                    <button className={styles.copyOrder} onClick={() => void copyFullOrder()}>{copiedMessage === message ? t('Order copied — paste it in WhatsApp', 'نسخنا الطلب — الصقو بواتساب') : t('Copy full order', 'انسخ الطلب كامل')}</button>
                    {manualCopyMessage === message && <label className={styles.manualCopy}>{t('Copy this full message manually', 'انسخ هالرسالة كاملة بإيدك')}<textarea readOnly rows={3} value={message} onFocus={event => event.target.select()} /></label>}
                    <a className={styles.send} href={whatsappOrderLink(restaurant.whatsapp ?? '', '')} target="_blank" rel="noreferrer">{t('Open WhatsApp and paste', 'افتح واتساب والصق الطلب')}</a>
                  </> : <a
                    className={styles.send}
                    href={whatsappOrderLink(restaurant.whatsapp ?? '', message)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={close}
                  >
                    <ShoppingBag /> {t('Send order on WhatsApp', 'ابعث الطلب عالواتساب')}
                  </a>}
                  <p className={styles.disclaimer}>
                    {tooLong ? t('Paste the copied order in WhatsApp. Nothing is ordered until the restaurant replies.', 'الصق الطلب اللي نسختو بواتساب. الطلب ما بيتأكّد قبل ما يردّ المطعم.') : t('This opens WhatsApp with your order written out. Nothing is ordered until the restaurant replies.',
                      'رح يفتح واتساب وطلبك مكتوب وجاهز. الطلب ما بيتأكّد قبل ما يردّ المطعم.')}
                  </p>
                </footer>
              </>
            ) : (
              <p className={styles.empty}>{t('Your order is empty. Add dishes from the menu.', 'بعد ما ضفت شي عطلبك. اختار أصناف من المنيو.')}</p>
            )}
          </section>
        </dialog>
      )}
    </div>
  )
}
