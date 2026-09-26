import { ShoppingBag, Utensils } from 'lucide-react'
import type { Language, Restaurant, ServiceMode } from '../lib/types'
import styles from './ServiceChoice.module.css'

interface Props {
  restaurant: Restaurant
  coverUrl: string
  language: Language
  setLanguage: (language: Language) => void
  rtl: boolean
  t: (english: string, arabic: string) => string
  brand: string
  brandInk: string
  glow: string
  onChoose: (mode: ServiceMode) => void
}

/**
 * The first thing a scan shows: eating here, or taking it away.
 *
 * Only reached when the restaurant actually takes takeaway orders — offering
 * a choice where one branch leads nowhere would be worse than no choice at
 * all, so PublicMenuPage sends everyone straight to the menu otherwise.
 *
 * The language toggle is here rather than only inside the menu because this is
 * now the first screen an Arabic-speaking diner meets.
 */
export function ServiceChoice({ restaurant, coverUrl, language, setLanguage, rtl, t, brand, brandInk, glow, onChoose }: Props) {
  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--choice-brand': brand,
        '--choice-ink': brandInk,
        '--choice-glow': glow,
        '--choice-cover': coverUrl ? `url(${coverUrl})` : 'none',
      } as React.CSSProperties}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.lang}>
        <button type="button" className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
        <button type="button" className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
      </div>

      <div className={styles.head}>
        {restaurant.logo_url
          ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
          : <div className={styles.monogram}>{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
        <h1 className={styles.venue}>{t(restaurant.name_en, restaurant.name_ar)}</h1>
        <p className={styles.prompt}>{t('How would you like your order?', 'كيف تحب أن تتناول طلبك؟')}</p>
      </div>

      <div className={styles.cards}>
        <button type="button" className={styles.card} onClick={() => onChoose('dine-in')}>
          <span className={styles.icon}><Utensils /></span>
          <span className={styles.cardTitle}>{t('Dine in', 'تناول هنا')}</span>
          <span className={styles.cardNote}>{t('Browse the menu and order with your waiter.', 'تصفّح القائمة واطلب من النادل.')}</span>
        </button>

        <button type="button" className={styles.card} onClick={() => onChoose('takeaway')}>
          <span className={styles.icon}><ShoppingBag /></span>
          <span className={styles.cardTitle}>{t('Takeaway', 'سفري')}</span>
          <span className={styles.cardNote}>{t('Build your order and send it on WhatsApp.', 'اختر أصنافك وأرسل الطلب عبر واتساب.')}</span>
        </button>
      </div>

      <span className={styles.mark}>Menu by <b>fluxiva</b></span>
    </main>
  )
}
