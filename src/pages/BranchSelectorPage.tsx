import { ArrowRight, Languages, MapPin, Store } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MenuUnavailable } from '../components/MenuUnavailable'
import { subscriptionState } from '../lib/subscription'
import { useSubscriptionClock } from '../lib/useSubscriptionClock'
import { Loading } from '../components/Status'
import { getPublicBrand } from '../lib/api'
import { localText } from '../lib/format'
import type { BrandPlaces, Language } from '../lib/types'

export function BranchSelectorPage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<BrandPlaces | null>(null)
  const nearestEnd=data?.restaurants.map(r=>r.subscription_status==='trial'?r.trial_ends_at:r.subscription_ends_at).filter((value):value is string=>Boolean(value && Date.parse(value)>Date.now())).sort()[0]
  const subscriptionNow=useSubscriptionClock({subscription_status:'active',subscription_ends_at:nearestEnd})
  const livePlaces=data?.restaurants.filter(r=>subscriptionState(r,subscriptionNow).serving)??[]
  const [language, setLanguage] = useState<Language>('en')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [settledSlug, setSettledSlug] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true); setError(''); setData(null)
    getPublicBrand(slug, controller.signal).then((result) => {
      if (cancelled) return
      setData(result)
      if (result) setLanguage(result.brand.default_language)
    }).catch(() => { if (!cancelled) setError('This branch list could not be loaded.') })
      .finally(() => { if (!cancelled) { setSettledSlug(slug); setLoading(false) } })
    return () => { cancelled = true; controller.abort() }
  }, [slug, loadAttempt])

  useEffect(()=>{
    if(loading || settledSlug!==slug) return
    const controller=new AbortController()
    let busy=false
    const check=async()=>{
      if(busy) return
      busy=true
      try {const result=await getPublicBrand(slug,controller.signal);if(!controller.signal.aborted)setData(result)}
      catch { /* Preserve the last confirmed list; its expiry clock still runs. */ }
      finally {busy=false}
    }
    const timer=window.setInterval(()=>void check(),60000)
    window.addEventListener('focus',check)
    return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener('focus',check)}
  },[slug,loading,settledSlug])

  if (loading || settledSlug !== slug) return <main className="branch-selector-loading"><Loading /></main>

  const arabic = language === 'ar'
  const t = (english: string, arabicText: string) => localText(language, english, arabicText)

  if(!error && (!data || !livePlaces.length)) return <MenuUnavailable contact={null} onRetry={()=>setLoadAttempt(value=>value+1)} />
  if (!data || error) {
    return <main className="branch-selector-empty"><Store /><h1>{error ? 'Connection interrupted' : 'Branches unavailable'}</h1><p>{error || 'No branches are available right now.'}</p><p dir="rtl" lang="ar">{error ? 'ما قدرنا نتّصل. جرّب كمان مرّة.' : 'ما في فروع متاحة هلّق.'}</p>{error && <button className="button button-primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again / جرّب كمان مرّة</button>}</main>
  }

  const { brand } = data
  const restaurants=livePlaces
  const style = { '--branch-color': brand.primary_color } as CSSProperties

  return (
    <main className="branch-selector-page" dir={arabic ? 'rtl' : 'ltr'} lang={language} style={style}>
      <header className="branch-selector-header">
        <span className="branch-selector-brand"><span className="branch-selector-logo" style={{ backgroundColor: brand.primary_color }}>{brand.logo_url ? <img src={brand.logo_url} alt="" /> : brand.name_en.slice(0, 2).toUpperCase()}</span><b>{localText(language, brand.name_en, brand.name_ar)}</b></span>
        <button type="button" className="branch-selector-language" onClick={() => setLanguage(arabic ? 'en' : 'ar')}><Languages /> {arabic ? 'EN' : 'عربي'}</button>
      </header>
      <section className="branch-selector-intro">
        <span className="eyebrow"><span /> {t('CHOOSE YOUR BRANCH', 'اختار الفرع')}</span>
        <h1>{localText(language, brand.name_en, brand.name_ar)}</h1>
        <p>{t('Select the location you are visiting to open its menu.', 'اختار الفرع اللي رايح عليه لتفتح المنيو تبعو.')}</p>
      </section>
      <section className="branch-selector-list" aria-label={t('Restaurant branches', 'فروع المطعم')}>
        {restaurants.map((restaurant) => (
          <Link key={restaurant.id} to={`/m/${restaurant.slug}`} className={`branch-selector-card${restaurant.temporarily_closed ? ' closed' : ''}`}>
            <span className="branch-selector-pin"><MapPin /></span>
            <span className="branch-selector-copy">
              <b>{localText(language, restaurant.name_en, restaurant.name_ar)}</b>
              <small>{localText(language, restaurant.address_en || 'Address available in the menu', restaurant.address_ar || 'العنوان موجود بالمنيو')}</small>
              {restaurant.temporarily_closed && <em>{t('Temporarily closed', 'مغلق مؤقتًا')}</em>}
            </span>
            <span className="branch-selector-action">{t('Open menu', 'فتح المنيو')} <ArrowRight /></span>
          </Link>
        ))}
        {!restaurants.length && <div className="branch-selector-no-places"><Store /><b>{t('No branches are available right now.', 'ما في فروع متاحة هلّق.')}</b></div>}
      </section>
      <footer>FLUXIVA MENU</footer>
    </main>
  )
}
