import { Check, Minus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuItem } from '../lib/types'
import type { MenuOrdering } from '../templates/types'
import styles from './AddToOrder.module.css'

interface Props {
  item: MenuItem
  /** The size the diner currently has selected on this dish. */
  variantIndex: number
  ordering: MenuOrdering
  t: (english: string, arabic: string) => string
  formatPrice: (value: number) => string
  rtl: boolean
  className?: string
}
/**
 * Adds a dish to the takeaway order from inside any menu design. Items with
 * optional extras open one shared customization sheet, keeping that workflow
 * consistent across every template.
 */
export function AddToOrder({ item, variantIndex, ordering, t, formatPrice, rtl, className = '' }: Props) {
  const [customizing, setCustomizing] = useState(false)
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([])
  const extras = useMemo(() => (item.extras ?? []).filter((extra) => extra.id), [item.extras])
  const quantity = ordering.quantityOf(item.id, variantIndex)

  useEffect(() => {
    if (!customizing) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setCustomizing(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [customizing])

  if (!item.available) return null

  const openCustomizer = () => {
    setSelectedExtraIds([])
    setCustomizing(true)
  }

  const toggleExtra = (id: string) => {
    setSelectedExtraIds((current) => current.includes(id)
      ? current.filter((extraId) => extraId !== id)
      : [...current, id])
  }

  const basePrice = item.variants?.[variantIndex]?.price ?? item.price
  const selectedExtras = extras.filter((extra) => extra.id && selectedExtraIds.includes(extra.id))
  const customizedPrice = basePrice + selectedExtras.reduce((sum, extra) => sum + extra.price, 0)

  const customizationSheet = customizing && createPortal(
    <div className={styles.customizer} dir={rtl ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className={styles.backdrop}
        onClick={() => setCustomizing(false)}
        aria-label={t('Close extras', 'إغلاق الإضافات')}
      />
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={`extras-${item.id}`}>
        <header className={styles.sheetHead}>
          <div>
            <span>{t('Customize your item', 'خصّص طلبك')}</span>
            <h2 id={`extras-${item.id}`}>{t(item.name_en, item.name_ar)}</h2>
          </div>
          <button type="button" className={styles.close} onClick={() => setCustomizing(false)} aria-label={t('Close', 'إغلاق')}><X /></button>
        </header>
        <div className={styles.extraList}>
          <p>{t('Choose any extras you want', 'اختر الإضافات التي تريدها')}</p>
          {extras.map((extra) => {
            const id = extra.id as string
            const selected = selectedExtraIds.includes(id)
            return (
              <button
                type="button"
                className={`${styles.extraOption} ${selected ? styles.extraOptionSelected : ''}`}
                onClick={() => toggleExtra(id)}
                aria-pressed={selected}
                key={id}
              >
                <span className={styles.check}>{selected && <Check />}</span>
                <span>{t(extra.name_en, extra.name_ar)}</span>
                <b>+ {formatPrice(extra.price)}</b>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className={styles.addCustomized}
          onClick={() => {
            ordering.add(item.id, variantIndex, selectedExtraIds)
            setCustomizing(false)
          }}
        >
          <span>{t('Add to order', 'أضف إلى الطلب')}</span>
          <b>{formatPrice(customizedPrice)}</b>
        </button>
      </section>
    </div>,
    document.body,
  )

  if (extras.length > 0) {
    return (
      <>
        <span className={`${styles.root} ${quantity > 0 ? styles.rootActive : ''} ${className}`}>
          {quantity > 0 && <span className={styles.count} aria-label={t(`${quantity} in order`, `${quantity} في الطلب`)}>{quantity}</span>}
          <button
            type="button"
            className={styles.button}
            onClick={openCustomizer}
            aria-label={t(`Customize and add ${item.name_en}`, `خصّص وأضف ${item.name_ar}`)}
            title={t('Choose extras', 'اختر الإضافات')}
          >
            <Plus />
          </button>
        </span>
        {customizationSheet}
      </>
    )
  }

  if (quantity === 0) {
    return (
      <span className={`${styles.root} ${className}`}>
        <button
          type="button"
          className={styles.button}
          onClick={() => ordering.add(item.id, variantIndex)}
          aria-label={t(`Add ${item.name_en} to order`, `أضف ${item.name_ar} إلى الطلب`)}
          title={t('Add to order', 'أضف إلى الطلب')}
        >
          <Plus />
        </button>
      </span>
    )
  }

  return (
    <span className={`${styles.root} ${styles.rootActive} ${className}`}>
      <button
        type="button"
        className={styles.button}
        onClick={() => ordering.setQuantity(item.id, variantIndex, quantity - 1)}
        aria-label={quantity === 1
          ? t(`Remove ${item.name_en} from order`, `إزالة ${item.name_ar} من الطلب`)
          : t(`One less ${item.name_en}`, `تقليل ${item.name_ar}`)}
      >
        {quantity === 1 ? <Trash2 /> : <Minus />}
      </button>
      <span className={styles.count} aria-label={t(`${quantity} in order`, `${quantity} في الطلب`)}>{quantity}</span>
      <button
        type="button"
        className={styles.button}
        onClick={() => ordering.add(item.id, variantIndex)}
        aria-label={t(`One more ${item.name_en}`, `زيادة ${item.name_ar}`)}
      >
        <Plus />
      </button>
    </span>
  )
}
