import { Utensils } from 'lucide-react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MenuUnavailable } from '../components/MenuUnavailable'
import { TemplateSwitcher } from '../components/TemplateSwitcher'
import { getMenuContactCard, getPublicMenu } from '../lib/api'
import { formatLbp, localText } from '../lib/format'
import { deriveTheme } from '../lib/theme'
import { useImagePreload } from '../lib/useImagePreload'
import type { Language, MenuContactCard, RestaurantMenu } from '../lib/types'
import { resolveTemplateId, templateComponents } from '../templates/registry'

function MenuLoadingState({ slug }: { slug: string }) {
  const isDemo = slug === 'demo'
  return (
    <main className="public-menu-loading" aria-busy="true" aria-live="polite">
      <div className="public-menu-loading-orbit public-menu-loading-orbit-one" />
      <div className="public-menu-loading-orbit public-menu-loading-orbit-two" />
      <div className="public-menu-loading-card">
        <div className="public-menu-loading-mark">
          {isDemo
            ? <><span className="public-menu-loading-fallback">HILAL</span><img src="/hilal-oven-logo.png" alt="" /></>
            : <div className="public-menu-loading-monogram"><Utensils size={25} /></div>}
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

/**
 * Owns menu data, language and category state, then hands a finished view model
 * to whichever template is selected. Templates stay pure presentation so this
 * logic is written — and fixed — exactly once.
 */
export function PublicMenuPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [menu, setMenu] = useState<RestaurantMenu | null>(null)
  const [contact, setContact] = useState<MenuContactCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [activeCategory, setActiveCategory] = useState('')

  useEffect(() => {
    getPublicMenu(slug).then(async (data) => {
      setMenu(data)
      if (data) { setLanguage(data.restaurant.default_language); setActiveCategory(data.categories[0]?.id ?? '') }
      // No servable menu: fetch just enough to point the customer at a human.
      else setContact(await getMenuContactCard(slug))
    }).catch(() => setError('This menu could not be loaded.')).finally(() => setLoading(false))
  }, [slug])

  const visibleItems = useMemo(
    () => menu?.items.filter((item) => !activeCategory || item.category_id === activeCategory) ?? [],
    [menu, activeCategory],
  )

  const theme = useMemo(
    () => deriveTheme(menu?.restaurant.primary_color ?? '#173f35'),
    [menu?.restaurant.primary_color],
  )

  const t = useCallback((english: string, arabic: string) => localText(language, english, arabic), [language])

  const coverUrl = menu
    ? menu.restaurant.cover_image_url || (menu.restaurant.slug === 'demo' ? '/hilal-oven-cover.jpg' : '')
    : ''

  /**
   * The images that land on the first screen: branding, the cover, and the
   * opening items. Taken from the first category rather than the active one, so
   * that changing category later never drops the customer back to a loader.
   */
  const criticalImages = useMemo(() => {
    if (!menu) return []
    const firstCategory = menu.categories[0]?.id
    const opening = menu.items
      .filter((item) => item.category_id === firstCategory)
      .slice(0, 4)
      .map((item) => item.image_url)
    return [menu.restaurant.logo_url, coverUrl, ...opening]
  }, [menu, coverUrl])

  const imagesReady = useImagePreload(criticalImages)

  // The owner's saved design, unless a `?template=` override is present — which
  // is how the dashboard previews a design before it is saved.
  const templateId = resolveTemplateId(searchParams.get('template') ?? menu?.restaurant.template_id)

  // Each design is a different height and the window keeps its scroll position
  // across the swap, so switching while scrolled down would drop you into the
  // middle of the new menu. Instant rather than smooth: the stylesheet sets
  // `scroll-behavior: smooth` globally, which would otherwise animate the whole
  // way back up from deep in a long menu.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [templateId])

  const selectTemplate = useCallback((id: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('template', id)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  if (loading) return <MenuLoadingState slug={slug} />
  if (error || !menu) return <MenuUnavailable contact={contact} />
  // Hold the branded loader until the first screen can render complete.
  if (!imagesReady) return <MenuLoadingState slug={slug} />

  const { restaurant, categories, items } = menu
  const Template = templateComponents[templateId]

  // `?preview=1` is the dashboard's embedded preview, which supplies its own
  // picker and should not show a second one floating over the menu.
  const showSwitcher = (import.meta.env.DEV || slug === 'demo') && !searchParams.has('preview')

  return (
    <>
      <Suspense fallback={<MenuLoadingState slug={slug} />}>
        <Template
          restaurant={restaurant}
          categories={categories}
          items={items}
          visibleItems={visibleItems}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          language={language}
          setLanguage={setLanguage}
          rtl={language === 'ar'}
          theme={theme}
          t={t}
          formatPrice={formatLbp}
          coverUrl={coverUrl}
        />
      </Suspense>
      {showSwitcher && <TemplateSwitcher active={templateId} onSelect={selectTemplate} />}
    </>
  )
}
