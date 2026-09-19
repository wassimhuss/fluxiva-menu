import { ChevronLeft, ChevronRight, Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { scrollToSlide } from '../scrollToSlide'
import type { MenuTemplateProps } from '../types'
import { useActiveSlide } from '../useActiveSlide'
import { useSnapLock } from '../useSnapLock'
import styles from './Carousel.module.css'
import { useDeckProgress } from './useDeckProgress'

/**
 * Colour wash behind the deck, taken from the centred dish.
 *
 * Keeps only the outgoing and incoming layer mounted: the blur is expensive to
 * rasterise, so holding one per menu item would cost real memory for images
 * nobody is looking at.
 */
function Ambient({ url }: { url?: string }) {
  const [layers, setLayers] = useState<{ id: number; url: string }[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    if (!url) return
    nextId.current += 1
    const id = nextId.current
    setLayers((current) => [...current, { id, url }].slice(-2))
  }, [url])

  return (
    <div className={styles.ambient} aria-hidden="true">
      {layers.map((layer) => (
        <div key={layer.id} className={styles.ambientLayer} style={{ backgroundImage: `url(${layer.url})` }} />
      ))}
    </div>
  )
}

export default function CarouselTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props

  const [setTrack, active, track] = useActiveSlide<HTMLDivElement>(visibleItems.length)
  // One card per gesture, matching the reel's feel sideways.
  useSnapLock({ container: track, axis: 'x', count: visibleItems.length, activeIndex: active, rtl })
  useDeckProgress(track, visibleItems.length)

  // Variant choice lives here rather than in the card, because the price and
  // the size buttons now sit in the caption below the deck.
  const [variants, setVariants] = useState<Record<string, number>>({})

  const activeItem = visibleItems[active]
  const activeVariantIndex = activeItem ? variants[activeItem.id] ?? 0 : 0
  const activeVariant = activeItem?.variants?.[activeVariantIndex]
  const activePrice = activeVariant?.price_lbp ?? activeItem?.price_lbp ?? 0
  const activeName = activeItem ? t(activeItem.name_en, activeItem.name_ar) : ''
  const activeDesc = activeItem ? t(activeItem.description_en ?? '', activeItem.description_ar ?? '') : ''

  const instagramHandle = restaurant.instagram?.replace(/^@/, '')
  const address = t(restaurant.address_en ?? '', restaurant.address_ar ?? '')

  const scrollToIndex = useCallback((index: number) => {
    if (track) scrollToSlide(track, index, 'x', 'smooth')
  }, [track])

  const step = useCallback((delta: number) => {
    scrollToIndex(Math.min(Math.max(active + delta, 0), visibleItems.length - 1))
  }, [active, visibleItems.length, scrollToIndex])

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--deck-brand': theme.brand,
        '--deck-ink': theme.brandInk,
        '--deck-strong': theme.brandStrong,
        '--deck-glow': theme.alpha(0.34),
      } as React.CSSProperties}
    >
      <Ambient url={activeItem?.image_url} />
      <div className={styles.vignette} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          {restaurant.logo_url
            ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
            : <div className={styles.monogram}>{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
          <span className={styles.venue}>
            {t(restaurant.name_en, restaurant.name_ar)}
            <span className={styles.venueSub}>{t('The menu', 'القائمة')}</span>
          </span>
        </div>
        <div className={styles.langToggle}>
          <button className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
          <button className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
        </div>
      </header>

      <nav className={styles.chips}>
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
        <div className={styles.track} ref={setTrack} key={activeCategory}>
          {visibleItems.map((item, index) => (
            <article
              key={item.id}
              className={`${styles.card} ${item.available ? '' : styles.cardSoldOut}`}
              data-slide={index}
              data-active={active === index}
            >
              {item.image_url
                ? <img className={styles.image} src={item.image_url} alt={t(item.name_en, item.name_ar)} loading={index < 2 ? 'eager' : 'lazy'} />
                : <div className={styles.imageEmpty}>{t(item.name_en, item.name_ar).slice(0, 2).toUpperCase()}</div>}
              <div className={styles.cardFade} />
              <div className={styles.sheen} />
              {!item.available && <span className={styles.soldOutTag}>{t('Sold out', 'نفد')}</span>}
            </article>
          ))}
          {!visibleItems.length && <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
        </div>
      </div>

      {activeItem && (
        // Keyed on the dish so the caption re-animates as the deck moves.
        <section className={styles.caption} key={activeItem.id}>
          <span className={styles.ghostIndex} aria-hidden="true">{String(active + 1).padStart(2, '0')}</span>
          <h2 className={styles.name}>{activeName}</h2>
          {activeDesc && <p className={styles.desc}>{activeDesc}</p>}

          {activeItem.available && activeItem.variants?.length > 0 && (
            <div className={styles.variants}>
              {activeItem.variants.map((choice, position) => (
                <button
                  key={choice.id ?? position}
                  className={position === activeVariantIndex ? styles.variantActive : ''}
                  onClick={() => setVariants((current) => ({ ...current, [activeItem.id]: position }))}
                >
                  {t(choice.name_en, choice.name_ar)}
                </button>
              ))}
            </div>
          )}

          <div className={styles.buy}>
            {activeItem.available
              ? <span className={styles.price}>{formatPrice(activePrice)}</span>
              : <span className={styles.unavailable}>{t('Currently unavailable', 'غير متوفر حالياً')}</span>}
          </div>
        </section>
      )}

      <footer className={styles.progress}>
        <span className={styles.counter}>
          <b>{String(Math.min(active + 1, visibleItems.length || 1)).padStart(2, '0')}</b> / {String(visibleItems.length).padStart(2, '0')}
        </span>
        <div className={styles.rail}>
          <span
            className={styles.railFill}
            style={{ '--progress': `${visibleItems.length ? ((active + 1) / visibleItems.length) * 100 : 0}%` } as React.CSSProperties}
          />
        </div>
        <div className={styles.contacts}>
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
        </div>
      </footer>
    </main>
  )
}
