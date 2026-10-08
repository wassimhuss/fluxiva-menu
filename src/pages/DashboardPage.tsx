import { ArrowDown, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, ImagePlus, Images, LayoutDashboard, LogOut, Maximize2, Menu, Palette, Pencil, Plus, QrCode, RotateCcw, Settings, ShieldCheck, Store, Trash2, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Loading, Notice } from '../components/Status'
import { MenuViews } from '../components/MenuViews'
import { SubscriptionBanner } from '../components/SubscriptionBanner'
import { GalleryPicker } from '../components/GalleryPicker'
import { ImageLightbox } from '../components/ImageLightbox'
import { PortraitImageCropper } from '../components/PortraitImageCropper'
import { cleanExtras, cleanVariants, createCategory, createItem, deleteCategory, deleteItem, deleteRestaurantAsset, getMenuViewStats, getOwnerMenu, listGalleryCategories, listGalleryImages, updateCategory, updateItem, updateRestaurant, uploadRestaurantAsset, validateGallerySource } from '../lib/api'
import { useAuth } from '../lib/auth'
import { demoMenu } from '../lib/demo'
import { formatMoney, localText } from '../lib/format'
import { dashboardText } from '../lib/dashboardI18n'
import { subscriptionState } from '../lib/subscription'
import { DEFAULT_TEMPLATE, TEMPLATES, resolveTemplateId } from '../templates/registry'
import type { Category, GalleryCategory, GalleryImage, ItemExtra, Language, MenuItem, MenuViewStats, Restaurant, RestaurantMenu, Variant } from '../lib/types'

type Panel = 'overview' | 'analysis' | 'menu' | 'design' | 'settings'
type ItemDraft = { category_id: string; name_en: string; name_ar: string; description_en: string; description_ar: string; price: string; variants: Variant[]; extras: ItemExtra[]; image_file: File | null; image_url?: string | null; gallery_image_id?: string | null }
type ImagePreview = { url: string; name: string }
type RestaurantSettings = Pick<Restaurant, 'name_en' | 'name_ar' | 'description_en' | 'description_ar' | 'whatsapp' | 'instagram' | 'address_en' | 'address_ar' | 'currency' | 'temporarily_closed' | 'takeaway_enabled' | 'default_language'>
const DASHBOARD_LANGUAGE_KEY = 'fluxiva-dashboard-language'
const emptyItem = (categoryId = ''): ItemDraft => ({ category_id: categoryId, name_en: '', name_ar: '', description_en: '', description_ar: '', price: '', variants: [], extras: [], image_file: null })

function restaurantSettingsSnapshot(restaurant: Restaurant): RestaurantSettings {
  const { name_en, name_ar, description_en, description_ar, whatsapp, instagram, address_en, address_ar, currency, temporarily_closed, takeaway_enabled, default_language } = restaurant
  return { name_en, name_ar, description_en, description_ar, whatsapp, instagram, address_en, address_ar, currency, temporarily_closed, takeaway_enabled, default_language }
}

async function discardAsset(restaurantId: string, url?: string | null) {
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
  const [designStep, setDesignStep] = useState(1)
  const [settingsStep, setSettingsStep] = useState(1)
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
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryCategories, setGalleryCategories] = useState<GalleryCategory[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryLoaded, setGalleryLoaded] = useState(false)
  const [pendingItemCrop, setPendingItemCrop] = useState<File | null>(null)
  const [itemPhotoError, setItemPhotoError] = useState('')
  const [itemFilePreviewUrl, setItemFilePreviewUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null)
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
  const [previewConfirmationOpen, setPreviewConfirmationOpen] = useState(false)
  const [designExitConfirmationOpen, setDesignExitConfirmationOpen] = useState(false)
  const [savedSettings, setSavedSettings] = useState<RestaurantSettings | null>(null)
  const [settingsExitConfirmationOpen, setSettingsExitConfirmationOpen] = useState(false)
  const [qrData, setQrData] = useState('')
  const [qrSvg, setQrSvg] = useState('')
  const [saving, setSaving] = useState(false)
  const [dashboardLanguage, setDashboardLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem(DASHBOARD_LANGUAGE_KEY)
    return saved === 'ar' ? 'ar' : 'en'
  })
  const successTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (demoMode) {
      const demo = structuredClone(demoMenu)
      setMenu(demo)
      setSavedSettings(restaurantSettingsSnapshot(demo.restaurant))
      getMenuViewStats(demoMenu.restaurant.id).then(setViewStats).catch(() => undefined)
      setLoading(false)
      return
    }
    if (!session) return
    getOwnerMenu(session).then((data) => {
      if (!data) { navigate('/onboarding'); return }
      setMenu(data)
      setSavedSettings(restaurantSettingsSnapshot(data.restaurant))
      // Loaded separately so a slow or failed analytics query never delays the
      // editor, which is what the owner actually came here for.
      getMenuViewStats(data.restaurant.id).then(setViewStats).catch(() => undefined)
    }).catch((caught) => setError(caught instanceof Error ? caught.message : dashboardText('en', 'Could not load restaurant'))).finally(() => setLoading(false))
  }, [session, demoMode, navigate])

  useEffect(() => () => window.clearTimeout(successTimer.current), [])

  const DirectionalChevron = dashboardLanguage === 'ar' ? ChevronLeft : ChevronRight
  const BackChevron = dashboardLanguage === 'ar' ? ChevronRight : ChevronLeft
  const designSteps: Array<[number, string]> = [[1, 'Brand'], [2, 'Menu style'], [3, 'Preview & save']]
  const settingsSteps: Array<[number, string]> = [[1, 'Basic details'], [2, 'Contact details'], [3, 'Menu settings']]

  useEffect(() => {
    if (!itemDraft.image_file) { setItemFilePreviewUrl(''); return }
    const objectUrl = URL.createObjectURL(itemDraft.image_file)
    setItemFilePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [itemDraft.image_file])

  useEffect(() => {
    if (!menu || window.localStorage.getItem(DASHBOARD_LANGUAGE_KEY)) return
    setDashboardLanguage(menu.restaurant.default_language)
  }, [menu])

  function changeDashboardLanguage(language: Language) {
    setDashboardLanguage(language)
    window.localStorage.setItem(DASHBOARD_LANGUAGE_KEY, language)
  }

  const t = (english: string) => dashboardText(dashboardLanguage, english)

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
      showSuccess(dashboardText(dashboardLanguage, editingCategory ? 'Category updated.' : 'Category added.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not add category')) }
    finally { setSaving(false) }
  }

  function openCategory(category?: Category) {
    setEditingCategory(category ?? null)
    setCategoryDraft(category ? { name_en: category.name_en, name_ar: category.name_ar } : { name_en: '', name_ar: '' })
    setCategoryModal(true)
  }

  async function removeCategory(category: Category) {
    if (!menu || !window.confirm(`${dashboardText(dashboardLanguage, 'Delete')} ${category.name_en} ${dashboardText(dashboardLanguage, 'and all items inside it?')}`)) return
    try {
      const removedItems = menu.items.filter((item) => item.category_id === category.id)
      await deleteCategory(category.id)
      await Promise.all(removedItems.map((item) => discardAsset(menu.restaurant.id, item.image_url)))
      setMenu({ ...menu, categories: menu.categories.filter((entry) => entry.id !== category.id), items: menu.items.filter((item) => item.category_id !== category.id) })
      showSuccess(dashboardText(dashboardLanguage, 'Category deleted.'))
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not delete category')) }
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    let uploadedImageUrl: string | undefined
    try {
      uploadedImageUrl = itemDraft.image_file ? await uploadRestaurantAsset(menu.restaurant.id, itemDraft.image_file) : undefined
      const image_url = uploadedImageUrl ?? itemDraft.image_url
      const gallery_image_id = uploadedImageUrl ? null : itemDraft.gallery_image_id ?? null
      const input = { restaurant_id: menu.restaurant.id, category_id: itemDraft.category_id, name_en: itemDraft.name_en, name_ar: itemDraft.name_ar, description_en: itemDraft.description_en, description_ar: itemDraft.description_ar, price: Number(itemDraft.price) || 0, image_url, gallery_image_id, variants: cleanVariants(itemDraft.variants), extras: cleanExtras(itemDraft.extras), available: editingItem?.available ?? true, sort_order: editingItem?.sort_order ?? menu.items.filter((entry) => entry.category_id === itemDraft.category_id).length + 1 }
      let item: MenuItem
      if (editingItem) {
        item = { ...editingItem, ...input }
        await updateItem(editingItem.id, input)
      } else item = await createItem(input)
      if (editingItem?.image_url && editingItem.image_url !== image_url && !editingItem.gallery_image_id) await discardAsset(menu.restaurant.id, editingItem.image_url)
      setMenu({ ...menu, items: editingItem ? menu.items.map((entry) => entry.id === item.id ? item : entry) : [...menu.items, item] })
      setItemModal(false); setEditingItem(null); setPendingItemCrop(null); setItemPhotoError(''); setItemDraft(emptyItem(menu.categories[0]?.id))
      showSuccess(dashboardText(dashboardLanguage, editingItem ? 'Menu item updated.' : 'Menu item added.'))
    } catch (caught) {
      await discardAsset(menu.restaurant.id, uploadedImageUrl)
      setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not add item'))
    }
    finally { setSaving(false) }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!menu) return
    const available = !item.available
    setError('')
    setMenu({ ...menu, items: menu.items.map((entry) => entry.id === item.id ? { ...entry, available } : entry) })
    try { await updateItem(item.id, { available }) }
    catch (caught) { setMenu(menu); setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not update item visibility')) }
  }

  async function saveRestaurantDetails(): Promise<boolean> {
    if (!menu) return false
    setSaving(true); setError('')
    try {
      // `primary_color` is deliberately absent: it belongs to the design panel,
      // and saving it from here too would persist a colour the owner is still
      // only previewing over there.
      const { name_en, name_ar, description_en, description_ar, whatsapp, instagram, address_en, address_ar, currency: currencyValue, temporarily_closed, takeaway_enabled, default_language } = menu.restaurant
      await updateRestaurant(menu.restaurant.id, { name_en, name_ar, description_en, description_ar, whatsapp, instagram, address_en, address_ar, currency: currencyValue, temporarily_closed, takeaway_enabled, default_language })
      setSavedSettings(restaurantSettingsSnapshot(menu.restaurant))
      showSuccess(dashboardText(dashboardLanguage, 'Restaurant details saved.'))
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not save restaurant'))
      return false
    } finally { setSaving(false) }
  }

  async function saveRestaurant(event: React.FormEvent) {
    event.preventDefault()
    await saveRestaurantDetails()
  }

  /**
   * Saves the layout, brand colour and photo preference atomically because the
   * owner experiences them as one menu-design choice.
   */
  async function saveDesign(templateId: string, color: string, showItemImages: boolean): Promise<boolean> {
    if (!menu) return false
    setSaving(true); setError('')
    try {
      await updateRestaurant(menu.restaurant.id, { template_id: templateId, primary_color: color, show_item_images: showItemImages })
      setMenu({ ...menu, restaurant: { ...menu.restaurant, template_id: templateId, primary_color: color, show_item_images: showItemImages } })
      setTemplateDraft(''); setColorDraft(''); setImageVisibilityDraft(null)
      showSuccess(dashboardText(dashboardLanguage, 'Menu design updated.'))
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not save the design'))
      return false
    }
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
      showSuccess(dashboardText(dashboardLanguage, 'Restaurant logo updated.'))
    } catch (caught) {
      await discardAsset(menu.restaurant.id, uploadedUrl)
      setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not upload logo'))
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
      showSuccess(dashboardText(dashboardLanguage, 'Menu cover photo updated.'))
    } catch (caught) {
      await discardAsset(menu.restaurant.id, uploadedUrl)
      setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not upload cover photo'))
    }
    finally { setSaving(false) }
  }

  function restaurantField(key: keyof RestaurantMenu['restaurant'], value: string | boolean) {
    if (!menu) return
    setMenu({ ...menu, restaurant: { ...menu.restaurant, [key]: value } })
  }

  async function removeItem(item: MenuItem) {
    if (!menu || !window.confirm(`${dashboardText(dashboardLanguage, 'Delete')} ${item.name_en}?`)) return
    try {
      await deleteItem(item.id)
      await discardAsset(menu.restaurant.id, item.image_url)
      setMenu({ ...menu, items: menu.items.filter((entry) => entry.id !== item.id) })
      showSuccess(dashboardText(dashboardLanguage, 'Menu item deleted.'))
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not delete item')) }
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not reorder categories')) }
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not reorder menu items')) }
  }

  function openItem(categoryId = menu?.categories[0]?.id ?? '', item?: MenuItem) {
    if (!menu?.categories.length) { openCategory(); return }
    setEditingItem(item ?? null)
    setItemDraft(item ? { category_id: item.category_id, name_en: item.name_en, name_ar: item.name_ar, description_en: item.description_en ?? '', description_ar: item.description_ar ?? '', price: String(item.price || ''), variants: structuredClone(item.variants ?? []), extras: structuredClone(item.extras ?? []), image_file: null, image_url: item.image_url, gallery_image_id: item.gallery_image_id } : emptyItem(categoryId))
    setPendingItemCrop(null)
    setItemPhotoError('')
    setItemModal(true)
  }

  function closeItem() {
    setItemModal(false); setEditingItem(null); setPendingItemCrop(null); setItemPhotoError('')
  }

  async function chooseItemPhoto(file: File | null) {
    if (!file) return
    setItemPhotoError('')
    try {
      await validateGallerySource(file)
      setPendingItemCrop(file)
    } catch (caught) {
      setItemPhotoError(caught instanceof Error ? caught.message : t('This image could not be opened.'))
    }
  }

  function acceptItemCrop(file: File) {
    setItemDraft((current) => ({ ...current, image_file: file, gallery_image_id: null }))
    setPendingItemCrop(null)
    setItemPhotoError('')
  }

  async function openGallery() {
    setGalleryOpen(true)
    if (galleryLoaded) return
    setGalleryLoading(true)
    try {
      const [images, categories] = await Promise.all([listGalleryImages(), listGalleryCategories()])
      setGalleryImages(images); setGalleryCategories(categories); setGalleryLoaded(true)
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not load gallery')) }
    finally { setGalleryLoading(false) }
  }

  async function importCsv(event: React.FormEvent) {
    event.preventDefault(); if (!menu || !importFile) return
    setSaving(true); setImportStatus('Reading your file…'); setError('')
    try {
      const rows = csvRows(await importFile.text())
      if (!rows.length) throw new Error(dashboardText(dashboardLanguage, 'Add at least one CSV row with name_en, name_ar and price columns.'))
      let nextMenu = menu
      // `price_lbp` was this column's name before currencies were per
      // restaurant, and the old name is what the importer's own instructions
      // told owners to use, so a file written against them still loads.
      for (const row of rows) {
        if (!row.name_en || !row.name_ar) continue
        let category = nextMenu.categories.find((entry) => entry.name_en.toLowerCase() === (row.category_en || 'Imported').toLowerCase())
        if (!category) {
          category = await createCategory({ restaurant_id: menu.restaurant.id, name_en: row.category_en || 'Imported', name_ar: row.category_ar || 'مستوردة', sort_order: nextMenu.categories.length + 1 })
          nextMenu = { ...nextMenu, categories: [...nextMenu.categories, category] }
        }
        const item = await createItem({ restaurant_id: menu.restaurant.id, category_id: category.id, name_en: row.name_en, name_ar: row.name_ar, description_en: row.description_en || '', description_ar: row.description_ar || '', price: Number(row.price ?? row.price_lbp) || 0, variants: [], extras: [], available: row.available !== 'false', sort_order: nextMenu.items.filter((entry) => entry.category_id === category.id).length + 1 })
        nextMenu = { ...nextMenu, items: [...nextMenu.items, item] }
      }
      setMenu(nextMenu); setImportStatus(`Imported ${nextMenu.items.length - menu.items.length} items.`); setImportFile(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : dashboardText(dashboardLanguage, 'Could not import CSV')) }
    finally { setSaving(false) }
  }

  function addVariant() { setItemDraft((current) => ({ ...current, variants: [...current.variants, { id: crypto.randomUUID(), name_en: '', price: 0 }] })) }
  function updateVariant(index: number, key: keyof Variant, value: string | number) { setItemDraft((current) => ({ ...current, variants: current.variants.map((variant, position) => position === index ? { ...variant, [key]: value } : variant) })) }
  function addExtra() { setItemDraft((current) => ({ ...current, extras: [...current.extras, { id: crypto.randomUUID(), name_en: '', name_ar: '', price: 0 }] })) }
  function updateExtra(index: number, key: keyof ItemExtra, value: string | number) { setItemDraft((current) => ({ ...current, extras: current.extras.map((extra, position) => position === index ? { ...extra, [key]: value } : extra) })) }

  if (loading) return <main className="dashboard-loading" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><Loading label={t('Loading your restaurant…')} /></main>
  if (!menu) return <main className="dashboard-loading" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><div className="dashboard-load-error"><Store /><h1>{t('We couldn’t open your restaurant.')}</h1><p>{error || t('Please check your connection and try again.')}</p><button className="button button-primary" onClick={() => window.location.reload()}>{t('Try again')}</button></div></main>
  // Built from the same rule the database uses, so this card can never claim
  // "active" while the menu is actually offline.
  const subscription = subscriptionState(menu.restaurant)
  const subscriptionLabel = subscription.kind === 'trial' ? t('Free trial') : t('Subscription')
  const subscriptionValue = !subscription.serving
    ? t('Offline')
    : subscription.daysLeft === null
      ? t('Active')
      : `${Math.max(0, subscription.daysLeft)} ${t('days')}`
  const subscriptionNote = !subscription.serving
    ? t('Your menu is not being served')
    : subscription.daysLeft === null
      ? t('Restaurant access')
      : subscription.kind === 'trial' ? t('remaining in your trial') : t('until renewal')
  // What customers see right now, versus what the owner is trying out.
  const liveTemplate = resolveTemplateId(menu.restaurant.template_id)
  /* Prices are typed and shown in whatever the restaurant charges in. Dollars
     need cents; pounds would only collect noise from them. */
  const currency = menu.restaurant.currency ?? 'LBP'
  const currencyLabel = currency === 'USD' ? 'USD' : 'LBP'
  const priceStep = currency === 'USD' ? '0.01' : '1'
  const pricePlaceholder = currency === 'USD' ? '3.50' : '350000'

  const previewTemplate = templateDraft || liveTemplate
  const previewColor = colorDraft || menu.restaurant.primary_color
  const liveShowItemImages = menu.restaurant.show_item_images !== false
  const previewShowItemImages = imageVisibilityDraft ?? liveShowItemImages
  const designDirty = previewTemplate !== liveTemplate || previewColor !== menu.restaurant.primary_color || previewShowItemImages !== liveShowItemImages
  const settingsDirty = savedSettings !== null && JSON.stringify(restaurantSettingsSnapshot(menu.restaurant)) !== JSON.stringify(savedSettings)
  const fullPreviewUrl = `/m/${menu.restaurant.slug}?template=${previewTemplate}&color=${encodeURIComponent(previewColor)}&images=${previewShowItemImages ? '1' : '0'}&preview=1`
  const availableTemplates = previewShowItemImages ? TEMPLATES : TEMPLATES.filter((template) => !template.requiresItemImages)
  const selectedTemplate = TEMPLATES.find((template) => template.id === previewTemplate) ?? TEMPLATES[0]
  const currentDesignStepDirty = designStep === 1
    ? previewColor !== menu.restaurant.primary_color
    : designStep === 2
      ? previewTemplate !== liveTemplate || previewShowItemImages !== liveShowItemImages
      : designDirty

  function resetCurrentDesignStep() {
    if (designStep === 1) setColorDraft('')
    else if (designStep === 2) { setTemplateDraft(''); setImageVisibilityDraft(null) }
    else { setTemplateDraft(''); setColorDraft(''); setImageVisibilityDraft(null) }
  }

  function leaveDesignWithoutSaving() {
    setTemplateDraft('')
    setColorDraft('')
    setImageVisibilityDraft(null)
    setImageVisibilityConfirmation(null)
    setDesignExitConfirmationOpen(false)
    setPanel('overview')
  }

  function requestBackToOverview() {
    if (saving) return
    if (panel === 'design' && designDirty) {
      setDesignExitConfirmationOpen(true)
      return
    }
    if (panel === 'settings' && settingsDirty) {
      setSettingsExitConfirmationOpen(true)
      return
    }
    setPanel('overview')
  }

  async function saveAndLeaveDesign() {
    const saved = await saveDesign(previewTemplate, previewColor, previewShowItemImages)
    if (!saved) return
    setDesignExitConfirmationOpen(false)
    setPanel('overview')
  }

  function leaveSettingsWithoutSaving() {
    if (!menu) return
    if (savedSettings) setMenu({ ...menu, restaurant: { ...menu.restaurant, ...savedSettings } })
    setSettingsExitConfirmationOpen(false)
    setPanel('overview')
  }

  async function saveAndLeaveSettings() {
    const saved = await saveRestaurantDetails()
    if (!saved) return
    setSettingsExitConfirmationOpen(false)
    setPanel('overview')
  }

  function openSettings() {
    if (!menu) return
    setSavedSettings(restaurantSettingsSnapshot(menu.restaurant))
    setSettingsExitConfirmationOpen(false)
    setPanel('settings')
    setSettingsStep(1)
  }

  function continueToPreview() {
    setPreviewConfirmationOpen(false)
    window.open(fullPreviewUrl, '_blank', 'noopener,noreferrer')
  }

  async function saveAndOpenPreview() {
    // Open the tab during the click itself so browsers do not block it after
    // the asynchronous save finishes.
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null

    const saved = await saveDesign(previewTemplate, previewColor, previewShowItemImages)
    if (!saved) {
      previewWindow?.close()
      return
    }

    setPreviewConfirmationOpen(false)
    if (previewWindow) previewWindow.location.href = fullPreviewUrl
    else window.location.assign(fullPreviewUrl)
  }
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
    <main className="dashboard-layout" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="dashboard-sidebar">
        <div className="sidebar-top"><Brand light /></div>
        <div className="restaurant-switcher"><span className="mini-monogram" style={{ backgroundColor: menu.restaurant.primary_color }}>{menu.restaurant.name_en.slice(0, 2).toUpperCase()}</span><span><b>{menu.restaurant.name_en}</b><small>{t('Owner workspace')}</small></span><DirectionalChevron /></div>
        <nav>
          <button className={panel === 'overview' ? 'selected' : ''} onClick={() => setPanel('overview')}><LayoutDashboard /> {t('Overview')}</button>
          <button className={panel === 'analysis' ? 'selected' : ''} onClick={() => setPanel('analysis')}><Eye /> {t('Analysis')}</button>
          <button className={panel === 'menu' ? 'selected' : ''} onClick={() => setPanel('menu')}><Menu /> {t('Menu editor')}</button>
          <button className={panel === 'design' ? 'selected' : ''} onClick={() => { setPanel('design'); setDesignStep(1) }}><Palette /> {t('Menu design')}</button>
          <button className={panel === 'settings' ? 'selected' : ''} onClick={openSettings}><Settings /> {t('Restaurant settings')}</button>
        </nav>
        <div className="sidebar-bottom"><Link to={`/m/${menu.restaurant.slug}`} target="_blank"><ExternalLink /> {t('Open public menu')}</Link><button onClick={async () => { await signOut(); navigate('/') }}><LogOut /> {t('Sign out')}</button>{adminRole && <Link className="platform-link" to="/platform"><ShieldCheck /> {t('Operator console')}</Link>}</div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-header">{panel !== 'overview' && <button className="mobile-menu" aria-label={t('Back to overview')} onClick={requestBackToOverview}><ArrowLeft /></button>}<div><span>{t('Restaurant dashboard')}</span><b>{menu.restaurant.name_en}</b></div><div className="header-actions"><button type="button" className="language-switch" onClick={() => changeDashboardLanguage(dashboardLanguage === 'ar' ? 'en' : 'ar')} aria-label={dashboardLanguage === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>{dashboardLanguage === 'ar' ? 'EN' : 'عربي'}</button><Link className="button button-small button-outline" to={`/m/${menu.restaurant.slug}`} target="_blank">{t('View menu')} <ExternalLink /></Link></div></header>
        <div className="dashboard-content">
          {error && <Notice tone="error">{error}</Notice>}
          {success && <div className="dashboard-toast" role="status"><Notice tone="success">{success}</Notice></div>}
          {demoMode && <Notice>{t('This preview uses sample data. Connect Supabase to save changes and create owner accounts.')}</Notice>}
          <SubscriptionBanner restaurant={menu.restaurant} language={dashboardLanguage} />

          {panel === 'overview' && <>
            <div className="page-heading overview-page-heading"><div><span className="eyebrow"><span /> {t('Good to see you')}</span><h1>{t('Your menu at a glance.')}</h1></div><button className="button button-primary overview-add-item" onClick={() => { setPanel('menu'); openItem() }}><Plus /> {t('Add menu item')}</button></div>
            <section className="mobile-section-hub" aria-labelledby="mobile-section-hub-title">
              <div className="mobile-section-hub-heading"><div><span className="eyebrow"><span /> {t('Workspace')}</span><h2 id="mobile-section-hub-title">{t('What would you like to manage?')}</h2><p>{t('Choose an area to continue.')}</p></div></div>
              <div className="mobile-section-grid">
                <button className="mobile-section-card mobile-section-card-primary" onClick={() => setPanel('menu')}><span className="mobile-section-icon"><Menu /></span><span><b>{t('Menu editor')}</b><small>{menu.items.length} {t('items')} · {menu.categories.length} {t('Categories').toLowerCase()}</small></span><DirectionalChevron /></button>
                <button className="mobile-section-card" onClick={() => { setPanel('design'); setDesignStep(1) }}><span className="mobile-section-icon"><Palette /></span><span><b>{t('Menu design')}</b><small>{t('Layout, photos and brand')}</small></span><DirectionalChevron /></button>
                <button className="mobile-section-card" onClick={openSettings}><span className="mobile-section-icon"><Settings /></span><span><b>{t('Restaurant settings')}</b><small>{t('Details, status and contact')}</small></span><DirectionalChevron /></button>
                <button className="mobile-section-card mobile-section-card-analysis" onClick={() => setPanel('analysis')}><span className="mobile-section-icon"><Eye /></span><span><b>{t('Analysis')}</b><small>{t('Menu performance and opens')}</small></span><DirectionalChevron /></button>
                <button className="mobile-section-card mobile-section-card-qr" onClick={openQr}><span className="mobile-section-icon"><QrCode /></span><span><b>{t('QR code')}</b><small>{t('Download or print your menu QR')}</small></span><DirectionalChevron /></button>
                <Link className="mobile-section-card mobile-section-card-live" to={`/m/${menu.restaurant.slug}`} target="_blank" rel="noreferrer"><span className="mobile-section-icon"><ExternalLink /></span><span><b>{t('Live menu')}</b><small>{t('See what your customers see')}</small></span><ExternalLink /></Link>
              </div>
            </section>
            <div className="overview-columns">
              <article className="dashboard-card"><div className="card-heading"><div><h2>{t('Quick actions')}</h2><p>{t('The most common menu tasks.')}</p></div></div><div className="quick-actions"><button onClick={() => { setPanel('menu'); openItem() }}><span><Plus /></span><div><b>{t('Add an item')}</b><small>{t('Name, price and size options')}</small></div><DirectionalChevron /></button><button onClick={() => { setPanel('menu'); openCategory() }}><span><Menu /></span><div><b>{t('Add a category')}</b><small>{t('Group your menu items')}</small></div><DirectionalChevron /></button><button onClick={openQr}><span><QrCode /></span><div><b>{t('Download QR code')}</b><small>{t('Ready to print and share')}</small></div><DirectionalChevron /></button></div></article>
              <article className="dashboard-card qr-preview"><div className="card-heading"><div><h2>{t('Your menu link')}</h2><p>{t('Share this link anywhere.')}</p></div></div><div className="link-preview"><span>{menuUrl.replace(/^https?:\/\//, '')}</span><Link to={`/m/${menu.restaurant.slug}`} target="_blank"><ExternalLink /></Link></div><div className="phone-mini"><div className="phone-mini-cover" style={{ backgroundColor: menu.restaurant.primary_color }}><span>{menu.restaurant.name_en.slice(0, 2).toUpperCase()}</span><b>{menu.restaurant.name_en}</b></div><div><i /><i /><i /></div></div></article>
            </div>
          </>}

          {panel === 'analysis' && <>
            <div className="page-heading analysis-page-heading"><div><span className="eyebrow"><span /> {t('Analysis')}</span><h1>{t('Customer activity.')}</h1><p>{t('See how often customers open your menu and what they can see.')}</p></div></div>
            <section className="analysis-card dashboard-card" aria-labelledby="analysis-title">
              <div className="analysis-body">
                {viewStats && <div className="overview-views"><MenuViews stats={viewStats} language={dashboardLanguage} /></div>}
                <div className="analysis-summary-heading">
                  <h2 id="analysis-title">{t('Menu summary')}</h2>
                  <p>{t('What customers can see right now.')}</p>
                </div>
                <div className="overview-grid analysis-summary-grid">
                  <article className="stat-card"><span>{t('Visible items')}</span><strong>{menu.items.filter((item) => item.available).length}</strong><small>{menu.items.length} {t('total items')}</small></article>
                  <article className="stat-card"><span>{t('Categories')}</span><strong>{menu.categories.length}</strong><small>{t('Menu sections')}</small></article>
                  <article className="stat-card analysis-subscription"><span>{subscriptionLabel}</span><strong>{subscriptionValue}</strong><small>{subscriptionNote}</small></article>
                </div>
              </div>
            </section>
          </>}

          {panel === 'menu' && <>
            <div className="page-heading menu-editor-page-heading"><div><span className="eyebrow"><span /> {t('Menu editor')}</span><h1>{t('Categories and items.')}</h1><p>{t('Changes appear on your public menu immediately.')}</p></div><div className="button-row menu-editor-actions"><button className="button button-outline" onClick={() => setImportModal(true)}><Upload /> {t('Import CSV')}</button><button className="button button-outline" onClick={() => openCategory()}><Plus /> {t('Category')}</button><button className="button button-primary" onClick={() => openItem()}><Plus /> {t('Item')}</button></div></div>
            {!menu.categories.length ? <div className="empty-card"><Store /><h2>{t('Create your first category')}</h2><p>{t('Start with Pizza, Drinks, Desserts or any section that fits your menu.')}</p><button className="button button-primary" onClick={() => openCategory()}><Plus /> {t('Add category')}</button></div> : <div className="category-list">{menu.categories.map((category, categoryIndex) => <section className="dashboard-card category-card" key={category.id}><div className="category-heading"><div><h2>{category.name_en}<small>{category.name_ar}</small></h2><span>{menu.items.filter((item) => item.category_id === category.id).length} {t('items')}</span></div><div className="category-actions"><button className="icon-button" disabled={categoryIndex === 0} onClick={() => moveCategory(category, -1)} title={t('Move category up')}><ArrowUp /></button><button className="icon-button" disabled={categoryIndex === menu.categories.length - 1} onClick={() => moveCategory(category, 1)} title={t('Move category down')}><ArrowDown /></button><button className="icon-button" onClick={() => openCategory(category)} title={t('Edit category')}><Pencil /></button><button className="icon-button danger" onClick={() => removeCategory(category)} title={t('Delete category')}><Trash2 /></button><button className="button button-small button-outline" onClick={() => openItem(category.id)}><Plus /> {t('Add item')}</button></div></div><div className="dashboard-items">{menu.items.filter((item) => item.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order).map((item, itemIndex, siblings) => <article key={item.id} className={!item.available ? 'unavailable' : ''}>
              {item.image_url ? <button type="button" className="item-icon item-icon-button" onClick={() => setImagePreview({ url: item.image_url!, name: dashboardLanguage === 'ar' ? item.name_ar : item.name_en })} aria-label={`${t('View photo')}: ${dashboardLanguage === 'ar' ? item.name_ar : item.name_en}`}><img src={item.image_url} alt="" /><Maximize2 aria-hidden="true" /></button> : <div className="item-icon">{item.name_en.slice(0, 1)}</div>}
              <div className="dashboard-item-info"><b>{item.name_en}<small>{item.name_ar}</small></b><span>{item.variants.length ? `${item.variants.length} ${t('sizes')} · ${t('from')} ${formatMoney(Math.min(...item.variants.map((variant) => variant.price)), currency)}` : formatMoney(item.price, currency)}{(item.extras?.length ?? 0) > 0 ? ` · ${item.extras.length} ${t('extras')}` : ''}</span></div><button className="visibility" onClick={() => toggleAvailability(item)}>{item.available ? <><Eye /> {t('Visible')}</> : <><EyeOff /> {t('Hidden')}</>}</button><div className="item-actions"><button className="icon-button" onClick={() => moveItem(item, -1)} disabled={itemIndex === 0} title={t('Move item up')}><ArrowUp /></button><button className="icon-button" onClick={() => moveItem(item, 1)} disabled={itemIndex === siblings.length - 1} title={t('Move item down')}><ArrowDown /></button><button className="icon-button" onClick={() => openItem(category.id, item)} title={t('Edit item')}><Pencil /></button><button className="icon-button danger" onClick={() => removeItem(item)} title={t('Delete item')}><Trash2 /></button></div></article>)}{!menu.items.some((item) => item.category_id === category.id) && <p className="empty-row">{t('No items in this category yet.')}</p>}</div></section>)}</div>}
          </>}

          {panel === 'design' && <>
            <div className="page-heading menu-design-page-heading">
              <div><span className="eyebrow"><span /> {t('Menu design')}</span><h1>{t('Choose how your menu looks.')}</h1><p>{t('Layout, photos, logo and colour. Every design shows the same items.')}</p></div>
              <button className="button button-primary design-save-button" disabled={saving || !designDirty} onClick={() => saveDesign(previewTemplate, previewColor, previewShowItemImages)}>
                {!designDirty ? t('Design in use') : saving ? t('Saving…') : t('Save design')}
              </button>
            </div>
            <div className="mobile-design-wizard" aria-label={t('Menu design steps')}>
              <div className="mobile-design-wizard-row">
                <button type="button" className="mobile-design-wizard-action" disabled={designStep === 1} onClick={() => setDesignStep((step) => Math.max(1, step - 1))}><BackChevron />{t('Back')}</button>
                <div className="mobile-design-wizard-copy"><span>{t('Step')} {designStep} {t('of')} {designSteps.length}</span><b>{t(designSteps[designStep - 1][1])}</b></div>
                <button type="button" className="mobile-design-wizard-action primary" disabled={saving || (designStep === 3 && !designDirty)} onClick={() => designStep < 3 ? setDesignStep((step) => step + 1) : void saveDesign(previewTemplate, previewColor, previewShowItemImages)}>{designStep === 3 ? (saving ? t('Saving…') : designDirty ? t('Save design') : t('Saved')) : t('Continue')}{designStep < 3 && <DirectionalChevron />}</button>
              </div>
              <div className="mobile-design-wizard-footer">
                <div className="mobile-design-wizard-track" aria-hidden="true"><span style={{ width: `${(designStep / designSteps.length) * 100}%` }} /></div>
                <button type="button" className="mobile-design-reset" disabled={!currentDesignStepDirty || saving} onClick={resetCurrentDesignStep}><RotateCcw />{t('Reset step')}</button>
              </div>
            </div>
            <div className="design-layout" data-step={designStep}>
              <div className="design-choices">
                <section className="dashboard-card brand-card">
                  <div className="card-heading"><div><h2>{t('Brand')}</h2><p>{t('Your logo, cover photo and colour, across every design.')}</p></div></div>
                  <div className="settings-brand">
                    <label className="logo-uploader" style={{ backgroundColor: previewColor }}>
                      {menu.restaurant.logo_url ? <img src={menu.restaurant.logo_url} alt="Restaurant logo" /> : menu.restaurant.name_en.slice(0, 2).toUpperCase()}
                      <input disabled={saving} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    </label>
                    <div><h2>{menu.restaurant.name_en}</h2><p>{menu.restaurant.name_ar}</p><small>{t('Tap the logo to upload a new image.')}</small></div>
                  </div>
                  <div className="cover-setting">
                    <div className="cover-setting-copy"><b>{t('Menu cover photo')}</b><small>{t('Shown behind your logo and restaurant name. Large images are resized and compressed automatically.')}</small></div>
                    <label className={`cover-uploader ${menu.restaurant.cover_image_url ? 'has-image' : ''}`} style={menu.restaurant.cover_image_url ? { backgroundImage: `linear-gradient(rgba(15,35,30,.28),rgba(15,35,30,.48)),url(${menu.restaurant.cover_image_url})` } : { backgroundColor: previewColor }}>
                      <span><ImagePlus />{saving ? t('Uploading…') : menu.restaurant.cover_image_url ? t('Replace cover') : t('Upload cover')}</span>
                      <input disabled={saving} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                    </label>
                  </div>
                  <div className="brand-color-settings">
                    <label className="brand-color-row">{t('Brand color')}<input className="settings-color" type="color" value={previewColor} onChange={(e) => setColorDraft(e.target.value)} /></label>
                    {/* Presets, not "themes": each one only sets this colour, and
                        the design beside it is the thing an owner calls a theme. */}
                    <div className="theme-presets"><b>{t('Colour presets')}</b><div>{[['#173f35', 'Cedar'], ['#b84d2f', 'Oven'], ['#7b4f34', 'Earth'], ['#244c70', 'Coast']].map(([color, name]) => <button type="button" key={color} onClick={() => setColorDraft(color)} className={previewColor === color ? 'selected' : ''}><i style={{ backgroundColor: color }} />{t(name)}</button>)}</div></div>
                  </div>
                </section>

                <section className="dashboard-card menu-photo-setting">
                  <div className="menu-photo-setting-copy">
                    <span className="menu-photo-setting-icon">{previewShowItemImages ? <Eye /> : <EyeOff />}</span>
                    <div>
                      <h2>{t('Food photos')}</h2>
                      <p>{t('Choose whether item photos appear on your public menu. Uploaded photos stay saved when hidden.')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`menu-photo-toggle ${previewShowItemImages ? 'on' : ''}`}
                    aria-pressed={previewShowItemImages}
                    onClick={toggleItemImages}
                  >
                    <span aria-hidden="true"><i /></span>
                    {previewShowItemImages ? t('Photos shown') : t('Photos hidden')}
                  </button>
                  {!previewShowItemImages && (
                    <p className="menu-photo-advice">{t('Photo-based designs are hidden. If one was selected, the menu switches to')} <b>{t('Classic')}</b> {t('before you save.')}</p>
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
                      <b>{t(template.name)}</b>
                      {liveTemplate === template.id && <em>{t('Live')}</em>}
                    </span>
                    <small>{t(template.description)}</small>
                    {template.requiresItemImages && <span className="template-photo-note">{t('Photos required')}</span>}
                    {template.scroll && <span className="template-scroll">{t(template.scroll)}</span>}
                  </button>
                ))}
                </div>
              </div>
              <aside className="template-preview">
                <div className="card-heading"><div><h2>{t('Preview your menu')}</h2><p>{t('Open the real menu full screen before you save.')}</p></div></div>
                <div className="mobile-design-summary">
                  <div><span>{t('Menu style')}</span><b>{t(selectedTemplate.name)}</b></div>
                  <div><span>{t('Food photos')}</span><b>{previewShowItemImages ? t('Photos shown') : t('Photos hidden')}</b></div>
                  <div><span>{t('Brand color')}</span><b><i style={{ backgroundColor: previewColor }} />{previewColor.toUpperCase()}</b></div>
                </div>
                <div className="preview-phone">
                  {/* Keyed so switching design reloads the frame rather than leaving the old one. */}
                  <iframe key={`${previewTemplate}|${previewColor}|${previewShowItemImages}`} title={t('Menu design preview')} scrolling="no" src={fullPreviewUrl} />
                </div>
                <Link
                  className="button button-small button-outline full mobile-preview-launch"
                  to={fullPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (!designDirty) return
                    event.preventDefault()
                    setPreviewConfirmationOpen(true)
                  }}
                >
                  {t('Open full preview')} <ExternalLink />
                </Link>
              </aside>
            </div>
          </>}

          {panel === 'settings' && <>
            <div className="page-heading restaurant-settings-page-heading"><div><span className="eyebrow"><span /> {t('Settings')}</span><h1>{t('Restaurant details.')}</h1><p>{t('Your name, contact details and menu status. Logo and colour live in Menu design.')}</p></div></div>
            <form className="dashboard-card restaurant-settings-form" data-step={settingsStep} onSubmit={saveRestaurant}>
              <div className="mobile-design-wizard mobile-settings-wizard" aria-label={t('Restaurant settings steps')}>
                <div className="mobile-design-wizard-row">
                  <button type="button" className="mobile-design-wizard-action" disabled={settingsStep === 1 || saving} onClick={() => setSettingsStep((step) => Math.max(1, step - 1))}><BackChevron />{t('Back')}</button>
                  <div className="mobile-design-wizard-copy"><span>{t('Step')} {settingsStep} {t('of')} {settingsSteps.length}</span><b>{t(settingsSteps[settingsStep - 1][1])}</b></div>
                  {settingsStep === settingsSteps.length
                    ? <button key="save-settings" type="submit" className="mobile-design-wizard-action primary" disabled={saving}>{saving ? t('Saving…') : t('Save')}</button>
                    : <button key="continue-settings" type="button" className="mobile-design-wizard-action primary" disabled={saving || (settingsStep === 1 && (!menu.restaurant.name_en.trim() || !menu.restaurant.name_ar.trim()))} onClick={() => setSettingsStep((step) => step + 1)}>{t('Continue')}<DirectionalChevron /></button>}
                </div>
                <div className="mobile-design-wizard-footer"><div className="mobile-design-wizard-track" aria-hidden="true"><span style={{ width: `${(settingsStep / settingsSteps.length) * 100}%` }} /></div></div>
              </div>
              <div className="form-grid">
                <section className={`settings-step settings-step-basic ${settingsStep === 1 ? 'active' : ''}`}>
                  <div className="settings-step-heading"><h2>{t('Basic details')}</h2><p>{t('Names and short descriptions shown on your menu.')}</p></div>
                  <label>{t('English name')}<input required value={menu.restaurant.name_en} onChange={(e) => restaurantField('name_en', e.target.value)} /></label>
                  <label>{t('Arabic name')}<input dir="rtl" required value={menu.restaurant.name_ar} onChange={(e) => restaurantField('name_ar', e.target.value)} /></label>
                  <label>{t('English tagline')}<input value={menu.restaurant.description_en ?? ''} onChange={(e) => restaurantField('description_en', e.target.value)} placeholder="Fresh from our oven" /></label>
                  <label>{t('Arabic tagline')}<input dir="rtl" value={menu.restaurant.description_ar ?? ''} onChange={(e) => restaurantField('description_ar', e.target.value)} placeholder="طازج من فرننا" /></label>
                  <div className="bilingual-preview settings-basic-preview"><div><span>{t('English preview')}</span><b style={{ color: menu.restaurant.primary_color }}>{menu.restaurant.name_en}</b><small>{menu.restaurant.description_en || 'Fresh from our oven.'}</small></div><div dir="rtl"><span>{t('Arabic preview')}</span><b style={{ color: menu.restaurant.primary_color }}>{menu.restaurant.name_ar}</b><small>{menu.restaurant.description_ar || 'طازج من فرننا.'}</small></div></div>
                </section>

                <section className={`settings-step settings-step-contact ${settingsStep === 2 ? 'active' : ''}`}>
                  <div className="settings-step-heading"><h2>{t('Contact details')}</h2><p>{t('How customers find and contact your restaurant.')}</p></div>
                  <label>{t('WhatsApp number')}<input value={menu.restaurant.whatsapp ?? ''} onChange={(e) => restaurantField('whatsapp', e.target.value)} placeholder="+961 70 123 456" /></label>
                  <label>{t('Instagram')}<input value={menu.restaurant.instagram ?? ''} onChange={(e) => restaurantField('instagram', e.target.value)} placeholder="@restaurant" /></label>
                  <label>{t('English address')}<textarea value={menu.restaurant.address_en ?? ''} onChange={(e) => restaurantField('address_en', e.target.value)} /></label>
                  <label>{t('Arabic address')}<textarea dir="rtl" value={menu.restaurant.address_ar ?? ''} onChange={(e) => restaurantField('address_ar', e.target.value)} /></label>
                </section>

                <section className={`settings-step settings-step-menu ${settingsStep === 3 ? 'active' : ''}`}>
                  <div className="settings-step-heading"><h2>{t('Menu settings')}</h2><p>{t('Currency, availability, ordering and language.')}</p></div>
                  <label>
                    {t('Menu currency')}
                    <select value={currency} onChange={(e) => restaurantField('currency', e.target.value)}>
                      <option value="LBP">{t('Lebanese pound (LBP)')}</option>
                      <option value="USD">{t('US dollar (USD)')}</option>
                    </select>
                    {/* No rate is applied on the way through: there is no honest
                        one, and rewriting every price silently would be worse
                        than asking the owner to look. */}
                    <small className="field-hint">{t('Changes the currency shown on your menu. Existing prices are not converted — check them after switching.')}</small>
                  </label>
                  <div className="settings-choice">
                    <span className="settings-choice-label">{t('Menu status')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!menu.restaurant.temporarily_closed}
                      className={`settings-switch-card ${!menu.restaurant.temporarily_closed ? 'active' : ''}`}
                      onClick={() => restaurantField('temporarily_closed', !menu.restaurant.temporarily_closed)}
                    >
                      <span className="settings-switch-copy">
                        <b>{menu.restaurant.temporarily_closed ? t('Menu is temporarily closed') : t('Menu is open')}</b>
                        <small>{menu.restaurant.temporarily_closed ? t('Customers see that you are closed.') : t('Customers can view your menu.')}</small>
                      </span>
                      <span className="settings-switch-control" aria-hidden="true"><i /></span>
                    </button>
                  </div>
                  {/* Ordering needs somewhere for the order to arrive, so the
                      switch is unavailable until a WhatsApp number exists. The
                      public menu applies the same rule independently. */}
                  <div className="settings-choice">
                    <span className="settings-choice-label">{t('Takeaway orders')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={menu.restaurant.takeaway_enabled}
                      className={`settings-switch-card ${menu.restaurant.takeaway_enabled ? 'active' : ''}`}
                      disabled={!menu.restaurant.whatsapp}
                      onClick={() => restaurantField('takeaway_enabled', !menu.restaurant.takeaway_enabled)}
                    >
                      <span className="settings-switch-copy">
                        <b>{t('Accept takeaway orders')}</b>
                        <small>{menu.restaurant.takeaway_enabled ? t('Customers can order through WhatsApp.') : t('Takeaway ordering is off.')}</small>
                      </span>
                      <span className="settings-switch-control" aria-hidden="true"><i /></span>
                    </button>
                    {!menu.restaurant.whatsapp && <small className="field-hint">{t('Add a WhatsApp number in Contact details to take takeaway orders.')}</small>}
                  </div>
                  <label>{t('Default language')}<select value={menu.restaurant.default_language} onChange={(e) => restaurantField('default_language', e.target.value)}><option value="en">{t('English')}</option><option value="ar">{t('Arabic')}</option></select></label>
                </section>
              </div>
              <button className="button button-primary restaurant-settings-save" disabled={saving}>{saving ? t('Saving…') : t('Save restaurant details')}</button>
            </form>
          </>}
        </div>
      </section>

      {imageVisibilityConfirmation !== null && <div className="modal-backdrop"><div className="modal-card image-toggle-modal" role="dialog" aria-modal="true" aria-labelledby="image-toggle-title" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><button type="button" className="modal-close" aria-label={imageConfirmationCopy.close} onClick={() => setImageVisibilityConfirmation(null)}><X /></button><span className="eyebrow"><span /> {imageConfirmationCopy.eyebrow}</span><h2 id="image-toggle-title">{imageVisibilityConfirmation ? imageConfirmationCopy.showTitle : imageConfirmationCopy.hideTitle}</h2><p>{imageVisibilityConfirmation ? imageConfirmationCopy.showDescription : imageConfirmationCopy.hideDescription}</p><div className="button-row modal-actions"><button type="button" className="button button-outline" onClick={() => setImageVisibilityConfirmation(null)}>{imageConfirmationCopy.cancel}</button><button type="button" className="button button-primary" onClick={confirmItemImages}>{imageVisibilityConfirmation ? imageConfirmationCopy.showAction : imageConfirmationCopy.hideAction}</button></div></div></div>}

      {previewConfirmationOpen && <div className="modal-backdrop"><div className="modal-card preview-save-modal" role="dialog" aria-modal="true" aria-labelledby="preview-save-title" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><button type="button" className="modal-close" aria-label={t('Close preview confirmation')} onClick={() => setPreviewConfirmationOpen(false)}><X /></button><span className="eyebrow"><span /> {t('Preview changes')}</span><h2 id="preview-save-title">{t('Save before previewing?')}</h2><p>{t('You have unsaved design changes. Save them first so your public menu uses this design, or preview without saving.')}</p><div className="button-row modal-actions preview-save-actions"><button type="button" className="button button-outline" disabled={saving} onClick={continueToPreview}>{t('Continue without saving')}</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void saveAndOpenPreview()}>{saving ? t('Saving…') : t('Save and preview')}</button></div></div></div>}

      {designExitConfirmationOpen && <div className="modal-backdrop"><div className="modal-card design-exit-modal" role="dialog" aria-modal="true" aria-labelledby="design-exit-title" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><button type="button" className="modal-close" aria-label={t('Keep editing')} disabled={saving} onClick={() => setDesignExitConfirmationOpen(false)}><X /></button><span className="eyebrow"><span /> {t('Unsaved changes')}</span><h2 id="design-exit-title">{t('Save your menu design?')}</h2><p>{t('You changed your menu design. Save it to make it live, or leave without saving and keep your current design.')}</p><div className="design-exit-actions"><button type="button" className="button button-primary" disabled={saving} onClick={() => void saveAndLeaveDesign()}>{saving ? t('Saving…') : t('Save changes')}</button><button type="button" className="button button-outline" disabled={saving} onClick={leaveDesignWithoutSaving}>{t('Leave without saving')}</button><button type="button" className="button button-ghost" disabled={saving} onClick={() => setDesignExitConfirmationOpen(false)}>{t('Keep editing')}</button></div></div></div>}

      {settingsExitConfirmationOpen && <div className="modal-backdrop"><div className="modal-card design-exit-modal" role="dialog" aria-modal="true" aria-labelledby="settings-exit-title" dir={dashboardLanguage === 'ar' ? 'rtl' : 'ltr'}><button type="button" className="modal-close" aria-label={t('Keep editing')} disabled={saving} onClick={() => setSettingsExitConfirmationOpen(false)}><X /></button><span className="eyebrow"><span /> {t('Unsaved changes')}</span><h2 id="settings-exit-title">{t('Save your restaurant details?')}</h2><p>{t('You changed your restaurant details. Save them to update your menu, or leave without saving and keep the current details.')}</p><div className="design-exit-actions"><button type="button" className="button button-primary" disabled={saving} onClick={() => void saveAndLeaveSettings()}>{saving ? t('Saving…') : t('Save changes')}</button><button type="button" className="button button-outline" disabled={saving} onClick={leaveSettingsWithoutSaving}>{t('Leave without saving')}</button><button type="button" className="button button-ghost" disabled={saving} onClick={() => setSettingsExitConfirmationOpen(false)}>{t('Keep editing')}</button></div></div></div>}

      {categoryModal && <div className="modal-backdrop"><form className="modal-card" onSubmit={saveCategory}><button type="button" className="modal-close" onClick={() => { setCategoryModal(false); setEditingCategory(null) }}><X /></button><span className="eyebrow"><span /> {editingCategory ? t('Edit section') : t('New section')}</span><h2>{editingCategory ? t('Edit category') : t('Add a category')}</h2><p>{t('Give it a name in both menu languages.')}</p><label>{t('English name')}<input required autoFocus value={categoryDraft.name_en} onChange={(e) => setCategoryDraft({ ...categoryDraft, name_en: e.target.value })} placeholder="Pizza" /></label><label>{t('Arabic name')}<input dir="rtl" required value={categoryDraft.name_ar} onChange={(e) => setCategoryDraft({ ...categoryDraft, name_ar: e.target.value })} placeholder="بيتزا" /></label><button className="button button-primary full" disabled={saving}>{saving ? t('Saving…') : editingCategory ? t('Save category') : t('Add category')}</button></form></div>}

      {itemModal && <div className="modal-backdrop"><form className="modal-card modal-large" onSubmit={saveItem}><button type="button" className="modal-close" onClick={closeItem}><X /></button><span className="eyebrow"><span /> {editingItem ? t('Edit item') : t('New item')}</span><h2>{editingItem ? t('Edit menu item') : t('Add a menu item')}</h2><div className="form-grid"><label>{t('Category')}<select required value={itemDraft.category_id} onChange={(e) => setItemDraft({ ...itemDraft, category_id: e.target.value })}><option value="">{t('Choose category')}</option>{menu.categories.map((category) => <option value={category.id} key={category.id}>{category.name_en}</option>)}</select></label><div className="item-photo-choices"><span>{t('Item photo')}</span><small className="item-photo-help">{t('Choose a photo at least 1200 × 1500 px, then crop it to a 4:5 portrait.')}</small><div className="item-photo-actions"><button type="button" className="item-photo-choice" onClick={openGallery}><Images /> {t('Fluxiva Gallery')}</button><label className="item-photo-choice upload"><ImagePlus /> {t('Upload your photo')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ''; void chooseItemPhoto(file) }} /></label></div>{itemPhotoError && <small className="item-photo-error" role="alert">{itemPhotoError}</small>}{(itemDraft.image_url || itemDraft.image_file) && <div className="item-photo-preview">{(itemFilePreviewUrl || itemDraft.image_url) && <button type="button" className="item-photo-preview-button" onClick={() => setImagePreview({ url: itemFilePreviewUrl || itemDraft.image_url || '', name: (dashboardLanguage === 'ar' ? itemDraft.name_ar : itemDraft.name_en) || t('Item photo') })} aria-label={t('View photo')}><img src={itemFilePreviewUrl || itemDraft.image_url || ''} alt="" /><Maximize2 aria-hidden="true" /></button>}<span>{itemDraft.image_file?.name || (itemDraft.gallery_image_id ? t('Selected from Fluxiva Gallery') : t('Current photo'))}</span><button type="button" onClick={() => { setItemDraft({ ...itemDraft, image_file: null, image_url: null, gallery_image_id: null }); setItemPhotoError('') }} aria-label={t('Remove photo')}><Trash2 /></button></div>}</div><label>{t('English name')}<input required value={itemDraft.name_en} onChange={(e) => setItemDraft({ ...itemDraft, name_en: e.target.value })} placeholder="Margherita" /></label><label>{t('Arabic name')}<input dir="rtl" required value={itemDraft.name_ar} onChange={(e) => setItemDraft({ ...itemDraft, name_ar: e.target.value })} placeholder="مارغريتا" /></label><label>{t('English description')}<textarea value={itemDraft.description_en} onChange={(e) => setItemDraft({ ...itemDraft, description_en: e.target.value })} placeholder="Tomato, mozzarella and basil" /></label><label>{t('Arabic description')}<textarea dir="rtl" value={itemDraft.description_ar} onChange={(e) => setItemDraft({ ...itemDraft, description_ar: e.target.value })} placeholder="طماطم، موزاريلا وريحان" /></label></div><div className="price-section"><label>{t('Base price')} ({currencyLabel})<input required={itemDraft.variants.length === 0} min="0" step={priceStep} type="number" value={itemDraft.price} onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })} placeholder={pricePlaceholder} /></label><div className="variant-title"><div><b>{t('Size options')}</b><small>{t('Optional — add sizes when prices differ.')}</small></div><button type="button" onClick={addVariant}><Plus /> {t('Add size')}</button></div>{itemDraft.variants.map((variant, index) => <div className="variant-row" key={variant.id}><input required placeholder="S" value={variant.name_en} onChange={(e) => updateVariant(index, 'name_en', e.target.value)} /><input placeholder="ص" dir="rtl" value={variant.name_ar} onChange={(e) => updateVariant(index, 'name_ar', e.target.value)} /><input required min="0" step={priceStep} type="number" placeholder={`${t('Price')} ${currencyLabel}`} value={variant.price || ''} onChange={(e) => updateVariant(index, 'price', Number(e.target.value))} /><button type="button" onClick={() => setItemDraft((current) => ({ ...current, variants: current.variants.filter((_, position) => position !== index) }))}><X /></button></div>)}<div className="extras-section"><div className="variant-title"><div><b>{t('Extras')}</b><small>{t('Optional — customers can choose more than one.')}</small></div><button type="button" onClick={addExtra}><Plus /> {t('Add extra')}</button></div>{itemDraft.extras.map((extra, index) => <div className="extra-row" key={extra.id}><input required placeholder={t('English name')} value={extra.name_en} onChange={(e) => updateExtra(index, 'name_en', e.target.value)} /><input required placeholder={t('Arabic name')} dir="rtl" value={extra.name_ar} onChange={(e) => updateExtra(index, 'name_ar', e.target.value)} /><input required min="0" step={priceStep} type="number" aria-label={`${t('Extra price')} ${currencyLabel}`} placeholder={`+ ${t('Price')} ${currencyLabel}`} value={extra.price} onChange={(e) => updateExtra(index, 'price', Number(e.target.value))} /><button type="button" onClick={() => setItemDraft((current) => ({ ...current, extras: current.extras.filter((_, position) => position !== index) }))} aria-label={t('Remove extra')}><X /></button></div>)}</div></div><button className="button button-primary full" disabled={saving || !menu.categories.length}>{saving ? t('Saving…') : editingItem ? t('Save menu item') : t('Add menu item')}</button></form></div>}
      {imagePreview && <ImageLightbox url={imagePreview.url} name={imagePreview.name} closeLabel={t('Close image preview')} loadingLabel={dashboardLanguage === 'ar' ? 'جارٍ تحميل الصورة بالحجم الكامل' : 'Loading full-size image'} onClose={() => setImagePreview(null)} />}
      {galleryOpen && <GalleryPicker images={galleryImages} categories={galleryCategories} language={dashboardLanguage} loading={galleryLoading} selectedId={itemDraft.gallery_image_id} onSelect={(image) => { setItemDraft({ ...itemDraft, image_url: image.image_url, gallery_image_id: image.id, image_file: null }); setGalleryOpen(false) }} onRemove={() => { setItemDraft({ ...itemDraft, image_url: null, gallery_image_id: null, image_file: null }); setGalleryOpen(false) }} onClose={() => setGalleryOpen(false)} />}
      {pendingItemCrop && <PortraitImageCropper file={pendingItemCrop} language={dashboardLanguage} onCancel={() => setPendingItemCrop(null)} onConfirm={acceptItemCrop} />}

      {importModal && <div className="modal-backdrop"><form className="modal-card" onSubmit={importCsv}><button type="button" className="modal-close" onClick={() => { setImportModal(false); setImportStatus(''); setImportFile(null) }}><X /></button><span className="eyebrow"><span /> {t('Bulk import')}</span><h2>{t('Import menu items')}</h2><p>{t('Upload a CSV exported from Excel or Google Sheets. Columns: category_en, category_ar, name_en, name_ar, description_en, description_ar, price, available.')}</p><label className="file-drop"><Upload /><b>{importFile?.name || t('Choose CSV file')}</b><small>{t('One item per row')}</small><input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} /></label>{importStatus && <p className="notice notice-success">{importStatus}</p>}<button className="button button-primary full" disabled={saving || !importFile}>{saving ? t('Importing…') : t('Import items')}</button></form></div>}

      {qrModal && <div className="modal-backdrop"><div className="modal-card qr-modal qr-print-area"><button className="modal-close" aria-label={t('Close')} onClick={() => setQrModal(false)}><X /></button><span className="eyebrow"><span /> {t('Ready to scan')}</span><h2>{t('Your menu QR code')}</h2><p>{t('Print it on table cards, packaging or your storefront.')}</p>{qrData && <img src={qrData} alt={t('Restaurant menu QR code')} />}<code>{menuUrl}</code><div className="qr-actions"><button className="button button-primary" onClick={downloadQr}><QrCode /> PNG</button><button className="button button-outline" onClick={downloadQrSvg}>SVG</button><button className="button button-outline" onClick={printQr}>{t('Print')}</button></div></div></div>}
    </main>
  )
}
