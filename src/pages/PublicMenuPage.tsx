import { LoaderCircle, Utensils } from 'lucide-react'
import { startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MenuUnavailable } from '../components/MenuUnavailable'
import { OrderBar } from '../components/OrderBar'
import { ServiceChoice } from '../components/ServiceChoice'
import { TemplateSwitcher } from '../components/TemplateSwitcher'
import { getMenuContactCard, getPublicMenu, recordMenuView } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatLbp, localText } from '../lib/format'
import { deriveTheme } from '../lib/theme'
import { useImagePreload } from '../lib/useImagePreload'
import { useOrder } from '../lib/useOrder'
import type { Language, MenuContactCard, RestaurantMenu, ServiceMode } from '../lib/types'
import { DEFAULT_TEMPLATE, resolveTemplateId, TEMPLATES, templateComponents } from '../templates/registry'

/**
 * The loader renders before any data has arrived, so it cannot know the
 * restaurant's own branding. It used to special-case the demo slug and load a
 * logo bundled into the app, which meant every real restaurant got a generic
 * mark while one got a branded one. Now every restaurant gets the same screen.
 */
function MenuLoadingState() {
  return (
    <main className="public-menu-loading" aria-busy="true" aria-live="polite">
      <div className="public-menu-loading-orbit public-menu-loading-orbit-one" />
      <div className="public-menu-loading-orbit public-menu-loading-orbit-two" />
      <div className="public-menu-loading-card">
        <div className="public-menu-loading-mark">
          <div className="public-menu-loading-monogram"><Utensils size={25} /></div>
        </div>
        <span className="public-menu-loading-kicker">FLUXIVA MENU</span>
        <h1>Preparing your menu</h1>
        <p>Opening menu</p>
        <div className="public-menu-loading-progress" aria-hidden="true"><span /></div>
        <span className="public-menu-loading-arabic">جاري فتح القائمة</span>
      </div>
    </main>
  )
}

function TemplateSwitchLoading({ language }: { language: Language }) {
  const message = language === 'ar' ? 'جارٍ تغيير التصميم' : 'Switching template'

  return (
    <div className="template-switch-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="template-switch-loading-card">
        <LoaderCircle aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  )
}

/**
 * Lives inside the Suspense boundary, so its effect only runs after the lazy
 * template has loaded and the replacement design has committed.
 */
function TemplateReady({ templateId, onReady }: { templateId: string; onReady: () => void }) {
  useEffect(() => onReady(), [templateId, onReady])
  return null
}

/**
 * Owns menu data, language and category state, then hands a finished view model
 * to whichever template is selected. Templates stay pure presentation so this
 * logic is written — and fixed — exactly once.
 */
export function PublicMenuPage() {
  const { slug = '' } = useParams()
  const { session, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [menu, setMenu] = useState<RestaurantMenu | null>(null)
  const [contact, setContact] = useState<MenuContactCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [activeCategory, setActiveCategory] = useState('')
  const [switchingTemplate, setSwitchingTemplate] = useState<string | null>(null)

  useEffect(() => {
    getPublicMenu(slug).then(async (data) => {
      setMenu(data)
      if (data) { setLanguage(data.restaurant.default_language); setActiveCategory(data.categories[0]?.id ?? '') }
      // No servable menu: fetch just enough to point the customer at a human.
      else setContact(await getMenuContactCard(slug))
    }).catch(() => setError('This menu could not be loaded.')).finally(() => setLoading(false))
  }, [slug])

  /* The design panel previews an unsaved brand colour the same way it already
     previews an unsaved template. Validated as a hex literal first: this value
     reaches inline styles, and a URL is not a trusted source. Anything else is
     ignored in favour of the saved colour. */
  const colorParam = searchParams.get('color')
  const previewColor = colorParam && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorParam) ? colorParam : null

  const theme = useMemo(
    () => deriveTheme(previewColor ?? menu?.restaurant.primary_color ?? '#173f35'),
    [previewColor, menu?.restaurant.primary_color],
  )

  const t = useCallback((english: string, arabic: string) => localText(language, english, arabic), [language])

  /**
   * Count this open, once per browser session.
   *
   * Excludes the dashboard's embedded preview and the restaurant's own owner —
   * owners check their menu constantly, and counting that would inflate exactly
   * the number a renewal conversation leans on.
   */
  const restaurantId = menu?.restaurant.id
  const isOwner = Boolean(session && menu && session.user.id === menu.restaurant.owner_id)
  const isPreview = searchParams.has('preview')

  // The dashboard embeds this page in a phone frame. Keep the menu scrollable
  // there, but remove the browser's outer document scrollbars so they do not
  // look like a second phone edge inside the preview.
  useEffect(() => {
    if (!isPreview) return
    document.documentElement.classList.add('menu-preview-document')
    document.body.classList.add('menu-preview-document')
    return () => {
      document.documentElement.classList.remove('menu-preview-document')
      document.body.classList.remove('menu-preview-document')
    }
  }, [isPreview])

  /* Only the dashboard preview may override this preference through the URL.
     A customer cannot turn restaurant photos back on by changing a query
     string. The item data is copied without image URLs rather than changing
     what is stored, so the owner can restore every photo with one switch. */
  const canPreviewImages = isPreview && (isOwner || slug === 'demo')
  const imagePreviewParam = canPreviewImages ? searchParams.get('images') : null
  const showItemImages = imagePreviewParam === '0'
    ? false
    : imagePreviewParam === '1'
      ? true
      : menu?.restaurant.show_item_images !== false
  const displayItems = useMemo(
    () => showItemImages
      ? menu?.items ?? []
      : menu?.items.map((item) => ({ ...item, image_url: undefined })) ?? [],
    [menu, showItemImages],
  )
  const visibleItems = useMemo(
    () => displayItems.filter((item) => !activeCategory || item.category_id === activeCategory),
    [displayItems, activeCategory],
  )

  useEffect(() => {
    // Wait for auth to settle first. The menu can arrive before the session
    // does, and recording then would count the owner's own visit — the exact
    // thing the isOwner check exists to prevent — with the sessionStorage
    // guard below making it permanent for the rest of the session.
    if (authLoading) return
    if (!restaurantId || isOwner || isPreview) return
    const seenKey = `fluxiva-viewed-${restaurantId}`
    try {
      if (sessionStorage.getItem(seenKey)) return
      sessionStorage.setItem(seenKey, '1')
    } catch {
      // Private browsing can refuse storage; counting twice beats not counting.
    }
    void recordMenuView(restaurantId)
  }, [authLoading, restaurantId, isOwner, isPreview])

  /**
   * Switching category should land on that category's first item, not wherever
   * the previous one happened to be scrolled to. Templates mark their category
   * bar with `data-menu-bar`; scrolling to its natural position puts the tabs at
   * the top of the screen with the first item directly beneath.
   *
   * The full-screen templates have no such bar — their scroller remounts with
   * the category, which resets it already.
   */
  const previousCategory = useRef('')
  useEffect(() => {
    const previous = previousCategory.current
    previousCategory.current = activeCategory
    // Only a genuine category-to-category change, never the initial load.
    if (!previous || !activeCategory || previous === activeCategory) return

    const bar = document.querySelector<HTMLElement>('[data-menu-bar]')
    if (!bar) return

    // These bars are sticky, and sticky counts as relative positioning: once
    // it is pinned, both getBoundingClientRect and offsetTop report the pinned
    // position rather than where the bar actually sits in the page. Returning
    // to the top first unsticks it so the measurement is the real one. Both
    // scrolls happen in the same frame, so nothing is painted in between.
    window.scrollTo({ top: 0, behavior: 'instant' })
    const top = bar.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top, behavior: 'instant' })
  }, [activeCategory])

  const coverUrl = menu?.restaurant.cover_image_url ?? ''

  /**
   * The images that land on the first screen: branding, the cover, and the
   * opening items. Taken from the first category rather than the active one, so
   * that changing category later never drops the customer back to a loader.
   */
  const criticalImages = useMemo(() => {
    if (!menu) return []
    const firstCategory = menu.categories[0]?.id
    const opening = displayItems
      .filter((item) => item.category_id === firstCategory)
      .slice(0, 4)
      .map((item) => item.image_url)
    return [menu.restaurant.logo_url, coverUrl, ...opening]
  }, [menu, coverUrl, displayItems])

  const imagesReady = useImagePreload(criticalImages)

  // The owner's saved design, unless a `?template=` override is present — which
  // is how the dashboard previews a design before it is saved.
  const requestedTemplateId = resolveTemplateId(searchParams.get('template') ?? menu?.restaurant.template_id)
  const templateId = !showItemImages && TEMPLATES.find((template) => template.id === requestedTemplateId)?.requiresItemImages
    ? DEFAULT_TEMPLATE
    : requestedTemplateId
  const availableTemplates = showItemImages ? TEMPLATES : TEMPLATES.filter((template) => !template.requiresItemImages)

  /* Takeaway ordering is only offered when the owner asked for it, there is a
     number for the order to reach, and the kitchen is actually open. Any one
     of those missing and the diner never sees the button — an order button
     that leads nowhere is worse than none. */
  const canOrder = Boolean(
    menu?.restaurant.takeaway_enabled
    && menu.restaurant.whatsapp
    && !menu.restaurant.temporarily_closed
    // A design with no way to add a dish would hand the diner an empty basket
    // and no means of filling it, so it is not offered takeaway at all.
    && TEMPLATES.find((template) => template.id === templateId)?.supportsOrdering,
  )
  const order = useOrder(slug ?? '', canOrder)

  /* The scan opens on a choice: eating here, or taking it away. Only asked
     when takeaway is genuinely on offer — otherwise a diner would be made to
     pick between the menu and nothing. The dashboard preview skips it too, so
     the owner sees their design rather than this screen in the iframe.

     Held in state alone, so every fresh open of the link asks again. Nothing is
     remembered between loads on purpose: a diner who chose to eat in would
     otherwise have no route to a takeaway order for the rest of the session,
     since that side of the menu is deliberately free of ordering controls. */
  const askService = canOrder && !isPreview
  const [serviceMode, setServiceMode] = useState<ServiceMode | null>(null)
  const orderingAllowed = canOrder && (!askService || serviceMode === 'takeaway')
  const { quantityOf, add, setQuantity } = order
  const templateOrdering = useMemo(
    () => ({ quantityOf, add, setQuantity }),
    [quantityOf, add, setQuantity],
  )


  /* Switching design returns the menu to where it starts: the first category,
     scrolled to the top. Each design is a different height and the window keeps
     its scroll position across the swap, so switching while scrolled down would
     otherwise drop you into the middle of the new menu — and two designs are
     far easier to compare when both open on the same thing.

     Instant rather than smooth: the stylesheet sets `scroll-behavior: smooth`
     globally, which would otherwise animate the whole way back up from deep in
     a long menu. */
  const firstCategoryId = menu?.categories[0]?.id ?? ''
  useEffect(() => {
    setActiveCategory(firstCategoryId)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [templateId, firstCategoryId])

  const finishTemplateSwitch = useCallback(() => setSwitchingTemplate(null), [])

  const selectTemplate = useCallback((id: string) => {
    if (id === templateId) return
    setSwitchingTemplate(id)
    const next = new URLSearchParams(searchParams)
    next.set('template', id)
    // Keep the current design painted while the newly selected lazy chunk is
    // loading. The overlay below provides immediate feedback in the meantime.
    startTransition(() => setSearchParams(next, { replace: true }))
  }, [searchParams, setSearchParams, templateId])

  if (loading) return <MenuLoadingState />
  if (error || !menu) return <MenuUnavailable contact={contact} />
  // Hold the branded loader until the first screen can render complete.
  if (!imagesReady) return <MenuLoadingState />

  const { restaurant, categories } = menu
  const Template = templateComponents[templateId]

  // The choice comes before the menu.
  if (askService && serviceMode === null) {
    return (
      <ServiceChoice
        restaurant={restaurant}
        coverUrl={coverUrl}
        language={language}
        setLanguage={setLanguage}
        rtl={language === 'ar'}
        t={t}
        brand={theme.brand}
        brandInk={theme.brandInk}
        glow={theme.alpha(0.3)}
        onChoose={setServiceMode}
      />
    )
  }

  // `?preview=1` is the dashboard's embedded preview, which supplies its own
  // picker and should not show a second one floating over the menu.
  const showSwitcher = (import.meta.env.DEV || slug === 'demo') && !searchParams.has('preview')

  return (
    <>
      <Suspense fallback={<MenuLoadingState />}>
        <Template
          restaurant={restaurant}
          categories={categories}
          items={displayItems}
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
          ordering={orderingAllowed ? templateOrdering : undefined}
        />
        <TemplateReady templateId={templateId} onReady={finishTemplateSwitch} />
      </Suspense>
      {switchingTemplate && <TemplateSwitchLoading language={language} />}
      {orderingAllowed && (
        <OrderBar
          restaurant={restaurant}
          items={displayItems}
          order={order}
          language={language}
          rtl={language === 'ar'}
          t={t}
          formatPrice={formatLbp}
          brand={theme.brand}
          brandInk={theme.brandInk}
        />
      )}
      {showSwitcher && <TemplateSwitcher active={templateId} onSelect={selectTemplate} templates={availableTemplates} />}
    </>
  )
}
