import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Eye, EyeOff, ImagePlus, LayoutDashboard, LogOut, Menu, Palette, Pencil, Plus, QrCode, Settings, ShieldCheck, Store, Trash2, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Loading, Notice } from '../components/Status'
import { MenuViews } from '../components/MenuViews'
import { SubscriptionBanner } from '../components/SubscriptionBanner'
import { cleanVariants, createCategory, createItem, deleteCategory, deleteItem, deleteRestaurantAsset, getMenuViewStats, getOwnerMenu, updateCategory, updateItem, updateRestaurant, uploadRestaurantAsset } from '../lib/api'
import { useAuth } from '../lib/auth'
import { demoMenu } from '../lib/demo'
import { formatLbp, localText } from '../lib/format'
import { subscriptionState } from '../lib/subscription'
import { DEFAULT_TEMPLATE, TEMPLATES, resolveTemplateId } from '../templates/registry'
import type { Category, MenuItem, MenuViewStats, RestaurantMenu, Variant } from '../lib/types'

type Panel = 'overview' | 'menu' | 'design' | 'settings'
type ItemDraft = { category_id: string; name_en: string; name_ar: string; description_en: string; description_ar: string; price_lbp: string; variants: Variant[]; image_file: File | null; image_url?: string }
const emptyItem = (categoryId = ''): ItemDraft => ({ category_id: categoryId, name_en: '', name_ar: '', description_en: '', description_ar: '', price_lbp: '', variants: [], image_file: null })

async function discardAsset(restaurantId: string, url?: string) {
  try { await deleteRestaurantAsset(restaurantId, url) } catch { /* Cleanup must not undo a successful menu change. */ }
}

function csvRows(text: string) {
  const rows: string[][] = []
  let row: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted }
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row) }
  if (rows.length < 2) return []
  const headers = rows[0].map((header) => header.toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

export function DashboardPage() {
  const { session, demoMode, adminRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState<RestaurantMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categoryModal, setCategoryModal] = useState(false)
  const [itemModal, setItemModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [qrModal, setQrModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [categoryDraft, setCategoryDraft] = useState({ name_en: '', name_ar: '' })
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItem())
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState('')
  const [viewStats, setViewStats] = useState<MenuViewStats | null>(null)
  // Empty until the owner picks one, so the saved design stays the source of truth.
  const [templateDraft, setTemplateDraft] = useState('')
  // Same idea for the brand colour, which now lives beside the design.
  const [colorDraft, setColorDraft] = useState('')
  // Null means the saved preference is still the source of truth.
  const [imageVisibilityDraft, setImageVisibilityDraft] = useState<boolean | null>(null)
  const [imageVisibilityConfirmation, setImageVisibilityConfirmation] = useState<boolean | null>(null)
  const [qrData, setQrData] = useState('')
  const [qrSvg, setQrSvg] = useState('')
  const [saving, setSaving] = useState(false)
  const successTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (demoMode) {
      setMenu(structuredClone(demoMenu))
      getMenuViewStats(demoMenu.restaurant.id).then(setViewStats).catch(() => undefined)
      setLoading(false)
      return
    }
    if (!session) return
    getOwnerMenu(session).then((data) => {
      if (!data) { navigate('/onboarding'); return }
      setMenu(data)
      // Loaded separately so a slow or failed analytics query never delays the
      // editor, which is what the owner actually came here for.
      getMenuViewStats(data.restaurant.id).then(setViewStats).catch(() => undefined)
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load restaurant')).finally(() => setLoading(false))
  }, [session, demoMode, navigate])

  useEffect(() => () => window.clearTimeout(successTimer.current), [])

  function showSuccess(message: string) {
    window.clearTimeout(successTimer.current)
    setSuccess(message)
    successTimer.current = window.setTimeout(() => setSuccess(''), 3200)
  }

  const menuUrl = useMemo(() => menu ? `${import.meta.env.VITE_APP_URL || window.location.origin}/m/${menu.restaurant.slug}` : '', [menu])

  async function openQr() {
    setQrModal(true)
    const options = { width: 800, margin: 2, color: { dark: '#173f35', light: '#ffffff' } }
    setQrData(await QRCode.toDataURL(menuUrl, options))
    setQrSvg(await QRCode.toString(menuUrl, { type: 'svg', margin: 2, color: { dark: '#173f35', light: '#ffffff' } }))
  }

  function downloadQr() {
    const link = document.createElement('a'); link.href = qrData; link.download = `${menu?.restaurant.slug}-menu-qr.png`; link.click()
  }

  function downloadQrSvg() {
    const link = document.createElement('a'); link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`; link.download = `${menu?.restaurant.slug}-menu-qr.svg`; link.click()
  }

  function printQr() { window.print() }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryDraft)
        setMenu({ ...menu, categories: menu.categories.map((entry) => entry.id === editingCategory.id ? { ...entry, ...categoryDraft } : entry) })
      } else {
        const category = await createCategory({ restaurant_id: menu.restaurant.id, ...categoryDraft, sort_order: menu.categories.length + 1 })
        setMenu({ ...menu, categories: [...menu.categories, category] })
      }
      setCategoryModal(false); setEditingCategory(null); setCategoryDraft({ name_en: '', name_ar: '' })
      showSuccess(editingCategory ? 'Category updated.' : 'Category added.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add category') }
    finally { setSaving(false) }
  }

  function openCategory(category?: Category) {
    setEditingCategory(category ?? null)
    setCategoryDraft(category ? { name_en: category.name_en, name_ar: category.name_ar } : { name_en: '', name_ar: '' })
    setCategoryModal(true)
  }

  async function removeCategory(category: Category) {
    if (!menu || !window.confirm(`Delete ${category.name_en} and all items inside it?`)) return
    try {
      const removedItems = menu.items.filter((item) => item.category_id === category.id)
      await deleteCategory(category.id)
      await Promise.all(removedItems.map((item) => discardAsset(menu.restaurant.id, item.image_url)))
      setMenu({ ...menu, categories: menu.categories.filter((entry) => entry.id !== category.id), items: menu.items.filter((item) => item.category_id !== category.id) })
      showSuccess('Category deleted.')
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete category') }
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    let uploadedImageUrl: string | undefined
    try {
      uploadedImageUrl = itemDraft.image_file ? await uploadRestaurantAsset(menu.restaurant.id, itemDraft.image_file) : undefined
      const image_url = uploadedImageUrl ?? itemDraft.image_url
      const input = { restaurant_id: menu.restaurant.id, category_id: itemDraft.category_id, name_en: itemDraft.name_en, name_ar: itemDraft.name_ar, description_en: itemDraft.description_en, description_ar: itemDraft.description_ar, price_lbp: Number(itemDraft.price_lbp) || 0, image_url, variants: cleanVariants(itemDraft.variants), available: editingItem?.available ?? true, sort_order: editingItem?.sort_order ?? menu.items.filter((entry) => entry.category_id === itemDraft.category_id).length + 1 }
      let item: MenuItem
      if (editingItem) {
        item = { ...editingItem, ...input }
        await updateItem(editingItem.id, input)
      } else item = await createItem(input)
      if (uploadedImageUrl && editingItem?.image_url !== uploadedImageUrl) await discardAsset(menu.restaurant.id, editingItem?.image_url)
      setMenu({ ...menu, items: editingItem ? menu.items.map((entry) => entry.id === item.id ? item : entry) : [...menu.items, item] })
      setItemModal(false); setEditingItem(null); setItemDraft(emptyItem(menu.categories[0]?.id))
      showSuccess(editingItem ? 'Menu item updated.' : 'Menu item added.')
    } catch (caught) {
      await discardAsset(menu.restaurant.id, uploadedImageUrl)
      setError(caught instanceof Error ? caught.message : 'Could not add item')
    }
    finally { setSaving(false) }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!menu) return
    const available = !item.available
    setError('')
    setMenu({ ...menu, items: menu.items.map((entry) => entry.id === item.id ? { ...entry, available } : entry) })
    try { await updateItem(item.id, { available }) }
    catch (caught) { setMenu(menu); setError(caught instanceof Error ? caught.message : 'Could not update item visibility') }
  }

  async function saveRestaurant(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    try {
      // `primary_color` is deliberately absent: it belongs to the design panel,
      // and saving it from here too would persist a colour the owner is still
      // only previewing over there.
      const { name_en, name_ar, description_en, description_ar, whatsapp, instagram, address_en, address_ar, temporarily_closed, default_language } = menu.restaurant
      await updateRestaurant(menu.restaurant.id, { name_en, name_ar, description_en, description_ar, whatsapp, instagram, address_en, address_ar, temporarily_closed, default_language })
      showSuccess('Restaurant details saved.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save restaurant') }
    finally { setSaving(false) }
  }

  /**
   * Saves the layout, brand colour and photo preference atomically because the
   * owner experiences them as one menu-design choice.
   */
  async function saveDesign(templateId: string, color: string, showItemImages: boolean) {
    if (!menu) return
    setSaving(true); setError('')
    try {
      await updateRestaurant(menu.restaurant.id, { template_id: templateId, primary_color: color, show_item_images: showItemImages })
      setMenu({ ...menu, restaurant: { ...menu.restaurant, template_id: templateId, primary_color: color, show_item_images: showItemImages } })
      setTemplateDraft(''); setColorDraft(''); setImageVisibilityDraft(null)
      showSuccess('Menu design updated.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save the design') }
    finally { setSaving(false) }
  }

  async function uploadLogo(file: File) {
    if (!menu) return
    setSaving(true); setError('')
    let uploadedUrl: string | undefined
    try {
      uploadedUrl = await uploadRestaurantAsset(menu.restaurant.id, file, 'logo')
      await updateRestaurant(menu.restaurant.id, { logo_url: uploadedUrl })
      await discardAsset(menu.restaurant.id, menu.restaurant.logo_url)
      setMenu({ ...menu, restaurant: { ...menu.restaurant, logo_url: uploadedUrl } })
      showSuccess('Restaurant logo updated.')
    } catch (caught) {
      await discardAsset(menu.restaurant.id, uploadedUrl)
      setError(caught instanceof Error ? caught.message : 'Could not upload logo')
    }
    finally { setSaving(false) }
  }

  async function uploadCover(file: File) {
    if (!menu) return
    setSaving(true); setError('')
    let uploadedUrl: string | undefined
    try {
      uploadedUrl = await uploadRestaurantAsset(menu.restaurant.id, file, 'cover')
      await updateRestaurant(menu.restaurant.id, { cover_image_url: uploadedUrl })
      await discardAsset(menu.restaurant.id, menu.restaurant.cover_image_url)
      setMenu({ ...menu, restaurant: { ...menu.restaurant, cover_image_url: uploadedUrl } })
      showSuccess('Menu cover photo updated.')
    } catch (caught) {
      await discardAsset(menu.restaurant.id, uploadedUrl)
      setError(caught instanceof Error ? caught.message : 'Could not upload cover photo')
    }
    finally { setSaving(false) }
  }

  function restaurantField(key: keyof RestaurantMenu['restaurant'], value: string | boolean) {
    if (!menu) return
    setMenu({ ...menu, restaurant: { ...menu.restaurant, [key]: value } })
  }

  async function removeItem(item: MenuItem) {
    if (!menu || !window.confirm(`Delete ${item.name_en}?`)) return
    try {
      await deleteItem(item.id)
      await discardAsset(menu.restaurant.id, item.image_url)
      setMenu({ ...menu, items: menu.items.filter((entry) => entry.id !== item.id) })
      showSuccess('Menu item deleted.')
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete item') }
  }

  async function moveCategory(category: Category, direction: -1 | 1) {
    if (!menu) return
    const index = menu.categories.findIndex((entry) => entry.id === category.id); const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= menu.categories.length) return
    const next = menu.categories[nextIndex]
    setError('')
    try {
      await Promise.all([updateCategory(category.id, { sort_order: next.sort_order }), updateCategory(next.id, { sort_order: category.sort_order })])
      const categories = [...menu.categories]; categories[index] = { ...next, sort_order: category.sort_order }; categories[nextIndex] = { ...category, sort_order: next.sort_order }
      setMenu({ ...menu, categories })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not reorder categories') }
  }

  async function moveItem(item: MenuItem, direction: -1 | 1) {
    if (!menu) return
    const siblings = menu.items.filter((entry) => entry.category_id === item.category_id).sort((a, b) => a.sort_order - b.sort_order)
    const index = siblings.findIndex((entry) => entry.id === item.id); const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return
    const next = siblings[nextIndex]
    setError('')
    try {
      await Promise.all([updateItem(item.id, { sort_order: next.sort_order }), updateItem(next.id, { sort_order: item.sort_order })])
      const items = menu.items.map((entry) => entry.id === item.id ? { ...entry, sort_order: next.sort_order } : entry.id === next.id ? { ...entry, sort_order: item.sort_order } : entry)
      setMenu({ ...menu, items })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not reorder menu items') }
  }

  function openItem(categoryId = menu?.categories[0]?.id ?? '', item?: MenuItem) {
    if (!menu?.categories.length) { openCategory(); return }
    setEditingItem(item ?? null)
    setItemDraft(item ? { category_id: item.category_id, name_en: item.name_en, name_ar: item.name_ar, description_en: item.description_en ?? '', description_ar: item.description_ar ?? '', price_lbp: String(item.price_lbp || ''), variants: structuredClone(item.variants), image_file: null, image_url: item.image_url } : emptyItem(categoryId))
    setItemModal(true)
  }

  async function importCsv(event: React.FormEvent) {
    event.preventDefault(); if (!menu || !importFile) return
    setSaving(true); setImportStatus('Reading your file…'); setError('')
    try {
      const rows = csvRows(await importFile.text())
      if (!rows.length) throw new Error('Add at least one CSV row with name_en, name_ar and price_lbp columns.')
      let nextMenu = menu
      for (const row of rows) {
        if (!row.name_en || !row.name_ar) continue
        let category = nextMenu.categories.find((entry) => entry.name_en.toLowerCase() === (row.category_en || 'Imported').toLowerCase())
        if (!category) {
          category = await createCategory({ restaurant_id: menu.restaurant.id, name_en: row.category_en || 'Imported', name_ar: row.category_ar || 'مستوردة', sort_order: nextMenu.categories.length + 1 })
          nextMenu = { ...nextMenu, categories: [...nextMenu.categories, category] }
        }
        const item = await createItem({ restaurant_id: menu.restaurant.id, category_id: category.id, name_en: row.name_en, name_ar: row.name_ar, description_en: row.description_en || '', description_ar: row.description_ar || '', price_lbp: Number(row.price_lbp) || 0, variants: [], available: row.available !== 'false', sort_order: nextMenu.items.filter((entry) => entry.category_id === category.id).length + 1 })
        nextMenu = { ...nextMenu, items: [...nextMenu.items, item] }
      }
      setMenu(nextMenu); setImportStatus(`Imported ${nextMenu.items.length - menu.items.length} items.`); setImportFile(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not import CSV') }
    finally { setSaving(false) }
  }

  function addVariant() { setItemDraft((current) => ({ ...current, variants: [...current.variants, { id: crypto.randomUUID(), name_en: '', name_ar: '', price_lbp: 0 }] })) }
  function updateVariant(index: number, key: keyof Variant, value: string | number) { setItemDraft((current) => ({ ...current, variants: current.variants.map((variant, position) => position === index ? { ...variant, [key]: value } : variant) })) }

  if (loading) return <main className="dashboard-loading"><Loading label="Loading your restaurant…" /></main>
  if (!menu) return <main className="dashboard-loading"><div className="dashboard-load-error"><Store /><h1>We couldn’t open your restaurant.</h1><p>{error || 'Please check your connection and try again.'}</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></div></main>
  // Built from the same rule the database uses, so this card can never claim
  // "active" while the menu is actually offline.
  const subscription = subscriptionState(menu.restaurant)
  const subscriptionLabel = subscription.kind === 'trial' ? 'Free trial' : 'Subscription'
  const subscriptionValue = !subscription.serving
    ? 'Offline'
    : subscription.daysLeft === null
      ? 'Active'
      : `${Math.max(0, subscription.daysLeft)} days`
  const subscriptionNote = !subscription.serving
    ? 'Your menu is not being served'
    : subscription.daysLeft === null
      ? 'Restaurant access'
      : subscription.kind === 'trial' ? 'remaining in your trial' : 'until renewal'
  // What customers see right now, versus what the owner is trying out.
  const liveTemplate = resolveTemplateId(menu.restaurant.template_id)
  const previewTemplate = templateDraft || liveTemplate
  const previewColor = colorDraft || menu.restaurant.primary_color
  const liveShowItemImages = menu.restaurant.show_item_images !== false
  const previewShowItemImages = imageVisibilityDraft ?? liveShowItemImages
  const designDirty = previewTemplate !== liveTemplate || previewColor !== menu.restaurant.primary_color || previewShowItemImages !== liveShowItemImages
  const availableTemplates = previewShowItemImages ? TEMPLATES : TEMPLATES.filter((template) => !template.requiresItemImages)
  const dashboardLanguage = menu.restaurant.default_language === 'ar' ? 'ar' : 'en'
  const imageConfirmationCopy = {
    eyebrow: localText(dashboardLanguage, 'Confirm menu change', 'تأكيد تغيير القائمة'),
    showTitle: localText(dashboardLanguage, 'Show food photos?', 'إظهار صور الأطباق؟'),
    hideTitle: localText(dashboardLanguage, 'Hide food photos?', 'إخفاء صور الأطباق؟'),
    showDescription: localText(dashboardLanguage, 'Your saved item photos will appear again on the public menu, and photo-based templates will become available.', 'ستظهر صور الأطباق المحفوظة مجددًا في القائمة العامة، وستصبح القوالب المعتمدة على الصور متاحة.'),
    hideDescription: localText(dashboardLanguage, 'Food photos will disappear from the public menu and photo-based templates will be hidden. Your uploaded photos will stay saved.', 'ستختفي صور الأطباق من القائمة العامة، كما ستُخفى القوالب المعتمدة على الصور. ستبقى الصور التي رفعتها محفوظة.'),
    cancel: localText(dashboardLanguage, 'Cancel', 'إلغاء'),
    showAction: localText(dashboardLanguage, 'Show photos', 'إظهار الصور'),
    hideAction: localText(dashboardLanguage, 'Hide photos', 'إخفاء الصور'),
    close: localText(dashboardLanguage, 'Close confirmation', 'إغلاق التأكيد'),
  }

  function toggleItemImages() {
    setImageVisibilityConfirmation(!previewShowItemImages)
  }

  function confirmItemImages() {
    const next = imageVisibilityConfirmation
    if (next === null) return
    setImageVisibilityDraft(next)
    if (!next && TEMPLATES.find((template) => template.id === previewTemplate)?.requiresItemImages) {
      setTemplateDraft(DEFAULT_TEMPLATE)
    }
    setImageVisibilityConfirmation(null)
  }

  return (
    <main className="dashboard-layout">
      <aside className={`dashboard-sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand light /><button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X /></button></div>
        <div className="restaurant-switcher"><span className="mini-monogram" style={{ backgroundColor: menu.restaurant.primary_color }}>{menu.restaurant.name_en.slice(0, 2).toUpperCase()}</span><span><b>{menu.restaurant.name_en}</b><small>Owner workspace</small></span><ChevronRight /></div>
        <nav>
          <button className={panel === 'overview' ? 'selected' : ''} onClick={() => { setPanel('overview'); setMobileNav(false) }}><LayoutDashboard /> Overview</button>
          <button className={panel === 'menu' ? 'selected' : ''} onClick={() => { setPanel('menu'); setMobileNav(false) }}><Menu /> Menu editor</button>
          <button className={panel === 'design' ? 'selected' : ''} onClick={() => { setPanel('design'); setMobileNav(false) }}><Palette /> Menu design</button>
          <button className={panel === 'settings' ? 'selected' : ''} onClick={() => { setPanel('settings'); setMobileNav(false) }}><Settings /> Restaurant settings</button>
        </nav>
        <div className="sidebar-bottom"><Link to={`/m/${menu.restaurant.slug}`} target="_blank"><ExternalLink /> Open public menu</Link><button onClick={async () => { await signOut(); navigate('/') }}><LogOut /> Sign out</button>{adminRole && <Link className="platform-link" to="/platform"><ShieldCheck /> Operator console</Link>}</div>
      </aside>
      {mobileNav && <button className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <section className="dashboard-main">
        <header className="dashboard-header"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu /></button><div><span>Restaurant dashboard</span><b>{menu.restaurant.name_en}</b></div><div className="header-actions"><Link className="button button-small button-outline" to={`/m/${menu.restaurant.slug}`} target="_blank">View menu <ExternalLink /></Link><button className="button button-small button-primary" onClick={openQr}><QrCode /> QR code</button></div></header>
        <div className="dashboard-content">
          {error && <Notice tone="error">{error}</Notice>}
          {success && <div className="dashboard-toast" role="status"><Notice tone="success">{success}</Notice></div>}
          {demoMode && <Notice>This preview uses sample data. Connect Supabase to save changes and create owner accounts.</Notice>}
          <SubscriptionBanner restaurant={menu.restaurant} />

          {panel === 'overview' && <>
            <div className="page-heading"><div><span className="eyebrow"><span /> Good to see you</span><h1>Your menu at a glance.</h1></div><button className="button button-primary" onClick={() => { setPanel('menu'); openItem() }}><Plus /> Add menu item</button></div>
            <div className="overview-grid">
              <article className="stat-card"><span>Menu items</span><strong>{menu.items.length}</strong><small>{menu.items.filter((item) => item.available).length} currently visible</small></article>
              <article className="stat-card"><span>Categories</span><strong>{menu.categories.length}</strong><small>Organize your menu</small></article>
              <article className="stat-card accent"><span>{subscriptionLabel}</span><strong>{subscriptionValue}</strong><small>{subscriptionNote}</small></article>
            </div>
            {viewStats && <div className="overview-views"><MenuViews stats={viewStats} /></div>}
            <div className="overview-columns">
              <article className="dashboard-card"><div className="card-heading"><div><h2>Quick actions</h2><p>The most common menu tasks.</p></div></div><div className="quick-actions"><button onClick={() => { setPanel('menu'); openItem() }}><span><Plus /></span><div><b>Add an item</b><small>Name, price and size options</small></div><ChevronRight /></button><button onClick={() => { setPanel('menu'); openCategory() }}><span><Menu /></span><div><b>Add a category</b><small>Group your menu items</small></div><ChevronRight /></button><button onClick={openQr}><span><QrCode /></span><div><b>Download QR code</b><small>Ready to print and share</small></div><ChevronRight /></button></div></article>
              <article className="dashboard-card qr-preview"><div className="card-heading"><div><h2>Your menu link</h2><p>Share this link anywhere.</p></div></div><div className="link-preview"><span>{menuUrl.replace(/^https?:\/\//, '')}</span><Link to={`/m/${menu.restaurant.slug}`} target="_blank"><ExternalLink /></Link></div><div className="phone-mini"><div className="phone-mini-cover" style={{ backgroundColor: menu.restaurant.primary_color }}><span>{menu.restaurant.name_en.slice(0, 2).toUpperCase()}</span><b>{menu.restaurant.name_en}</b></div><div><i /><i /><i /></div></div></article>
            </div>
          </>}

          {panel === 'menu' && <>
            <div className="page-heading"><div><span className="eyebrow"><span /> Menu editor</span><h1>Categories and items.</h1><p>Changes appear on your public menu immediately.</p></div><div className="button-row"><button className="button button-outline" onClick={() => setImportModal(true)}><Upload /> Import CSV</button><button className="button button-outline" onClick={() => openCategory()}><Plus /> Category</button><button className="button button-primary" onClick={() => openItem()}><Plus /> Item</button></div></div>
            {!menu.categories.length ? <div className="empty-card"><Store /><h2>Create your first category</h2><p>Start with Pizza, Drinks, Desserts or any section that fits your menu.</p><button className="button button-primary" onClick={() => openCategory()}><Plus /> Add category</button></div> : <div className="category-list">{menu.categories.map((category, categoryIndex) => <section className="dashboard-card category-card" key={category.id}><div className="category-heading"><div><h2>{category.name_en}<small>{category.name_ar}</small></h2><span>{menu.items.filter((item) => item.category_id === category.id).length} items</span></div><div className="category-actions"><button className="icon-button" disabled={categoryIndex === 0} onClick={() => moveCategory(category, -1)} title="Move category up"><ArrowUp /></button><button className="icon-button" disabled={categoryIndex === menu.categories.length - 1} onClick={() => moveCategory(category, 1)} title="Move category down"><ArrowDown /></button><button className="icon-button" onClick={() => openCategory(category)} title="Edit category"><Pencil /></button><button className="icon-button danger" onClick={() => removeCategory(category)} title="Delete category"><Trash2 /></button><button className="button button-small button-outline" onClick={() => openItem(category.id)}><Plus /> Add item</button></div></div><div className="dashboard-items">{menu.items.filter((item) => item.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order).map((item, itemIndex, siblings) => <article key={item.id} className={!item.available ? 'unavailable' : ''}><div className="item-icon">{item.image_url ? <img src={item.image_url} alt="" /> : item.name_en.slice(0, 1)}</div><div className="dashboard-item-info"><b>{item.name_en}<small>{item.name_ar}</small></b><span>{item.variants.length ? `${item.variants.length} sizes · from ${formatLbp(Math.min(...item.variants.map((variant) => variant.price_lbp)))}` : formatLbp(item.price_lbp)}</span></div><button className="visibility" onClick={() => toggleAvailability(item)}>{item.available ? <><Eye /> Visible</> : <><EyeOff /> Hidden</>}</button><div className="item-actions"><button className="icon-button" onClick={() => moveItem(item, -1)} disabled={itemIndex === 0} title="Move item up"><ArrowUp /></button><button className="icon-button" onClick={() => moveItem(item, 1)} disabled={itemIndex === siblings.length - 1} title="Move item down"><ArrowDown /></button><button className="icon-button" onClick={() => openItem(category.id, item)} title="Edit item"><Pencil /></button><button className="icon-button danger" onClick={() => removeItem(item)} title="Delete item"><Trash2 /></button></div></article>)}{!menu.items.some((item) => item.category_id === category.id) && <p className="empty-row">No items in this category yet.</p>}</div></section>)}</div>}
          </>}

          {panel === 'design' && <>
            <div className="page-heading">
              <div><span className="eyebrow"><span /> Menu design</span><h1>Choose how your menu looks.</h1><p>Layout, photos, logo and colour. Every design shows the same items.</p></div>
              <button className="button button-primary" disabled={saving || !designDirty} onClick={() => saveDesign(previewTemplate, previewColor, previewShowItemImages)}>
                {!designDirty ? 'Design in use' : saving ? 'Saving…' : 'Save design'}
              </button>
            </div>
            <div className="design-layout">
              <div className="design-choices">
                <section className="dashboard-card brand-card">
                  <div className="card-heading"><div><h2>Brand</h2><p>Your logo, cover photo and colour, across every design.</p></div></div>
                  <div className="settings-brand">
                    <label className="logo-uploader" style={{ backgroundColor: previewColor }}>
                      {menu.restaurant.logo_url ? <img src={menu.restaurant.logo_url} alt="Restaurant logo" /> : menu.restaurant.name_en.slice(0, 2).toUpperCase()}
                      <input disabled={saving} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    </label>
                    <div><h2>{menu.restaurant.name_en}</h2><p>{menu.restaurant.name_ar}</p><small>Tap the logo to upload a new image.</small></div>
                  </div>
                  <div className="cover-setting">
                    <div className="cover-setting-copy"><b>Menu cover photo</b><small>Shown behind your logo and restaurant name. Large images are resized and compressed automatically.</small></div>
                    <label className={`cover-uploader ${menu.restaurant.cover_image_url ? 'has-image' : ''}`} style={menu.restaurant.cover_image_url ? { backgroundImage: `linear-gradient(rgba(15,35,30,.28),rgba(15,35,30,.48)),url(${menu.restaurant.cover_image_url})` } : { backgroundColor: previewColor }}>
                      <span><ImagePlus />{saving ? 'Uploading…' : menu.restaurant.cover_image_url ? 'Replace cover' : 'Upload cover'}</span>
                      <input disabled={saving} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                    </label>
                  </div>
                  <label className="brand-color-row">Brand color<input className="settings-color" type="color" value={previewColor} onChange={(e) => setColorDraft(e.target.value)} /></label>
                  {/* Presets, not "themes": each one only sets this colour, and
                      the design beside it is the thing an owner calls a theme. */}
                  <div className="theme-presets"><b>Colour presets</b><div>{[['#173f35', 'Cedar'], ['#b84d2f', 'Oven'], ['#7b4f34', 'Earth'], ['#244c70', 'Coast']].map(([color, name]) => <button type="button" key={color} onClick={() => setColorDraft(color)} className={previewColor === color ? 'selected' : ''}><i style={{ backgroundColor: color }} />{name}</button>)}</div></div>
                </section>

                <section className="dashboard-card menu-photo-setting">
                  <div className="menu-photo-setting-copy">
                    <span className="menu-photo-setting-icon">{previewShowItemImages ? <Eye /> : <EyeOff />}</span>
                    <div>
                      <h2>Food photos</h2>
                      <p>Choose whether item photos appear on your public menu. Uploaded photos stay saved when hidden.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`menu-photo-toggle ${previewShowItemImages ? 'on' : ''}`}
                    aria-pressed={previewShowItemImages}
                    onClick={toggleItemImages}
                  >
                    <span aria-hidden="true"><i /></span>
                    {previewShowItemImages ? 'Photos shown' : 'Photos hidden'}
                  </button>
                  {!previewShowItemImages && (
                    <p className="menu-photo-advice">Photo-based designs are hidden. If one was selected, the menu switches to <b>Classic</b> before you save.</p>
                  )}
                </section>

                <div className="template-grid">
                {availableTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={`template-card ${previewTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => setTemplateDraft(template.id)}
                  >
                    <span className="template-card-head">
                      <b>{template.name}</b>
                      {liveTemplate === template.id && <em>Live</em>}
                    </span>
                    <small>{template.description}</small>
                    {template.requiresItemImages && <span className="template-photo-note">Photos required</span>}
                    {template.scroll && <span className="template-scroll">{template.scroll}</span>}
                  </button>
                ))}
                </div>
              </div>
              <aside className="template-preview">
                <div className="card-heading"><div><h2>Live preview</h2><p>Your real menu, in this design.</p></div></div>
                <div className="preview-phone">
                  {/* Keyed so switching design reloads the frame rather than leaving the old one. */}
                  <iframe key={`${previewTemplate}|${previewColor}|${previewShowItemImages}`} title="Menu design preview" src={`/m/${menu.restaurant.slug}?template=${previewTemplate}&color=${encodeURIComponent(previewColor)}&images=${previewShowItemImages ? '1' : '0'}&preview=1`} />
                </div>
                <Link className="button button-small button-outline full" to={`/m/${menu.restaurant.slug}?template=${previewTemplate}&color=${encodeURIComponent(previewColor)}&images=${previewShowItemImages ? '1' : '0'}&preview=1`} target="_blank">
                  Open full size <ExternalLink />
                </Link>
              </aside>
            </div>
          </>}

          {panel === 'settings' && <>
            <div className="page-heading"><div><span className="eyebrow"><span /> Settings</span><h1>Restaurant details.</h1><p>Your name, contact details and menu status. Logo and colour live in Menu design.</p></div></div>
            <form className="dashboard-card restaurant-settings-form" onSubmit={saveRestaurant}>
              <div className="form-grid">
                <label>English name<input required value={menu.restaurant.name_en} onChange={(e) => restaurantField('name_en', e.target.value)} /></label>
                <label dir="rtl">الاسم بالعربية<input required value={menu.restaurant.name_ar} onChange={(e) => restaurantField('name_ar', e.target.value)} /></label>
                <label>English tagline<input value={menu.restaurant.description_en ?? ''} onChange={(e) => restaurantField('description_en', e.target.value)} placeholder="Fresh from our oven" /></label>
                <label dir="rtl">الوصف بالعربية<input value={menu.restaurant.description_ar ?? ''} onChange={(e) => restaurantField('description_ar', e.target.value)} placeholder="طازج من فرننا" /></label>
                <label>WhatsApp number<input value={menu.restaurant.whatsapp ?? ''} onChange={(e) => restaurantField('whatsapp', e.target.value)} placeholder="+961 70 123 456" /></label>
                <label>Instagram<input value={menu.restaurant.instagram ?? ''} onChange={(e) => restaurantField('instagram', e.target.value)} placeholder="@restaurant" /></label>
                <label>English address<textarea value={menu.restaurant.address_en ?? ''} onChange={(e) => restaurantField('address_en', e.target.value)} /></label>
                <label dir="rtl">العنوان بالعربية<textarea value={menu.restaurant.address_ar ?? ''} onChange={(e) => restaurantField('address_ar', e.target.value)} /></label>
                <label className="closed-toggle"><span>Menu status</span><button type="button" className={`status-switch ${menu.restaurant.temporarily_closed ? 'on' : ''}`} onClick={() => restaurantField('temporarily_closed', !menu.restaurant.temporarily_closed)}><i />{menu.restaurant.temporarily_closed ? 'Temporarily closed' : 'Open for customers'}</button></label>
                <label>Default language<select value={menu.restaurant.default_language} onChange={(e) => restaurantField('default_language', e.target.value)}><option value="en">English</option><option value="ar">العربية</option></select></label>
              </div>
              <div className="bilingual-preview"><div><span>English preview</span><b style={{ color: menu.restaurant.primary_color }}>{menu.restaurant.name_en}</b><small>{menu.restaurant.description_en || 'Fresh from our oven.'}</small></div><div dir="rtl"><span>معاينة عربية</span><b style={{ color: menu.restaurant.primary_color }}>{menu.restaurant.name_ar}</b><small>{menu.restaurant.description_ar || 'طازج من فرننا.'}</small></div></div>
              <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save restaurant details'}</button>
            </form>
          </>}
        </div>
      </section>

      {imageVisibilityConfirmation !== null && <div className="modal-backdrop"><div className="modal-card image-toggle-modal" role="dialog" aria-modal="true" aria-labelledby="image-toggle-title" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><button type="button" className="modal-close" aria-label={imageConfirmationCopy.close} onClick={() => setImageVisibilityConfirmation(null)}><X /></button><span className="eyebrow"><span /> {imageConfirmationCopy.eyebrow}</span><h2 id="image-toggle-title">{imageVisibilityConfirmation ? imageConfirmationCopy.showTitle : imageConfirmationCopy.hideTitle}</h2><p>{imageVisibilityConfirmation ? imageConfirmationCopy.showDescription : imageConfirmationCopy.hideDescription}</p><div className="button-row modal-actions"><button type="button" className="button button-outline" onClick={() => setImageVisibilityConfirmation(null)}>{imageConfirmationCopy.cancel}</button><button type="button" className="button button-primary" onClick={confirmItemImages}>{imageVisibilityConfirmation ? imageConfirmationCopy.showAction : imageConfirmationCopy.hideAction}</button></div></div></div>}

      {categoryModal && <div className="modal-backdrop"><form className="modal-card" onSubmit={saveCategory}><button type="button" className="modal-close" onClick={() => { setCategoryModal(false); setEditingCategory(null) }}><X /></button><span className="eyebrow"><span /> {editingCategory ? 'Edit section' : 'New section'}</span><h2>{editingCategory ? 'Edit category' : 'Add a category'}</h2><p>Give it a name in both menu languages.</p><label>English name<input required autoFocus value={categoryDraft.name_en} onChange={(e) => setCategoryDraft({ ...categoryDraft, name_en: e.target.value })} placeholder="Pizza" /></label><label dir="rtl">الاسم بالعربية<input required value={categoryDraft.name_ar} onChange={(e) => setCategoryDraft({ ...categoryDraft, name_ar: e.target.value })} placeholder="بيتزا" /></label><button className="button button-primary full" disabled={saving}>{saving ? 'Saving…' : editingCategory ? 'Save category' : 'Add category'}</button></form></div>}

      {itemModal && <div className="modal-backdrop"><form className="modal-card modal-large" onSubmit={saveItem}><button type="button" className="modal-close" onClick={() => { setItemModal(false); setEditingItem(null) }}><X /></button><span className="eyebrow"><span /> {editingItem ? 'Edit item' : 'New item'}</span><h2>{editingItem ? 'Edit menu item' : 'Add a menu item'}</h2><div className="form-grid"><label>Category<select required value={itemDraft.category_id} onChange={(e) => setItemDraft({ ...itemDraft, category_id: e.target.value })}><option value="">Choose category</option>{menu.categories.map((category) => <option value={category.id} key={category.id}>{category.name_en}</option>)}</select></label><label className="image-upload">Item photo<span><ImagePlus /> {itemDraft.image_file?.name || (itemDraft.image_url ? 'Replace current photo' : 'Choose an image')}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setItemDraft({ ...itemDraft, image_file: e.target.files?.[0] ?? null })} /></label><label>English name<input required value={itemDraft.name_en} onChange={(e) => setItemDraft({ ...itemDraft, name_en: e.target.value })} placeholder="Margherita" /></label><label dir="rtl">الاسم بالعربية<input required value={itemDraft.name_ar} onChange={(e) => setItemDraft({ ...itemDraft, name_ar: e.target.value })} placeholder="مارغريتا" /></label><label>English description<textarea value={itemDraft.description_en} onChange={(e) => setItemDraft({ ...itemDraft, description_en: e.target.value })} placeholder="Tomato, mozzarella and basil" /></label><label dir="rtl">الوصف بالعربية<textarea value={itemDraft.description_ar} onChange={(e) => setItemDraft({ ...itemDraft, description_ar: e.target.value })} placeholder="طماطم، موزاريلا وريحان" /></label></div><div className="price-section"><label>Base price (LBP)<input required={itemDraft.variants.length === 0} min="0" type="number" value={itemDraft.price_lbp} onChange={(e) => setItemDraft({ ...itemDraft, price_lbp: e.target.value })} placeholder="350000" /></label><div className="variant-title"><div><b>Size options</b><small>Optional — add sizes when prices differ.</small></div><button type="button" onClick={addVariant}><Plus /> Add size</button></div>{itemDraft.variants.map((variant, index) => <div className="variant-row" key={variant.id}><input required placeholder="S" value={variant.name_en} onChange={(e) => updateVariant(index, 'name_en', e.target.value)} /><input placeholder="ص" dir="rtl" value={variant.name_ar} onChange={(e) => updateVariant(index, 'name_ar', e.target.value)} /><input required min="1" type="number" placeholder="Price LBP" value={variant.price_lbp || ''} onChange={(e) => updateVariant(index, 'price_lbp', Number(e.target.value))} /><button type="button" onClick={() => setItemDraft((current) => ({ ...current, variants: current.variants.filter((_, position) => position !== index) }))}><X /></button></div>)}</div><button className="button button-primary full" disabled={saving || !menu.categories.length}>{saving ? 'Saving…' : editingItem ? 'Save menu item' : 'Add menu item'}</button></form></div>}

      {importModal && <div className="modal-backdrop"><form className="modal-card" onSubmit={importCsv}><button type="button" className="modal-close" onClick={() => { setImportModal(false); setImportStatus(''); setImportFile(null) }}><X /></button><span className="eyebrow"><span /> Bulk import</span><h2>Import menu items</h2><p>Upload a CSV exported from Excel or Google Sheets. Columns: category_en, category_ar, name_en, name_ar, description_en, description_ar, price_lbp, available.</p><label className="file-drop"><Upload /><b>{importFile?.name || 'Choose CSV file'}</b><small>One item per row</small><input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} /></label>{importStatus && <p className="notice notice-success">{importStatus}</p>}<button className="button button-primary full" disabled={saving || !importFile}>{saving ? 'Importing…' : 'Import items'}</button></form></div>}

      {qrModal && <div className="modal-backdrop"><div className="modal-card qr-modal qr-print-area"><button className="modal-close" onClick={() => setQrModal(false)}><X /></button><span className="eyebrow"><span /> Ready to scan</span><h2>Your menu QR code</h2><p>Print it on table cards, packaging or your storefront.</p>{qrData && <img src={qrData} alt="Restaurant menu QR code" />}<code>{menuUrl}</code><div className="qr-actions"><button className="button button-primary" onClick={downloadQr}><QrCode /> PNG</button><button className="button button-outline" onClick={downloadQrSvg}>SVG</button><button className="button button-outline" onClick={printQr}>Print</button></div></div></div>}
    </main>
  )
}
