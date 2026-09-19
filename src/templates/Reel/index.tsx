import { ChevronUp, Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { Category, MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useActiveSlide } from '../useActiveSlide'
import { useSnapLock } from '../useSnapLock'
import styles from './Reel.module.css'

function ReelSlide({ item, index, total, category, active, t, formatPrice, whatsapp }: {
  item: MenuItem
  index: number
  total: number
  category?: Category
  active: boolean
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
    <section className={styles.slide} data-slide={index} data-active={active}>
      {item.image_url
        ? <img
            className={styles.shot}
            src={item.image_url}
            alt=""
            // The first screens are the whole first impression, so they load eagerly.
            loading={index < 2 ? 'eager' : 'lazy'}
          />
        : <div className={styles.shotEmpty}><span className={styles.shotEmptyMark}>{name.slice(0, 2).toUpperCase()}</span></div>}
      <div className={styles.scrim} />

      <div className={styles.info}>
        <span className={styles.counter}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        {category && <span className={styles.category}>{t(category.name_en, category.name_ar)}</span>}
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
          {item.available
            ? <>
                <span className={styles.price}>{formatPrice(price)}</span>
                {whatsapp && (
                  <a className={styles.order} href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(name)}`} target="_blank" rel="noreferrer">
                    <MessageCircle /> {t('Ask about this', 'اسأل عن هذا')}
                  </a>
                )}
              </>
            : <span className={styles.soldOut}>{t('Sold out', 'نفد')}</span>}
        </div>
      </div>
    </section>
  )
}

export default function ReelTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props
  // +1 for the closing restaurant card at the end of the reel.
  const slideCount = visibleItems.length + 1
  const [reelRef, active] = useActiveSlide<HTMLDivElement>(slideCount)
  // One dish per gesture, however hard the flick.
  useSnapLock({ containerRef: reelRef, axis: 'y', count: slideCount, activeIndex: active })

  const activeCategoryEntry = categories.find((category) => category.id === activeCategory)
  const instagramHandle = restaurant.instagram?.replace(/^@/, '')
  const address = t(restaurant.address_en ?? '', restaurant.address_ar ?? '')

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--reel-brand': theme.brand,
        '--reel-ink': theme.brandInk,
        '--reel-strong': theme.brandStrong,
        '--reel-accent': theme.accent,
        '--reel-glow': theme.alpha(0.42),
      } as React.CSSProperties}
    >
      <div className={styles.topBar}>
        <div className={styles.topRow}>
          <div className={styles.identity}>
            {restaurant.logo_url
              ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
              : <div className={styles.monogram}>{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
            <span className={styles.venue}>{t(restaurant.name_en, restaurant.name_ar)}</span>
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
      </div>

      {restaurant.temporarily_closed && (
        <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
      )}

      {/* Remounting on category change resets the scroller to the first dish. */}
      <div className={styles.reel} ref={reelRef} key={activeCategory}>
        {visibleItems.map((item, index) => (
          <ReelSlide
            key={item.id}
            item={item}
            index={index}
            total={visibleItems.length}
            category={activeCategoryEntry}
            active={active === index}
            t={t}
            formatPrice={formatPrice}
            whatsapp={restaurant.whatsapp}
          />
        ))}

        {!visibleItems.length && <div className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</div>}

        <section className={styles.endSlide} data-slide={visibleItems.length}>
          <div className={styles.endInner}>
            {restaurant.logo_url && <img className={styles.endLogo} src={restaurant.logo_url} alt="" />}
            <h2 className={styles.endTitle}>{t(restaurant.name_en, restaurant.name_ar)}</h2>
            <p className={styles.endText}>
              {t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}
            </p>
            <div className={styles.endContacts}>
              {restaurant.whatsapp && (
                <a className={styles.endContact} href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <MessageCircle /> {t('Message us', 'راسلنا')}
                </a>
              )}
              {address && (
                restaurant.maps_url
                  ? <a className={styles.endContact} href={restaurant.maps_url} target="_blank" rel="noreferrer"><MapPin /> {address}</a>
                  : <span className={styles.endContact}><MapPin /> {address}</span>
              )}
              {restaurant.instagram && (
                <a className={styles.endContact} href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer">
                  <Instagram /> {restaurant.instagram}
                </a>
              )}
            </div>
            <div className={styles.endMark}>Menu by <b>fluxiva</b></div>
          </div>
        </section>
      </div>

      <div className={styles.dots}>
        {visibleItems.map((item, index) => (
          <span key={item.id} className={`${styles.dot} ${active === index ? styles.dotActive : ''}`} />
        ))}
      </div>

      <div className={`${styles.hint} ${active > 0 ? styles.hintHidden : ''}`}>
        <ChevronUp />
        {t('Swipe', 'مرّر')}
      </div>
    </main>
  )
}
