import { Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useReveal } from '../useReveal'
import styles from './Noir.module.css'

function NoirItem({ item, index, t, formatPrice }: {
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
      className={`${styles.item} ${item.available ? '' : styles.itemSoldOut}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className={styles.priceLine}>
        {item.image_url && <img className={styles.thumb} src={item.image_url} alt="" loading="lazy" />}
        <h3 className={styles.itemName}>{t(item.name_en, item.name_ar)}</h3>
        <span className={styles.dots} aria-hidden="true" />
        <strong className={styles.price}>{formatPrice(price)}</strong>
      </div>
      {description && <p className={styles.desc}>{description}</p>}
      {!item.available && <span className={styles.soldOutLabel}>{t('Unavailable', 'غير متوفر')}</span>}
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
    </article>
  )
}

export default function NoirTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice, coverUrl } = props
  const [gridRef, gridShown] = useReveal<HTMLDivElement>()

  const activeCategoryEntry = categories.find((category) => category.id === activeCategory)
  const instagramHandle = restaurant.instagram?.replace(/^@/, '')

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--noir-accent': theme.accent,
        '--noir-brand': theme.brand,
        '--noir-cover': coverUrl ? `url(${coverUrl})` : `linear-gradient(150deg, ${theme.brandStrong}, #0a0c0b)`,
      } as React.CSSProperties}
    >
      <header className={styles.cover}>
        <div className={styles.coverImage} />
        <div className={styles.coverScrim} />
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
          <span className={styles.eyebrow}>{t('Menu', 'قائمة الطعام')}</span>
          <h1 className={styles.name}>{t(restaurant.name_en, restaurant.name_ar)}</h1>
          <div className={styles.rule} />
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
        <span className={styles.sectionCount}>
          {visibleItems.length} {t(visibleItems.length === 1 ? 'dish' : 'dishes', 'صنف')}
        </span>

        {/* Keyed on the category so the stagger replays when the diner switches. */}
        <div className={styles.grid} ref={gridRef} data-shown={gridShown} key={activeCategory}>
          {visibleItems.map((item, index) => (
            <NoirItem key={item.id} item={item} index={index} t={t} formatPrice={formatPrice} />
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
    </main>
  )
}
