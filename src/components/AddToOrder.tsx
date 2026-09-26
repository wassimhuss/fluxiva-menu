import { Minus, Plus, Trash2 } from 'lucide-react'
import type { MenuItem } from '../lib/types'
import type { MenuOrdering } from '../templates/types'
import styles from './AddToOrder.module.css'

interface Props {
  item: MenuItem
  /** The size the diner currently has selected on this dish. */
  variantIndex: number
  ordering: MenuOrdering
  t: (english: string, arabic: string) => string
  className?: string
}

/**
 * Adds a dish to the takeaway order from inside the menu.
 *
 * Collapses to a single "+" until the dish is in the order, then becomes a
 * stepper — so a menu nobody is ordering from stays visually quiet, and the
 * row does not change height when it is.
 */
export function AddToOrder({ item, variantIndex, ordering, t, className = '' }: Props) {
  if (!item.available) return null

  const quantity = ordering.quantityOf(item.id, variantIndex)

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
