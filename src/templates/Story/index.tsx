import { ChevronDown, Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import { useActiveSlide } from '../useActiveSlide'
import styles from './Story.module.css'

function Chapter({ item, index, active, t, formatPrice }: {
  item: MenuItem
  index: number
  active: boolean
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
}) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  const name = t(item.name_en, item.name_ar)
  const description = t(item.description_en ?? '', item.description_ar ?? '')

  return (
    <section className={styles.chapter} data-slide={index} data-active={active}>
      <div className={styles.chapterInner}>
        <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
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
            ? <span className={styles.price}>{formatPrice(price)}</span>
            : <span className={styles.soldOut}>{t('Unavailable', 'غير متوفر')}</span>}
        </div>
      </div>
    </section>
  )
}

export default function StoryTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice, coverUrl } = props
  // The chapters scroll with the page, so the observer watches the viewport.
  const [setChapters, active] = useActiveSlide<HTMLDivElement>(visibleItems.length, { viewportRoot: true })

  const instagramHandle = restaurant.instagram?.replace(/^@/, '')
  const address = t(restaurant.address_en ?? '', restaurant.address_ar ?? '')

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--story-accent': theme.accent,
        '--story-strong': theme.brandStrong,
        '--story-cover': coverUrl ? `url(${coverUrl})` : `linear-gradient(150deg, ${theme.brandStrong}, #0c0f0e)`,
      } as React.CSSProperties}
    >
      <header className={styles.intro}>
        <div className={styles.introImage} />
        <div className={styles.introScrim} />
        <div className={styles.toolbar}>
          <span className={styles.powered}>Powered by <b>fluxiva</b></span>
          <div className={styles.langToggle}>
            <button className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
            <button className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
          </div>
        </div>

        <div className={styles.introInner}>
          {restaurant.logo_url && <img className={styles.logo} src={restaurant.logo_url} alt="" />}
          <div className={styles.eyebrow}>{t('The menu', 'القائمة')}</div>
          <h1 className={styles.venue}>{t(restaurant.name_en, restaurant.name_ar)}</h1>
          <p className={styles.tagline}>
            {t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}
          </p>
        </div>

        <div className={styles.scrollCue}>
          <ChevronDown />
          {t('Scroll', 'مرّر')}
        </div>
      </header>

      <nav className={styles.categoryBar} data-menu-bar>
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
      </nav>

      {restaurant.temporarily_closed && (
        <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
      )}

      {visibleItems.length
        ? (
          <div className={styles.stage} key={activeCategory}>
            <div className={styles.mediaPane}>
              {visibleItems.map((item, index) => (
                <div key={item.id} className={styles.layer} data-active={active === index}>
                  {item.image_url
                    ? <img className={styles.layerImage} src={item.image_url} alt="" loading={index < 2 ? 'eager' : 'lazy'} />
                    : <div className={styles.layerEmpty}>{t(item.name_en, item.name_ar).slice(0, 2).toUpperCase()}</div>}
                  <div className={styles.mediaScrim} />
                </div>
              ))}
            </div>

            <div className={styles.chapters} ref={setChapters}>
              {visibleItems.map((item, index) => (
                <Chapter
                  key={item.id}
                  item={item}
                  index={index}
                  active={active === index}
                  t={t}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          </div>
        )
        : <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}

      <footer className={styles.footer}>
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
        <div className={styles.mark}>
          <span>{t('Made for good food.', 'صحة وهنا')}</span>
          <span>Menu by <b>fluxiva</b></span>
        </div>
      </footer>
    </main>
  )
}
