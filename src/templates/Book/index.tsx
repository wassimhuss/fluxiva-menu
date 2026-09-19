import { Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import styles from './Book.module.css'
import { useTurnGesture } from './useTurnGesture'

/** How many leaves either side of the open one keep their photograph mounted. */
const PHOTO_WINDOW = 2

function Leaf({ item, index, count, category, near, t, formatPrice }: {
  item: MenuItem
  index: number
  count: number
  category: string
  /** Near the open page, so the photograph is worth downloading. */
  near: boolean
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
}) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  const name = t(item.name_en, item.name_ar)
  const description = t(item.description_en ?? '', item.description_ar ?? '')
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <>
      <div className={styles.face}>
        <div className={styles.plate}>
          {near && item.image_url
            ? <img src={item.image_url} alt="" loading={index < 2 ? 'eager' : 'lazy'} />
            : <div className={styles.plateEmpty}>{initials}</div>}
        </div>

        <div className={styles.copy}>
          <div className={styles.body}>
            <div className={styles.kicker}>
              <span>{category}</span>
              <i />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>

            <h2 className={styles.name}>{name}</h2>
            {description && <p className={styles.desc}>{description}</p>}

            {item.available && item.variants?.length > 0 && (
              <div className={styles.variants}>
                {item.variants.map((choice, position) => (
                  <button
                    key={choice.id ?? position}
                    className={position === variantIndex ? styles.variantActive : ''}
                    onClick={() => setVariantIndex(position)}
                  >
                    {t(choice.name_en, choice.name_ar)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.priceRow}>
          {item.available
            ? <span className={styles.price}>{formatPrice(price)}</span>
            : <span className={styles.soldOut}>{t('Unavailable', 'غير متوفر')}</span>}
        </div>

        <div className={styles.folio}>{index + 1} / {count}</div>
      </div>

      <div className={`${styles.face} ${styles.back}`}>
        <span className={styles.backMark}>{initials}</span>
      </div>
    </>
  )
}

export default function BookTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const count = visibleItems.length
  const last = Math.max(count - 1, 0)

  /* The open page is stored with the category it belongs to and derived back
     out, so switching category opens at page one in the same render rather than
     showing the old page for one frame. */
  const [turned, setTurned] = useState({ category: activeCategory, page: 0 })
  const page = turned.category === activeCategory ? Math.min(turned.page, last) : 0
  const [opened, setOpened] = useState(false)

  const goTo = useCallback((next: number) => {
    setTurned({ category: activeCategory, page: Math.min(Math.max(next, 0), last) })
    setOpened(true)
  }, [activeCategory, last])

  const turn = useCallback((direction: 1 | -1) => {
    // Refuse at the covers rather than re-arming the gesture lock for a turn
    // that cannot happen.
    const next = page + direction
    if (next < 0 || next > last) return
    goTo(next)
  }, [goTo, page, last])

  useTurnGesture({ element: stage, onTurn: turn, rtl, enabled: count > 1 })

  const instagramHandle = restaurant.instagram?.replace(/^@/, '')
  const address = t(restaurant.address_en ?? '', restaurant.address_ar ?? '')
  const categoryName = t(
    categories.find((entry) => entry.id === activeCategory)?.name_en ?? '',
    categories.find((entry) => entry.id === activeCategory)?.name_ar ?? '',
  )

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--book-accent': theme.accent,
        '--book-tint': theme.brandTint,
        '--book-ink': '#191510',
        '--book-glow': theme.alpha(0.18),
      } as React.CSSProperties}
    >
      <div className={styles.table} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          {restaurant.logo_url
            ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
            : <div className={styles.monogram}>{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
          <span className={styles.venue}>
            <span className={styles.venueName}>{t(restaurant.name_en, restaurant.name_ar)}</span>
            <span className={styles.venueSub}>{t('The menu', 'القائمة')}</span>
          </span>
        </div>
        <div className={styles.langToggle}>
          <button className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
          <button className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
        </div>
      </header>

      <nav className={styles.chips} data-menu-bar>
        {categories.map((category) => (
          <button
            key={category.id}
            className={`${styles.chip} ${activeCategory === category.id ? styles.chipActive : ''}`}
            onClick={() => setActiveCategory(category.id)}
          >
            {t(category.name_en, category.name_ar)}
          </button>
        ))}
      </nav>

      {restaurant.temporarily_closed && (
        <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
      )}

      <div className={styles.stage} ref={setStage}>
        {count
          ? (
            <div className={styles.spread}>
              <div className={styles.spine} aria-hidden="true" />

              <aside className={styles.titlePage} aria-hidden="true">
                {restaurant.logo_url && <img className={styles.titleLogo} src={restaurant.logo_url} alt="" />}
                <span className={styles.titleMeta}>{categoryName}</span>
                <h2 className={styles.titleName}>{t(restaurant.name_en, restaurant.name_ar)}</h2>
                <div className={styles.titleRule} />
                <p className={styles.titleTagline}>
                  {t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}
                </p>
              </aside>

              <div className={styles.stack}>
                <div className={styles.foreEdge} aria-hidden="true" />
                {visibleItems.map((item, index) => (
                  <article
                    key={item.id}
                    className={styles.sheet}
                    data-turned={index < page}
                    /* Unturned leaves stack with the open one on top; turned
                       ones pile up in reading order on the other page. */
                    style={{ zIndex: index < page ? index : count - index }}
                    aria-hidden={index !== page}
                  >
                    <Leaf
                      item={item}
                      index={index}
                      count={count}
                      category={categoryName}
                      near={Math.abs(index - page) <= PHOTO_WINDOW}
                      t={t}
                      formatPrice={formatPrice}
                    />
                  </article>
                ))}
              </div>
            </div>
          )
          : <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
      </div>

      {count > 0 && (
        <>
          <div className={styles.controls}>
            <span className={styles.folioLive}>
              <b>{page + 1}</b> / {count}
              <span className={styles.rail}>
                <span
                  className={styles.railFill}
                  style={{ inlineSize: `${((page + 1) / count) * 100}%` }}
                />
              </span>
            </span>
          </div>
          <p className={`${styles.hint} ${opened || count < 2 ? styles.hintHidden : ''}`}>
            {/* Nothing to swipe on a laptop, and no button left to press, so the
                hint has to name the input the visitor actually has. */}
            <span className={styles.hintTouch}>{t('Swipe to turn the page', 'اسحب لتقليب الصفحة')}</span>
            <span className={styles.hintPointer}>{t('Scroll or use the arrow keys', 'مرّر أو استخدم مفاتيح الأسهم')}</span>
          </p>
        </>
      )}

      <footer className={styles.footer}>
        {restaurant.whatsapp && (
          <a className={styles.contact} href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label={t('Message us', 'راسلنا')}>
            <MessageCircle />
          </a>
        )}
        {address && restaurant.maps_url && (
          <a className={styles.contact} href={restaurant.maps_url} target="_blank" rel="noreferrer" aria-label={address}>
            <MapPin />
          </a>
        )}
        {restaurant.instagram && (
          <a className={styles.contact} href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer" aria-label={restaurant.instagram}>
            <Instagram />
          </a>
        )}
        <span className={styles.mark}>Menu by <b>fluxiva</b></span>
      </footer>
    </main>
  )
}
