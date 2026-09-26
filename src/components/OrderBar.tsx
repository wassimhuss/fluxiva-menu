import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { buildOrderMessage, orderTotal, resolveLines, whatsappOrderLink, MAX_QUANTITY } from '../lib/order'
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
  formatPrice: (value: number) => string
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

  const lines = resolveLines(order.lines, items, t)
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

  // Closing on Escape, because the sheet covers the whole menu on a phone.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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

  return (
    <div className={styles.root} dir={rtl ? 'rtl' : 'ltr'} style={{ '--order-brand': brand, '--order-ink': brandInk } as React.CSSProperties}>
      {!open && (
        <button className={styles.trigger} onClick={() => setOpen(true)}>
          <ShoppingBag />
          {order.count > 0
            ? <>{t('Your order', 'طلبك')}<span className={styles.count}>{order.count}</span></>
            : t('Order takeaway', 'اطلب سفري')}
        </button>
      )}

      {open && (
        <>
          <button className={styles.backdrop} aria-label={t('Close order', 'إغلاق الطلب')} onClick={() => setOpen(false)} />
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('Takeaway order', 'طلب سفري')}>
            <header className={styles.head}>
              <div>
                <h2>{t('Takeaway order', 'طلب سفري')}</h2>
                <p>{t('Sent to the restaurant on WhatsApp. They confirm the order and the price.',
                  'يُرسل إلى المطعم عبر واتساب. المطعم يؤكد الطلب والسعر.')}</p>
              </div>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label={t('Close', 'إغلاق')}><X /></button>
            </header>

            {lines.length ? (
              <>
                <div className={styles.lines}>
                  {lines.map((line) => (
                    <div className={styles.line} key={`${line.itemId}::${line.variantIndex}`}>
                      <span className={styles.lineName}>{t(line.item.name_en, line.item.name_ar)}</span>
                      <span className={styles.lineTotal}>{formatPrice(line.lineTotal)}</span>
                      <span className={styles.lineMeta}>
                        {line.variantName ? `${line.variantName} · ` : ''}{formatPrice(line.unitPrice)}
                      </span>
                      <span className={styles.stepper}>
                        <button
                          onClick={() => order.setQuantity(line.itemId, line.variantIndex, line.quantity - 1)}
                          aria-label={line.quantity === 1
                            ? t('Remove from order', 'إزالة من الطلب')
                            : t('Reduce quantity', 'تقليل الكمية')}
                        >
                          {line.quantity === 1 ? <Trash2 /> : <Minus />}
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          onClick={() => order.setQuantity(line.itemId, line.variantIndex, line.quantity + 1)}
                          disabled={line.quantity >= MAX_QUANTITY}
                          aria-label={t('Increase quantity', 'زيادة الكمية')}
                        >
                          <Plus />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                <label className={styles.note}>
                  {t('Note for the restaurant (optional)', 'ملاحظة للمطعم (اختياري)')}
                  <textarea
                    value={note}
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('No pickles, ready in 20 minutes…', 'بدون كبيس، جاهز خلال ٢٠ دقيقة…')}
                  />
                </label>

                <footer className={styles.foot}>
                  <div className={styles.totalRow}>
                    <span>{t('Total', 'المجموع')}</span>
                    <b>{formatPrice(total)}</b>
                  </div>
                  <a
                    className={styles.send}
                    href={whatsappOrderLink(restaurant.whatsapp ?? '', message)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    <ShoppingBag /> {t('Send order on WhatsApp', 'أرسل الطلب عبر واتساب')}
                  </a>
                  <p className={styles.disclaimer}>
                    {t('This opens WhatsApp with your order written out. Nothing is ordered until the restaurant replies.',
                      'سيفتح واتساب مع طلبك مكتوباً. لا يتم تأكيد الطلب حتى يرد المطعم.')}
                  </p>
                </footer>
              </>
            ) : (
              <p className={styles.empty}>{t('Your order is empty. Add dishes from the menu.', 'طلبك فارغ. أضف أصنافاً من القائمة.')}</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
