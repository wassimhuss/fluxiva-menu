import { PriceLabel } from '../../components/PriceLabel'
import { RecommendedBadge } from '../../components/RecommendedBadge'
import { ChevronUp, Instagram, MapPin } from 'lucide-react'
import { useState } from 'react'
import { AddToOrder } from '../../components/AddToOrder'
import { WhatsAppIcon } from '../../components/WhatsAppIcon'
import type { Category, MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useActiveSlide } from '../useActiveSlide'
import styles from './Reel.module.css'

function ReelSlide({ item, index, total, category, active, nearby, t, formatPrice, rtl, ordering }: {
  item: MenuItem
  index: number
  total: number
  category?: Category
  active: boolean
  nearby: boolean
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
  rtl: boolean
  ordering?: MenuTemplateProps['ordering']
}) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price ?? item.price
  const name = t(item.name_en, item.name_ar)
  const description = t(item.description_en ?? '', item.description_ar ?? '')

  return (
    <section className={styles.slide} data-slide={index} data-active={active}>
      {item.image_url
        ? <>
            <img
              className={styles.shotBackdrop}
              src={item.image_url}
              alt=""
              aria-hidden="true"
              loading={index < 2 || nearby ? 'eager' : 'lazy'}
              decoding="async"
            />
            <img
              className={styles.shot}
              src={item.image_url}
              alt=""
              // Warm the neighbouring dishes before a fast flick reaches them.
              loading={index < 2 || nearby ? 'eager' : 'lazy'}
              decoding="async"
            />
          </>
        : <div className={styles.shotEmpty}><span className={styles.shotEmptyMark}>{name.slice(0, 2).toUpperCase()}</span></div>}
      <div className={styles.scrim} />

      <div className={styles.info}>
        <span className={styles.counter}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        {category && <span className={styles.category}>{t(category.name_en, category.name_ar)}</span>}
        <h2 className={styles.name}>{name}</h2>
        <RecommendedBadge item={item} t={t} />
        {description && <p className={styles.desc}>{description}</p>}

        {item.available && item.variants?.length > 0 && (
          <div className={styles.variants}>
            {item.variants.map((choice, position) => (
              <button
                key={choice.id ?? position}
                className={position === variantIndex ? styles.variantActive : ''}
                onClick={() => setVariantIndex(position)}
              >
                {choice.name_en}
              </button>
            ))}
          </div>
        )}

        <div className={styles.priceRow}>
          {item.available
            ? <span className={`${styles.price} menu-dual-price`} dir="ltr"><PriceLabel text={formatPrice(price, (variant ?? item).price_secondary)} /></span>
            : <span className={styles.soldOut}>{t('Sold out', 'خلص هلّق')}</span>}
          {ordering && <AddToOrder item={item} variantIndex={variantIndex} ordering={ordering} t={t} formatPrice={formatPrice} rtl={rtl} className={styles.addToOrder} />}
        </div>
      </div>
    </section>
  )
}

export default function ReelTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice, ordering } = props
  // +1 for the closing restaurant card at the end of the reel.
  const slideCount = visibleItems.length + 1
  const [setReel, active] = useActiveSlide<HTMLDivElement>(slideCount)

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
        '--reel-glow': theme.alpha(0.42),
        '--reel-footer-surface': theme.isLight ? theme.brandTint : theme.brandStrong,
        '--reel-footer-line': theme.inkAlpha(0.22),
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
        <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مسكّر مؤقّتاً')}</div>
      )}

      {/* Remounting on category change resets the scroller to the first dish. */}
      <div className={styles.reel} ref={setReel} key={activeCategory} tabIndex={0} role="region" aria-label={t('Menu items', 'أصناف المنيو')}>
        {visibleItems.map((item, index) => (
          <ReelSlide
            key={item.id}
            item={item}
            index={index}
            total={visibleItems.length}
            category={activeCategoryEntry}
            active={active === index}
            nearby={Math.abs(active - index) <= 2}
            t={t}
            formatPrice={formatPrice}
            rtl={rtl}
            ordering={ordering}
          />
        ))}

        {!visibleItems.length && <div className={styles.empty}>{t('No items found here.', 'بعد ما في أصناف هون.')}</div>}

        <section className={styles.endSlide} data-slide={visibleItems.length}>
          <div className={styles.endInner}>
            {restaurant.logo_url && <img className={styles.endLogo} src={restaurant.logo_url} alt="" />}
            <h2 className={styles.endTitle}>{t(restaurant.name_en, restaurant.name_ar)}</h2>
            <p className={styles.endText}>
              {t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'منحضّرو طازة كرمالك.')}
            </p>
            <div className={styles.endContacts}>
              {restaurant.whatsapp && (
                <a className={styles.endContact} href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <WhatsAppIcon />
                  <span className={styles.endContactLabel}>{t('Message us', 'احكي معنا')}</span>
                </a>
              )}
              {address && (
                restaurant.maps_url
                  ? <a className={styles.endContact} href={restaurant.maps_url} target="_blank" rel="noreferrer"><MapPin /><bdi className={styles.endContactLabel}>{address}</bdi></a>
                  : <span className={styles.endContact}><MapPin /><bdi className={styles.endContactLabel}>{address}</bdi></span>
              )}
              {restaurant.instagram && (
                <a className={styles.endContact} href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer">
                  <Instagram />
                  <bdi className={styles.endContactLabel} dir="ltr">{restaurant.instagram}</bdi>
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
        {t('Swipe', 'اسحب')}
      </div>
    </main>
  )
}
