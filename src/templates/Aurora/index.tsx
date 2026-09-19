import { Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useReveal } from '../useReveal'
import styles from './Aurora.module.css'

function AuroraCard({ item, index, t, formatPrice }: {
  item: MenuItem
  index: number
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
}) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  const description = t(item.description_en ?? '', item.description_ar ?? '')

  return (
    <article
      className={`${styles.card} ${item.available ? '' : styles.cardSoldOut}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      {item.image_url && (
        <div className={styles.imageWrap}>
          <img className={styles.image} src={item.image_url} alt="" loading="lazy" />
          <span className={styles.priceBadge}>{formatPrice(price)}</span>
        </div>
      )}
      <div className={styles.cardBody}>
        <h3 className={styles.itemName}>{t(item.name_en, item.name_ar)}</h3>
        {description && <p className={styles.desc}>{description}</p>}
        {/* Without a photo there is no badge, so the price needs an inline home. */}
        {!item.image_url && <span className={styles.inlinePrice}>{formatPrice(price)}</span>}
        {!item.available && <span className={styles.soldOutLabel}>{t('Currently unavailable', 'غير متوفر حالياً')}</span>}
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
    </article>
  )
}

export default function AuroraTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props
  const [gridRef, gridShown] = useReveal<HTMLDivElement>()

  const activeCategoryEntry = categories.find((category) => category.id === activeCategory)
  const instagramHandle = restaurant.instagram?.replace(/^@/, '')

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--aurora-brand': theme.brand,
        '--aurora-ink': theme.brandInk,
        '--aurora-strong': theme.brandStrong,
        '--aurora-tint': theme.brandTint,
        '--aurora-glow': theme.alpha(0.32),
        '--aurora-bg': theme.brandTint,
        '--aurora-bar': theme.alpha(0.06),
        '--aurora-a': theme.alpha(0.42),
        '--aurora-b': `${theme.accent}66`,
        '--aurora-c': theme.alpha(0.26),
      } as React.CSSProperties}
    >
      <div className={styles.mesh} aria-hidden="true" />

      <div className={styles.content}>
        <header className={styles.cover}>
          <div className={styles.toolbar}>
            <span className={styles.powered}>Powered by <b>fluxiva</b></span>
            <div className={styles.langToggle}>
              <button className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
              <button className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
            </div>
          </div>

          <div className={styles.identity}>
            {restaurant.logo_url
              ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
              : <div className={styles.monogram}>{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
            <h1 className={styles.name}>{t(restaurant.name_en, restaurant.name_ar)}</h1>
            <p className={styles.tagline}>
              {t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}
            </p>
          </div>
        </header>

        <nav className={styles.categoryBar} data-menu-bar>
          <div className={styles.categoryScroll}>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`${styles.categoryButton} ${activeCategory === category.id ? styles.categoryActive : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {t(category.name_en, category.name_ar)}
              </button>
            ))}
          </div>
        </nav>

        <div className={styles.body}>
          {restaurant.temporarily_closed && (
            <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
          )}

          <h2 className={styles.sectionTitle}>
            {t(activeCategoryEntry?.name_en ?? 'Menu', activeCategoryEntry?.name_ar ?? 'القائمة')}
          </h2>

          <div className={styles.grid} ref={gridRef} data-shown={gridShown} key={activeCategory}>
            {visibleItems.map((item, index) => (
              <AuroraCard key={item.id} item={item} index={index} t={t} formatPrice={formatPrice} />
            ))}
          </div>
          {!visibleItems.length && <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
        </div>

        <footer className={styles.footer}>
          <div className={styles.contacts}>
            {restaurant.whatsapp && (
              <a className={styles.contact} href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle /> {t('Message us', 'راسلنا')}
              </a>
            )}
            {(restaurant.address_en || restaurant.address_ar) && (
              <span className={styles.contact}>
                <MapPin /> {t(restaurant.address_en ?? '', restaurant.address_ar ?? '')}
              </span>
            )}
            {restaurant.instagram && (
              <a className={styles.contact} href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer">
                <Instagram /> {restaurant.instagram}
              </a>
            )}
          </div>
          <div className={styles.footerBottom}>
            <span>{t('Made for good food.', 'صحة وهنا')}</span>
            <span>Menu by <b>fluxiva</b></span>
          </div>
        </footer>
      </div>
    </main>
  )
}
