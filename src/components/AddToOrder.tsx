import { Check, Minus, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuItem } from '../lib/types'
import type { MenuOrdering } from '../templates/types'
import { roundUsd, sumSecondaryPrices } from '../lib/pricing'
import { MAX_ITEM_NOTE_LENGTH, MAX_QUANTITY } from '../lib/order'
import styles from './AddToOrder.module.css'

interface Props {
  item: MenuItem
  /** The size the diner currently has selected on this dish. */
  variantIndex: number
  ordering: MenuOrdering
  t: (english: string, arabic: string) => string
  formatPrice: (value: number, secondary?: number | null) => string
  rtl: boolean
  className?: string
}
/**
 * Every first add offers sizes, paid extras and optional preparation notes.
 * Exact repeats stay one tap; a separate control creates different instructions.
 */
export function AddToOrder({ item, variantIndex, ordering, t, formatPrice, rtl, className = '' }: Props) {
  const [customizing, setCustomizing] = useState(false)
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([])
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(variantIndex)
  const [note, setNote] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const extras = useMemo(() => (item.extras ?? []).filter((extra) => extra.id), [item.extras])
  const quantity = ordering.quantityOf(item.id, variantIndex)
  const matchingLines = ordering.lines.filter(line => line.itemId === item.id && line.variantIndex === variantIndex)
  const repeatLine = matchingLines.length === 1 ? matchingLines[0] : undefined

  useEffect(() => {
    if (!customizing) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = dialog.current
    element?.showModal()
    closeButton.current?.focus()
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [customizing])

  if (!item.available) return null

  const openCustomizer = () => {
    setSelectedExtraIds([])
    setSelectedVariantIndex(variantIndex)
    setNote('')
    setCustomizing(true)
  }

  const toggleExtra = (id: string) => {
    setSelectedExtraIds((current) => current.includes(id)
      ? current.filter((extraId) => extraId !== id)
      : [...current, id])
  }

  const basePrice = item.variants?.[selectedVariantIndex]?.price ?? item.price
  const selectedExtras = extras.filter((extra) => extra.id && selectedExtraIds.includes(extra.id))
  const customizedPrice = basePrice + selectedExtras.reduce((sum, extra) => sum + extra.price, 0)
  // The formatter owns the restaurant currency; parse neither its display text
  // nor a total's converted value. Add each explicitly priced component.
  const priceParts = [item.variants?.[selectedVariantIndex] ?? item, ...selectedExtras]
  const customizedSecondary = sumSecondaryPrices(priceParts)
  const customizedQuantity = ordering.quantityOf(item.id, selectedVariantIndex, selectedExtraIds, note)

  const customizationSheet = customizing && createPortal(
    <dialog ref={dialog} className={styles.customizer} dir={rtl ? 'rtl' : 'ltr'} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); setCustomizing(false) }}>
      <button
        type="button"
        className={styles.backdrop}
        onClick={() => setCustomizing(false)}
        aria-label={t('Close extras', 'تسكير الإضافات')}
        tabIndex={-1}
      />
      <section className={styles.sheet}>
        <header className={styles.sheetHead}>
          <div>
            <span>{t('Customize your item', 'ظبّط طلبك عذوقك')}</span>
            <h2 id={`${id}-title`}>{t(item.name_en, item.name_ar)}</h2>
          </div>
          <button ref={closeButton} type="button" className={styles.close} onClick={() => setCustomizing(false)} aria-label={t('Close', 'سكّر')}><X /></button>
        </header>
        {Boolean(item.variants?.length) && <fieldset className={styles.sizes}><legend>{t('Choose a size', 'اختار الحجم')}</legend>{item.variants?.map((variant, index) => <label key={variant.id ?? index}><input type="radio" name={`${id}-size`} checked={selectedVariantIndex === index} onChange={() => setSelectedVariantIndex(index)} /><span>{variant.name_en}</span><b dir="ltr">{formatPrice(variant.price, variant.price_secondary)}</b></label>)}</fieldset>}
        {extras.length > 0 && <div className={styles.extraList}>
          <p>{t('Choose any extras you want', 'اختار الإضافات اللي بدّك ياها')}</p>
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
                <b dir="ltr">+ {formatPrice(extra.price, extra.price_secondary)}</b>
              </button>
            )
          })}
        </div>}
        <div className={styles.note}>
          <label htmlFor={`${id}-note`}>{t('Any changes? (optional)', 'بدّك تعدّل شي؟ (اختياري)')}</label>
          <textarea id={`${id}-note`} value={note} onChange={event => setNote(event.target.value)} maxLength={MAX_ITEM_NOTE_LENGTH} rows={2} placeholder={t('No pickles, cut in half…', 'بلا كبيس، قطّعلي ياها…')} aria-describedby={`${id}-hint`} />
          <small id={`${id}-hint`}>{extras.length ? t('For this item only. Choose paid extras above; requests are subject to restaurant confirmation.', 'هالملاحظة لهالصنف بس. الإضافات اللي عليها سعر اختارها من الخيارات. المطعم بيأكّدلك إذا فيو يلبّي طلبك.') : t('For this item only. The restaurant will confirm whether your request is possible.', 'هالملاحظة لهالصنف بس. المطعم بيأكّدلك إذا فيو يلبّي طلبك.')}</small>
        </div>
        <button
          type="button"
          className={styles.addCustomized}
          disabled={customizedQuantity >= MAX_QUANTITY}
          onClick={() => {
            ordering.add(item.id, selectedVariantIndex, selectedExtraIds, note)
            setCustomizing(false)
          }}
        >
          <span>{t('Add to order', 'ضيف عالطلب')}</span>
          <b dir="ltr">{formatPrice(roundUsd(customizedPrice), customizedSecondary)}</b>
        </button>
        {customizedQuantity >= MAX_QUANTITY && <p role="status">{t('Maximum 99 per item configuration. Adjust the quantity in your order.', 'الحدّ ٩٩ نسخة بنفس الخيارات. فيك تعدّل الكمية من طلبك.')}</p>}
      </section>
    </dialog>,
    document.body,
  )

  if (!repeatLine) {
    return (
      <>
        <span className={`${styles.root} ${quantity > 0 ? styles.rootActive : ''} ${className}`}>
          {quantity > 0 && <span className={styles.count} aria-label={t(`${quantity} in order`, `${quantity} بالطلب`)}>{quantity}</span>}
          <button
            type="button"
            className={styles.button}
            onClick={openCustomizer}
            aria-label={t(`Customize and add ${item.name_en}`, `ظبّط وضيف ${item.name_ar}`)}
            title={t('Customize your item', 'ظبّط طلبك عذوقك')}
          >
            <Plus />
          </button>
        </span>
        {customizationSheet}
      </>
    )
  }

  return (
    <>
    <span className={`${styles.controls} ${className}`}>
    <span className={`${styles.root} ${styles.rootActive}`}>
      <button
        type="button"
        className={styles.button}
        onClick={() => ordering.setQuantity(item.id, variantIndex, repeatLine.quantity - 1, repeatLine.extraIds, repeatLine.note)}
        aria-label={quantity === 1
          ? t(`Remove ${item.name_en} from order`, `شيل ${item.name_ar} من الطلب`)
          : t(`One less ${item.name_en}`, `نقص ${item.name_ar}`)}
      >
        {quantity === 1 ? <Trash2 /> : <Minus />}
      </button>
      <span className={styles.count} aria-label={t(`${quantity} in order`, `${quantity} بالطلب`)}>{quantity}</span>
      <button
        type="button"
        className={styles.button}
        onClick={() => ordering.add(item.id, variantIndex, repeatLine.extraIds, repeatLine.note)}
        disabled={repeatLine.quantity >= MAX_QUANTITY}
        aria-label={t(`One more ${item.name_en}`, `زيد ${item.name_ar}`)}
      >
        <Plus />
      </button>
    </span>
    <button type="button" className={`${styles.button} ${styles.customizeAnother}`} onClick={openCustomizer} aria-label={t(`Add ${item.name_en} with different instructions`, `ضيف ${item.name_ar} بملاحظة أو خيارات غير`)} title={t('Add with different instructions', 'ضيف نسخة بخيارات غير')}><SlidersHorizontal /></button>
    </span>
    {customizationSheet}
    </>
  )
}
