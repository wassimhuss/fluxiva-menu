import { Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useReveal } from '../useReveal'
import styles from './Maison.module.css'

function MaisonItem({ item, index, t, formatPrice }: {
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
      className={`${styles.item} ${item.image_url ? styles.itemWithImage : ''} ${item.available ? '' : styles.itemSoldOut}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className={styles.itemCode}>M{String(index + 1).padStart(2, '0')}</div>
      {item.image_url && <img className={styles.itemImage} src={item.image_url} alt="" loading="lazy" />}
      <div className={styles.itemContent}>
        <div className={styles.itemHeading}>
          <h3>{t(item.name_en, item.name_ar)}</h3>
          <span className={styles.leader} aria-hidden="true" />
          <strong>{formatPrice(price)}</strong>
        </div>
        {description && <p>{description}</p>}
        {!item.available && <span className={styles.soldOut}>{t('Currently unavailable', 'غير متوفر حالياً')}</span>}
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

export default function MaisonTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props
  const [listRef, listShown] = useReveal<HTMLDivElement>()
  const activeCategoryIndex = Math.max(0, categories.findIndex((category) => category.id === activeCategory))
  const activeCategoryEntry = categories[activeCategoryIndex]
  const instagramHandle = restaurant.instagram?.replace(/^@/, '')

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--maison-brand': theme.brand,
        '--maison-brand-ink': theme.brandInk,
        '--maison-strong': theme.brandStrong,
        '--maison-tint': theme.brandTint,
        '--maison-accent': theme.accent,
        '--maison-alpha': theme.alpha(0.16),
      } as React.CSSProperties}
    >
      <header className={styles.masthead}>
        <div className={styles.decorCircle} aria-hidden="true" />
        <div className={styles.topbar}>
          <span className={styles.edition}>FLUXIVA MENU <i /> EDITION 01</span>
          <div className={styles.langToggle}>
            <button className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
            <button className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
          </div>
        </div>

        <div className={styles.identity}>
          <div className={styles.identityMark}>
            <span>{restaurant.name_en.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className={styles.identityCopy}>
            <span className={styles.kicker}>{t('The house menu', 'قائمة المطعم')}</span>
            <h1>{t(restaurant.name_en, restaurant.name_ar)}</h1>
            <p>{t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}</p>
          </div>
          <div className={styles.menuStamp}>
            <small>{t('Menu', 'القائمة')}</small>
            <strong>{categories.length}</strong>
            <span>{t('sections', 'أقسام')}</span>
          </div>
        </div>
      </header>

      <nav className={styles.categoryBar} data-menu-bar>
        <div className={styles.categoryScroll}>
          {categories.map((category, index) => (
            <button
              key={category.id}
              className={`${styles.categoryButton} ${activeCategory === category.id ? styles.categoryActive : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {t(category.name_en, category.name_ar)}
            </button>
          ))}
        </div>
      </nav>

      <div className={styles.body}>
        {restaurant.temporarily_closed && (
          <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
        )}

        <section className={styles.sectionIntro}>
          <span className={styles.categoryNumber}>{String(activeCategoryIndex + 1).padStart(2, '0')}</span>
          <div>
            <span className={styles.sectionEyebrow}>{t('Explore the menu', 'استكشف القائمة')}</span>
            <h2>{t(activeCategoryEntry?.name_en ?? 'Menu', activeCategoryEntry?.name_ar ?? 'القائمة')}</h2>
          </div>
          <p>{visibleItems.length} {t(visibleItems.length === 1 ? 'selection' : 'selections', 'خيارات')}</p>
        </section>

        <div className={styles.list} ref={listRef} data-shown={listShown} key={activeCategory}>
          {visibleItems.map((item, index) => (
            <MaisonItem key={item.id} item={item} index={index} t={t} formatPrice={formatPrice} />
          ))}
        </div>
        {!visibleItems.length && <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span>{restaurant.name_en.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{t(restaurant.name_en, restaurant.name_ar)}</strong>
              <small>{t('Made for good food.', 'صحة وهنا')}</small>
            </div>
          </div>
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
        </div>
        <div className={styles.footerBottom}>Menu by <b>fluxiva</b></div>
      </footer>
    </main>
  )
}
