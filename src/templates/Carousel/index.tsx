import { ChevronLeft, ChevronRight, Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { Category, MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useActiveSlide } from '../useActiveSlide'
import styles from './Carousel.module.css'

function DeckCard({ item, index, active, category, t, formatPrice, whatsapp }: {
  item: MenuItem
  index: number
  active: boolean
  category?: Category
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
  whatsapp?: string
}) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  const name = t(item.name_en, item.name_ar)
  const description = t(item.description_en ?? '', item.description_ar ?? '')

  return (
    <article
      className={`${styles.card} ${item.available ? '' : styles.cardSoldOut}`}
      data-slide={index}
      data-active={active}
    >
      <div className={styles.media}>
        {item.image_url
          ? <img className={styles.image} src={item.image_url} alt="" loading={index < 2 ? 'eager' : 'lazy'} />
          : <div className={styles.mediaEmpty}>{name.slice(0, 2).toUpperCase()}</div>}
        {category && <span className={styles.badge}>{t(category.name_en, category.name_ar)}</span>}
        {!item.available && <span className={styles.soldOutTag}>{t('Sold out', 'نفد')}</span>}
      </div>

      <div className={styles.body}>
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

        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(price)}</span>
          {item.available && whatsapp && (
            <a className={styles.order} href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(name)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> {t('Ask', 'اسأل')}
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

export default function CarouselTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props
  const [trackRef, active] = useActiveSlide<HTMLDivElement>(visibleItems.length)

  const activeCategoryEntry = categories.find((category) => category.id === activeCategory)
  const instagramHandle = restaurant.instagram?.replace(/^@/, '')
  const address = t(restaurant.address_en ?? '', restaurant.address_ar ?? '')

  // scrollIntoView resolves direction itself, so this stays correct in Arabic
  // without any RTL-specific scroll maths.
  const scrollToIndex = useCallback((index: number) => {
    const target = trackRef.current?.querySelector<HTMLElement>(`[data-slide="${index}"]`)
    target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [trackRef])

  const step = useCallback((delta: number) => {
    const next = Math.min(Math.max(active + delta, 0), visibleItems.length - 1)
    scrollToIndex(next)
  }, [active, visibleItems.length, scrollToIndex])

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--deck-brand': theme.brand,
        '--deck-ink': theme.brandInk,
        '--deck-strong': theme.brandStrong,
        '--deck-tint': theme.brandTint,
        '--deck-bg': theme.brandTint,
      } as React.CSSProperties}
    >
      <header className={styles.header}>
        <div className={styles.topRow}>
          <div className={styles.identity}>
            {restaurant.logo_url
              ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
              : <div className={styles.monogram}>{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
            <span className={styles.venue}>
              {t(restaurant.name_en, restaurant.name_ar)}
              <span className={styles.venueSub}>
                {t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}
              </span>
            </span>
          </div>
          <div className={styles.langToggle}>
            <button className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
            <button className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
          </div>
        </div>

        <div className={styles.chips}>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`${styles.chip} ${activeCategory === category.id ? styles.chipActive : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {t(category.name_en, category.name_ar)}
            </button>
          ))}
        </div>

        {restaurant.temporarily_closed && (
          <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
        )}
      </header>

      <div className={styles.stage}>
        {visibleItems.length > 1 && (
          <>
            <button
              className={`${styles.arrow} ${styles.arrowPrev}`}
              onClick={() => step(-1)}
              disabled={active === 0}
              aria-label={t('Previous dish', 'الصنف السابق')}
            >
              <ChevronLeft />
            </button>
            <button
              className={`${styles.arrow} ${styles.arrowNext}`}
              onClick={() => step(1)}
              disabled={active === visibleItems.length - 1}
              aria-label={t('Next dish', 'الصنف التالي')}
            >
              <ChevronRight />
            </button>
          </>
        )}

        {/* Remounting on category change returns the deck to the first card. */}
        <div className={styles.track} ref={trackRef} key={activeCategory}>
          {visibleItems.map((item, index) => (
            <DeckCard
              key={item.id}
              item={item}
              index={index}
              active={active === index}
              category={activeCategoryEntry}
              t={t}
              formatPrice={formatPrice}
              whatsapp={restaurant.whatsapp}
            />
          ))}
          {!visibleItems.length && <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
        </div>
      </div>

      <footer className={styles.footer}>
        {visibleItems.length > 1 && (
          <div className={styles.dots}>
            {visibleItems.map((item, index) => (
              <button
                key={item.id}
                className={`${styles.dot} ${active === index ? styles.dotActive : ''}`}
                onClick={() => scrollToIndex(index)}
                aria-label={t(item.name_en, item.name_ar)}
              />
            ))}
          </div>
        )}

        <div className={styles.contacts}>
          {restaurant.whatsapp && (
            <a className={styles.contact} href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              <MessageCircle /> {t('Message us', 'راسلنا')}
            </a>
          )}
          {address && (
            restaurant.maps_url
              ? <a className={styles.contact} href={restaurant.maps_url} target="_blank" rel="noreferrer"><MapPin /> {address}</a>
              : <span className={styles.contact}><MapPin /> {address}</span>
          )}
          {restaurant.instagram && (
            <a className={styles.contact} href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer">
              <Instagram /> {restaurant.instagram}
            </a>
          )}
        </div>
        <div className={styles.mark}>Menu by <b>fluxiva</b></div>
      </footer>
    </main>
  )
}
