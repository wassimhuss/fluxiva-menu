import { Instagram, MapPin, MessageCircle, Utensils } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicMenu } from '../lib/api'
import { formatLbp, localText } from '../lib/format'
import type { Language, MenuItem, RestaurantMenu } from '../lib/types'

function MenuCard({ item, language, color }: { item: MenuItem; language: Language; color: string }) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  return (
    <article className={`public-item ${item.available ? '' : 'sold-out'}`}>
      {item.image_url && <img src={item.image_url} alt="" />}
      <div className="public-item-content">
        <div className="item-heading"><h3>{localText(language, item.name_en, item.name_ar)}</h3><strong style={{ color }}>{formatLbp(price)}</strong></div>
        {(item.description_en || item.description_ar) && <p>{localText(language, item.description_en ?? '', item.description_ar ?? '')}</p>}
        {!item.available && <span className="sold-out-label">{language === 'ar' ? 'غير متوفر حالياً' : 'Currently unavailable'}</span>}
        {item.available && item.variants?.length > 0 && <div className="variant-buttons">{item.variants.map((choice, index) => <button key={choice.id ?? index} className={index === variantIndex ? 'selected' : ''} style={index === variantIndex ? { backgroundColor: color, borderColor: color } : undefined} onClick={() => setVariantIndex(index)}>{localText(language, choice.name_en, choice.name_ar)}</button>)}</div>}
      </div>
    </article>
  )
}

function MenuLoadingState({ slug }: { slug: string }) {
  const isDemo = slug === 'demo'
  return (
    <main className="public-menu-loading" aria-busy="true" aria-live="polite">
      <div className="public-menu-loading-orbit public-menu-loading-orbit-one" />
      <div className="public-menu-loading-orbit public-menu-loading-orbit-two" />
      <div className="public-menu-loading-card">
        <div className="public-menu-loading-mark">
          {isDemo ? <img src="/hilal-oven-logo.png" alt="" /> : <div className="public-menu-loading-monogram"><Utensils size={25} /></div>}
        </div>
        <span className="public-menu-loading-kicker">FLUXIVA MENU</span>
        <h1>{isDemo ? 'Hilal Oven' : 'Preparing your menu'}</h1>
        <p>{isDemo ? 'Opening today’s menu' : 'Opening menu'}</p>
        <div className="public-menu-loading-progress" aria-hidden="true"><span /></div>
        <span className="public-menu-loading-arabic">جاري فتح القائمة</span>
      </div>
    </main>
  )
}

export function PublicMenuPage() {
  const { slug = '' } = useParams()
  const [menu, setMenu] = useState<RestaurantMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [activeCategory, setActiveCategory] = useState('')

  useEffect(() => {
    getPublicMenu(slug).then((data) => {
      setMenu(data)
      if (data) { setLanguage(data.restaurant.default_language); setActiveCategory(data.categories[0]?.id ?? '') }
    }).catch(() => setError('This menu could not be loaded.')).finally(() => setLoading(false))
  }, [slug])

  const visibleItems = useMemo(() => menu?.items.filter((item) => {
    const matchesCategory = !activeCategory || item.category_id === activeCategory
    return matchesCategory
  }) ?? [], [menu, activeCategory])

  if (loading) return <MenuLoadingState slug={slug} />
  if (error || !menu) return <main className="public-menu-state"><Utensils size={34} /><h1>Menu unavailable</h1><p>{error || 'This restaurant menu is not currently available.'}</p></main>

  const { restaurant, categories } = menu
  const rtl = language === 'ar'
  const coverImage = restaurant.slug === 'demo' ? "url('/hilal-oven-cover.jpg')" : 'none'
  return (
    <main className="public-menu" dir={rtl ? 'rtl' : 'ltr'} style={{ '--restaurant-color': restaurant.primary_color, '--cover-image': coverImage } as React.CSSProperties}>
      <header className="menu-cover">
        <div className="menu-cover-pattern" />
        <div className="menu-toolbar"><span className="powered">Powered by <b>fluxiva</b></span><div className="language-toggle"><button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')}>EN</button><button className={language === 'ar' ? 'selected' : ''} onClick={() => setLanguage('ar')}>ع</button></div></div>
        <div className="restaurant-identity">
          {restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <div className="restaurant-monogram">{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
          <h1>{localText(language, restaurant.name_en, restaurant.name_ar)}</h1>
          <p>{localText(language, restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}</p>
        </div>
      </header>

      <div className="menu-body">
        {restaurant.temporarily_closed && <div className="closed-banner">{language === 'ar' ? 'المطعم مغلق مؤقتاً' : 'The restaurant is temporarily closed'}</div>}
        <nav className="category-tabs">{categories.map((category) => <button key={category.id} className={activeCategory === category.id ? 'selected' : ''} onClick={() => setActiveCategory(category.id)}>{localText(language, category.name_en, category.name_ar)}</button>)}</nav>
        <section className="items-section">
          <div className="section-title"><span /><h2>{localText(language, categories.find((category) => category.id === activeCategory)?.name_en ?? 'Menu', categories.find((category) => category.id === activeCategory)?.name_ar ?? 'القائمة')}</h2><span /></div>
          <div className="public-items">{visibleItems.map((item) => <MenuCard key={item.id} item={item} language={language} color={restaurant.primary_color} />)}</div>
          {!visibleItems.length && <p className="empty-items">{rtl ? 'لا توجد أصناف هنا.' : 'No items found here.'}</p>}
        </section>
      </div>
      <footer className="menu-footer"><div className="footer-shell">
        <div className="footer-intro"><span className="footer-kicker">{language === 'ar' ? 'تواصل معنا' : 'Stay connected'}</span><h2>{localText(language, restaurant.name_en, restaurant.name_ar)}</h2><p>{language === 'ar' ? 'نحن بانتظاركم كل يوم' : 'Fresh from our oven, every day.'}</p></div>
        <div className="footer-contact-grid">
          {restaurant.whatsapp && <a className="footer-contact-item footer-contact-item-accent" href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><span className="footer-contact-icon"><MessageCircle /></span><span className="footer-contact-copy"><small>WhatsApp</small><strong>{language === 'ar' ? 'راسلنا الآن' : 'Message us'}</strong></span></a>}
          {(restaurant.address_en || restaurant.address_ar) && <div className="footer-contact-item footer-contact-item-wide"><span className="footer-contact-icon"><MapPin /></span><span className="footer-contact-copy"><small>{language === 'ar' ? 'زورونا' : 'Visit us'}</small><strong>{localText(language, restaurant.address_en ?? '', restaurant.address_ar ?? '')}</strong></span></div>}
          {restaurant.instagram && <span className="footer-contact-item"><span className="footer-contact-icon"><Instagram /></span><span className="footer-contact-copy"><small>{language === 'ar' ? 'تابعونا' : 'Follow us'}</small><strong>{restaurant.instagram}</strong></span></span>}
        </div>
        <div className="footer-bottom"><span>{language === 'ar' ? 'صحة وهنا' : 'Made for good food.'}</span><span>Menu by <b>fluxiva</b></span></div>
      </div></footer>
    </main>
  )
}
