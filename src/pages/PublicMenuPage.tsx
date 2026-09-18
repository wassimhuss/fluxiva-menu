import { Utensils } from 'lucide-react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TemplateSwitcher } from '../components/TemplateSwitcher'
import { getPublicMenu } from '../lib/api'
import { formatLbp, localText } from '../lib/format'
import { deriveTheme } from '../lib/theme'
import type { Language, RestaurantMenu } from '../lib/types'
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

  const visibleItems = useMemo(
    () => menu?.items.filter((item) => !activeCategory || item.category_id === activeCategory) ?? [],
    [menu, activeCategory],
  )

  const theme = useMemo(
    () => deriveTheme(menu?.restaurant.primary_color ?? '#173f35'),
    [menu?.restaurant.primary_color],
  )

  const t = useCallback((english: string, arabic: string) => localText(language, english, arabic), [language])

  // Until `template_id` lands on the restaurants table, the template is chosen
  // by query string so designs can be compared on a real menu.
  const templateId = resolveTemplateId(searchParams.get('template'))
  const Template = templateComponents[templateId]

  const selectTemplate = useCallback((id: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('template', id)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  if (loading) return <MenuLoadingState slug={slug} />
  if (error || !menu) {
    return (
      <main className="public-menu-state">
        <Utensils size={34} />
        <h1>Menu unavailable</h1>
        <p>{error || 'This restaurant menu is not currently available.'}</p>
      </main>
    )
  }

  const { restaurant, categories, items } = menu
  const coverUrl = restaurant.cover_image_url || (restaurant.slug === 'demo' ? '/hilal-oven-cover.jpg' : '')
  const showSwitcher = import.meta.env.DEV || slug === 'demo'

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
