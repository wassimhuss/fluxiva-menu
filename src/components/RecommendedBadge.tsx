import { Star } from 'lucide-react'
import type { MenuItem } from '../lib/types'
import styles from './RecommendedBadge.module.css'

export function RecommendedBadge({ item, t }: {
  item: MenuItem
  t: (english: string, arabic: string) => string
}) {
  if (!item.highlighted) return null
  return <span className={styles.badge}><Star size={12} fill="currentColor" aria-hidden="true" />{t('Recommended', 'مننصحك فيه')}</span>
}
