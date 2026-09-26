import { Instagram, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { AddToOrder } from '../../components/AddToOrder'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'

// Classic keeps using the shared global stylesheet it was originally written
// against. New templates are scoped with CSS Modules instead.

function MenuCard({ item, t, formatPrice, color, unavailableLabel, ordering }: {
  item: MenuItem
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
  color: string
  unavailableLabel: string
  ordering?: MenuTemplateProps['ordering']
}) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  return (
    <article className={`public-item ${item.available ? '' : 'sold-out'}`}>
      {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
      <div className="public-item-content">
        <div className="item-heading">
          <h3>{t(item.name_en, item.name_ar)}</h3>
          <strong style={{ color }}>{formatPrice(price)}</strong>
        </div>
        {(item.description_en || item.description_ar) && <p>{t(item.description_en ?? '', item.description_ar ?? '')}</p>}
        {!item.available && <span className="sold-out-label">{unavailableLabel}</span>}
        {ordering && (
          <div className="menu-card-order" style={{ '--add-active-bg': color } as React.CSSProperties}>
            <AddToOrder item={item} variantIndex={variantIndex} ordering={ordering} t={t} />
          </div>
        )}
        {item.available && item.variants?.length > 0 && (
          <div className="variant-buttons">
            {item.variants.map((choice, index) => (
              <button
                key={choice.id ?? index}
                className={index === variantIndex ? 'selected' : ''}
                style={index === variantIndex ? { backgroundColor: color, borderColor: color } : undefined}
                onClick={() => setVariantIndex(index)}
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

export default function ClassicTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, visibleItems, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice, coverUrl, ordering } = props

  const activeCategoryEntry = categories.find((category) => category.id === activeCategory)
  const footerContactCount = [restaurant.whatsapp, restaurant.address_en || restaurant.address_ar, restaurant.instagram].filter(Boolean).length
  const instagramHandle = restaurant.instagram?.replace(/^@/, '')

  return (
    <main
      className="public-menu"
      dir={rtl ? 'rtl' : 'ltr'}
      style={{ '--restaurant-color': restaurant.primary_color, '--cover-image': coverUrl ? `url(${coverUrl})` : 'none' } as React.CSSProperties}
    >
      <header className="menu-cover">
        <div className="menu-cover-pattern" />
        <div className="menu-toolbar">
          <span className="powered">Powered by <b>fluxiva</b></span>
          <div className="language-toggle">
            <button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')}>EN</button>
            <button className={language === 'ar' ? 'selected' : ''} onClick={() => setLanguage('ar')}>ع</button>
          </div>
        </div>
        <div className="restaurant-identity">
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt="" />
            : <div className="restaurant-monogram">{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
          <h1>{t(restaurant.name_en, restaurant.name_ar)}</h1>
          <p>{t(restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}</p>
        </div>
      </header>

      <div className="menu-body">
        {restaurant.temporarily_closed && (
          <div className="closed-banner">{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
        )}
        <nav className="category-tabs" data-menu-bar>
          {categories.map((category) => (
            <button
              key={category.id}
              className={activeCategory === category.id ? 'selected' : ''}
              onClick={() => setActiveCategory(category.id)}
            >
              {t(category.name_en, category.name_ar)}
            </button>
          ))}
        </nav>
        <section className="items-section">
          <div className="section-title">
            <span />
            <h2>{t(activeCategoryEntry?.name_en ?? 'Menu', activeCategoryEntry?.name_ar ?? 'القائمة')}</h2>
            <span />
          </div>
          <div className="public-items">
            {visibleItems.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                t={t}
                formatPrice={formatPrice}
                color={restaurant.primary_color}
                unavailableLabel={t('Currently unavailable', 'غير متوفر حالياً')}
                ordering={ordering}
              />
            ))}
          </div>
          {!visibleItems.length && <p className="empty-items">{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
        </section>
      </div>

      <footer
        className="menu-footer"
        style={{
          '--footer-ink': theme.brandInk,
          '--footer-muted': theme.inkAlpha(0.7),
          '--footer-soft': theme.inkAlpha(0.11),
          '--footer-line': theme.inkAlpha(0.16),
        } as React.CSSProperties}
      >
        <div className="footer-shell">
          {footerContactCount > 0 && (
            <div className="footer-contact-grid" style={{ '--footer-contact-count': footerContactCount } as React.CSSProperties}>
              {restaurant.whatsapp && (
                <a className="footer-contact-item footer-contact-item-accent" href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <span className="footer-contact-icon"><MessageCircle /></span>
                  <span className="footer-contact-copy"><small>WhatsApp</small><strong>{t('Message us', 'راسلنا الآن')}</strong></span>
                </a>
              )}
              {(restaurant.address_en || restaurant.address_ar) && (
                <div className="footer-contact-item footer-contact-item-wide">
                  <span className="footer-contact-icon"><MapPin /></span>
                  <span className="footer-contact-copy"><small>{t('Visit us', 'زورونا')}</small><strong>{t(restaurant.address_en ?? '', restaurant.address_ar ?? '')}</strong></span>
                </div>
              )}
              {restaurant.instagram && (
                <a className="footer-contact-item" href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer">
                  <span className="footer-contact-icon"><Instagram /></span>
                  <span className="footer-contact-copy"><small>{t('Follow us', 'تابعونا')}</small><strong>{restaurant.instagram}</strong></span>
                </a>
              )}
            </div>
          )}
          <div className="footer-bottom">
            <span>{t('Made for good food.', 'صحة وهنا')}</span>
            <span>Menu by <b>fluxiva</b></span>
          </div>
        </div>
      </footer>
    </main>
  )
}
