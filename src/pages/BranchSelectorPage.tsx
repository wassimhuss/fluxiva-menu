import { ArrowRight, Languages, MapPin, Store } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading } from '../components/Status'
import { getPublicBrand } from '../lib/api'
import { localText } from '../lib/format'
import type { BrandPlaces, Language } from '../lib/types'

export function BranchSelectorPage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<BrandPlaces | null>(null)
  const [language, setLanguage] = useState<Language>('en')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getPublicBrand(slug).then((result) => {
      setData(result)
      if (result) setLanguage(result.brand.default_language)
    }).catch(() => setError('This branch list could not be loaded.')).finally(() => setLoading(false))
  }, [slug])

  if (loading) return <main className="branch-selector-loading"><Loading /></main>

  const arabic = language === 'ar'
  const t = (english: string, arabicText: string) => localText(language, english, arabicText)

  if (!data || error) {
    return <main className="branch-selector-empty" dir={arabic ? 'rtl' : 'ltr'}><Store /><h1>{t('Branches unavailable', 'الفروع غير متاحة')}</h1><p>{error || t('This restaurant could not be found.', 'لم نتمكن من العثور على هذا المطعم.')}</p></main>
  }

  const { brand, restaurants } = data
  const style = { '--branch-color': brand.primary_color } as CSSProperties

  return (
    <main className="branch-selector-page" dir={arabic ? 'rtl' : 'ltr'} lang={language} style={style}>
      <header className="branch-selector-header">
        <span className="branch-selector-brand"><span className="branch-selector-logo" style={{ backgroundColor: brand.primary_color }}>{brand.logo_url ? <img src={brand.logo_url} alt="" /> : brand.name_en.slice(0, 2).toUpperCase()}</span><b>{localText(language, brand.name_en, brand.name_ar)}</b></span>
        <button type="button" className="branch-selector-language" onClick={() => setLanguage(arabic ? 'en' : 'ar')}><Languages /> {arabic ? 'EN' : 'عربي'}</button>
      </header>
      <section className="branch-selector-intro">
        <span className="eyebrow"><span /> {t('CHOOSE YOUR BRANCH', 'اختر الفرع')}</span>
        <h1>{localText(language, brand.name_en, brand.name_ar)}</h1>
        <p>{t('Select the location you are visiting to open its menu.', 'اختر المكان الذي تزوره لفتح قائمته.')}</p>
      </section>
      <section className="branch-selector-list" aria-label={t('Restaurant branches', 'فروع المطعم')}>
        {restaurants.map((restaurant) => (
          <Link key={restaurant.id} to={`/m/${restaurant.slug}`} className={`branch-selector-card${restaurant.temporarily_closed ? ' closed' : ''}`}>
            <span className="branch-selector-pin"><MapPin /></span>
            <span className="branch-selector-copy">
              <b>{localText(language, restaurant.name_en, restaurant.name_ar)}</b>
              <small>{localText(language, restaurant.address_en || 'Address available in the menu', restaurant.address_ar || 'العنوان متاح في القائمة')}</small>
              {restaurant.temporarily_closed && <em>{t('Temporarily closed', 'مغلق مؤقتًا')}</em>}
            </span>
            <span className="branch-selector-action">{t('Open menu', 'فتح القائمة')} <ArrowRight /></span>
          </Link>
        ))}
        {!restaurants.length && <div className="branch-selector-no-places"><Store /><b>{t('No branches are available right now.', 'لا توجد فروع متاحة حاليًا.')}</b></div>}
      </section>
      <footer>FLUXIVA MENU</footer>
    </main>
  )
}
