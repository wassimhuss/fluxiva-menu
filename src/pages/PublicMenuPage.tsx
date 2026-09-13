import { Instagram, MapPin, Phone, Search, Utensils } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loading } from '../components/Status'
import { getPublicMenu } from '../lib/api'
import { formatLbp, localText } from '../lib/format'
import type { Language, MenuItem, RestaurantMenu } from '../lib/types'

function MenuCard({ item, language, color }: { item: MenuItem; language: Language; color: string }) {
  const [variantIndex, setVariantIndex] = useState(0)
  const variant = item.variants?.[variantIndex]
  const price = variant?.price_lbp ?? item.price_lbp
  return (
    <article className="public-item">
      {item.image_url && <img src={item.image_url} alt="" />}
      <div className="public-item-content">
        <div className="item-heading"><h3>{localText(language, item.name_en, item.name_ar)}</h3><strong style={{ color }}>{formatLbp(price)}</strong></div>
        {(item.description_en || item.description_ar) && <p>{localText(language, item.description_en ?? '', item.description_ar ?? '')}</p>}
        {item.variants?.length > 0 && <div className="variant-buttons">{item.variants.map((choice, index) => <button key={choice.id ?? index} className={index === variantIndex ? 'selected' : ''} style={index === variantIndex ? { backgroundColor: color, borderColor: color } : undefined} onClick={() => setVariantIndex(index)}>{localText(language, choice.name_en, choice.name_ar)}</button>)}</div>}
      </div>
    </article>
  )
}

export function PublicMenuPage() {
  const { slug = '' } = useParams()
  const [menu, setMenu] = useState<RestaurantMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPublicMenu(slug).then((data) => {
      setMenu(data)
      if (data) { setLanguage(data.restaurant.default_language); setActiveCategory(data.categories[0]?.id ?? '') }
    }).catch(() => setError('This menu could not be loaded.')).finally(() => setLoading(false))
  }, [slug])

  const visibleItems = useMemo(() => menu?.items.filter((item) => {
    const matchesCategory = !activeCategory || item.category_id === activeCategory
    const needle = search.toLowerCase()
    return matchesCategory && (!needle || item.name_en.toLowerCase().includes(needle) || item.name_ar.includes(search))
  }) ?? [], [menu, activeCategory, search])

  if (loading) return <main className="public-menu-state"><Loading label="Opening menu…" /></main>
  if (error || !menu) return <main className="public-menu-state"><Utensils size={34} /><h1>Menu unavailable</h1><p>{error || 'This restaurant menu is not currently available.'}</p></main>

  const { restaurant, categories } = menu
  const rtl = language === 'ar'
  return (
    <main className="public-menu" dir={rtl ? 'rtl' : 'ltr'} style={{ '--restaurant-color': restaurant.primary_color } as React.CSSProperties}>
      <header className="menu-cover">
        <div className="menu-cover-pattern" />
        <div className="menu-toolbar"><span className="powered">Powered by <b>fluxiva</b></span><div className="language-toggle"><button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')}>EN</button><button className={language === 'ar' ? 'selected' : ''} onClick={() => setLanguage('ar')}>ع</button></div></div>
        <div className="restaurant-identity">
          {restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <div className="restaurant-monogram">{restaurant.name_en.slice(0, 2).toUpperCase()}</div>}
          <h1>{localText(language, restaurant.name_en, restaurant.name_ar)}</h1>
          <p>{localText(language, restaurant.description_en ?? 'Freshly made for you.', restaurant.description_ar ?? 'نحضّره طازجاً من أجلك.')}</p>
          <div className="restaurant-links">
            {restaurant.phone && <a href={`tel:${restaurant.phone}`}><Phone />{restaurant.phone}</a>}
            {(restaurant.address_en || restaurant.address_ar) && <span><MapPin />{localText(language, restaurant.address_en ?? '', restaurant.address_ar ?? '')}</span>}
            {restaurant.instagram && <span><Instagram />{restaurant.instagram}</span>}
          </div>
        </div>
      </header>

      <div className="menu-body">
        <div className="menu-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={rtl ? 'ابحث في القائمة…' : 'Search the menu…'} /></div>
        <nav className="category-tabs">{categories.map((category) => <button key={category.id} className={activeCategory === category.id ? 'selected' : ''} onClick={() => setActiveCategory(category.id)}>{localText(language, category.name_en, category.name_ar)}</button>)}</nav>
        <section className="items-section">
          <div className="section-title"><span /><h2>{localText(language, categories.find((category) => category.id === activeCategory)?.name_en ?? 'Menu', categories.find((category) => category.id === activeCategory)?.name_ar ?? 'القائمة')}</h2><span /></div>
          <div className="public-items">{visibleItems.map((item) => <MenuCard key={item.id} item={item} language={language} color={restaurant.primary_color} />)}</div>
          {!visibleItems.length && <p className="empty-items">{rtl ? 'لا توجد أصناف هنا.' : 'No items found here.'}</p>}
        </section>
      </div>
      <footer className="menu-footer"><span>Menu by</span><b>fluxiva menu</b></footer>
    </main>
  )
}
