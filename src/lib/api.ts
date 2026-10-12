import type { Session } from '@supabase/supabase-js'
import { demoBrand, demoContactCard, demoGalleryCategories, demoGalleryImages, demoMenu, demoMenus, demoMenuViewStats, demoPlatformAudit, demoPlatformRestaurants, demoRestaurants } from './demo'
import { supabase } from './supabase'
import { subscriptionState } from './subscription'
import type { AdminRole, BrandGroup, BrandPlaces, Category, GalleryCategory, GalleryImage, ItemExtra, MenuContactCard, MenuItem, MenuViewDay, MenuViewStats, PlatformAuditEntry, PlatformRestaurant, Restaurant, RestaurantMenu, Variant } from './types'

type RestaurantInput = Pick<Restaurant, 'name_en' | 'name_ar' | 'slug' | 'primary_color' | 'phone' | 'whatsapp' | 'instagram' | 'maps_url' | 'address_en' | 'address_ar' | 'currency' | 'temporarily_closed' | 'default_language'>
type CategoryInput = Pick<Category, 'restaurant_id' | 'name_en' | 'name_ar' | 'sort_order'>
type ItemInput = Pick<MenuItem, 'restaurant_id' | 'category_id' | 'name_en' | 'name_ar' | 'description_en' | 'description_ar' | 'price' | 'image_url' | 'gallery_image_id' | 'variants' | 'extras' | 'available' | 'highlighted' | 'sort_order'>
type AssetPurpose = 'cover' | 'item' | 'logo' | 'gallery-thumb'
export type GalleryImageInput = Pick<GalleryImage, 'category_id' | 'name_en' | 'name_ar' | 'tags_en' | 'tags_ar'> & Pick<GalleryImage, 'source' | 'license_notes'>

const IMAGE_LIMITS: Record<AssetPurpose, { width: number; height: number; quality: number; maxBytes: number }> = {
  cover: { width: 1600, height: 1200, quality: 0.8, maxBytes: 420 * 1024 },
  item: { width: 1200, height: 1500, quality: 0.8, maxBytes: 340 * 1024 },
  logo: { width: 512, height: 512, quality: 0.88, maxBytes: 160 * 1024 },
  'gallery-thumb': { width: 320, height: 320, quality: 0.76, maxBytes: 80 * 1024 },
}

export const ITEM_IMAGE_WIDTH = 1200
export const ITEM_IMAGE_HEIGHT = 1500
const MIN_ITEM_SOURCE_DIMENSION = 900

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This image could not be opened.')) }
    image.src = objectUrl
  })
}

/** Item photography uses one portrait master that works naturally in the
 * mobile-first menu and Reel while still cropping safely into compact cards. */
export async function validateGallerySource(file: File) {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!supportedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be smaller than 8 MB.')
  const image = await loadImage(file)
  const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
  if (dimensions.width < MIN_ITEM_SOURCE_DIMENSION || dimensions.height < MIN_ITEM_SOURCE_DIMENSION) {
    throw new Error(`This photo is too small for a clear menu image. Choose one at least ${MIN_ITEM_SOURCE_DIMENSION} pixels wide and high. This photo is ${dimensions.width} × ${dimensions.height}.`)
  }
  return dimensions
}

export async function validateGalleryImage(file: File) {
  const dimensions = await validateGallerySource(file)
  if (dimensions.width !== ITEM_IMAGE_WIDTH || dimensions.height !== ITEM_IMAGE_HEIGHT) {
    throw new Error(`Crop item photos to exactly ${ITEM_IMAGE_WIDTH} × ${ITEM_IMAGE_HEIGHT} pixels before upload.`)
  }
  return dimensions
}

async function optimizeImage(file: File, purpose: AssetPurpose) {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!supportedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be smaller than 8 MB.')

  const image = await loadImage(file)
  const limits = IMAGE_LIMITS[purpose]
  const scale = Math.min(1, limits.width / image.naturalWidth, limits.height / image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not prepare the image.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  // Detailed food photos sometimes stay unexpectedly large at one fixed
  // quality. Step down gently only when needed so storage and diner bandwidth
  // stay predictable without penalising already-efficient images.
  let quality = limits.quality
  let blob: Blob | null = null
  do {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    quality -= 0.06
  } while (blob && blob.size > limits.maxBytes && quality >= 0.62)

  if (!blob) throw new Error('This browser could not compress the image.')
  if (scale === 1 && blob.size >= file.size) return file
  const filename = file.name.replace(/\.[^.]+$/, '') || purpose
  return new File([blob], `${filename}.webp`, { type: 'image/webp' })
}

export async function getPublicMenu(slug: string): Promise<RestaurantMenu | null> {
  if (!supabase) return demoMenus.find((menu) => menu.restaurant.slug === slug && isPublicPlace(menu.restaurant)) ?? null

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .in('subscription_status', ['trial', 'active'])
    .maybeSingle()
  if (error) throw error
  if (!restaurant || !isPublicPlace(restaurant)) return null

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order').order('id'),
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (itemsResult.error) throw itemsResult.error
  return { restaurant, categories: categoriesResult.data ?? [], items: itemsResult.data ?? [] }
}

/** Loads the lightweight branch chooser reached by a brand-level QR code. */
export async function getPublicBrand(slug: string): Promise<BrandPlaces | null> {
  if (!supabase) return ['demo', demoBrand.slug].includes(slug) ? { brand: demoBrand, restaurants: demoRestaurants.filter(isPublicPlace) } : null

  const { data: brand, error } = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  if (!brand) return null
  const { data: restaurants, error: restaurantsError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('is_published', true)
    .in('subscription_status', ['trial', 'active'])
    .order('name_en')
  if (restaurantsError) throw restaurantsError
  return { brand: brand as BrandGroup, restaurants: ((restaurants ?? []) as Restaurant[]).filter(isPublicPlace) }
}

function isPublicPlace(restaurant: Restaurant) {
  return restaurant.is_published !== false && subscriptionState(restaurant).serving
}

/**
 * Contact details for a slug whose menu is not being served. Returns null when
 * the slug does not exist at all.
 */
export async function getMenuContactCard(slug: string): Promise<MenuContactCard | null> {
  if (!supabase) return slug === 'demo' && demoRestaurants.some((restaurant) => restaurant.slug === slug && restaurant.is_published !== false) ? demoContactCard : null
  const { data, error } = await supabase.rpc('menu_contact_card', { slug_input: slug })
  if (error) return null
  const card = (data as MenuContactCard[] | null)?.[0]
  return card ?? null
}

/** Days of history the owner's analytics card reads. Two periods, for comparison. */
const VIEW_WINDOW_DAYS = 30

const isoDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)

/**
 * Records one menu open. Fire and forget: analytics must never delay the menu
 * or surface an error to a customer standing at a table.
 */
export async function recordMenuView(restaurantId: string) {
  if (!supabase) return
  try { await supabase.rpc('record_menu_view', { restaurant_id_input: restaurantId }) } catch { /* ignore */ }
}

export async function getMenuViewStats(restaurantId: string): Promise<MenuViewStats> {
  const empty: MenuViewStats = { days: [], total: 0, previousTotal: 0 }
  if (!supabase) return restaurantId.startsWith('demo-restaurant') ? demoMenuViewStats : empty

  const { data, error } = await supabase
    .from('menu_view_daily')
    .select('viewed_on, views')
    .eq('restaurant_id', restaurantId)
    .gte('viewed_on', isoDate(VIEW_WINDOW_DAYS * 2 - 1))
    .order('viewed_on')
  if (error) return empty

  const rows = (data ?? []) as MenuViewDay[]
  const cutoff = isoDate(VIEW_WINDOW_DAYS - 1)
  const byDate = new Map(rows.map((row) => [row.viewed_on, row.views]))

  // Only days with at least one open exist as rows. Charting those alone would
  // space five scattered days evenly across a month and read as steady daily
  // traffic, so the quiet days are filled back in as zero.
  const current: MenuViewDay[] = Array.from({ length: VIEW_WINDOW_DAYS }, (_, offset) => {
    const viewed_on = isoDate(VIEW_WINDOW_DAYS - 1 - offset)
    return { viewed_on, views: byDate.get(viewed_on) ?? 0 }
  })
  const previous = rows.filter((row) => row.viewed_on < cutoff)

  return {
    days: current,
    total: current.reduce((sum, row) => sum + row.views, 0),
    previousTotal: previous.reduce((sum, row) => sum + row.views, 0),
    busiestDay: current.reduce<MenuViewDay | undefined>((best, row) => !best || row.views > best.views ? row : best, undefined),
  }
}

export async function getOwnerBrand(session: Session | null): Promise<BrandGroup | null> {
  if (!supabase) return demoBrand
  if (!session) return null
  const { data, error } = await supabase.from('brands').select('*').eq('owner_id', session.user.id).maybeSingle()
  if (error) throw error
  return data as BrandGroup | null
}

export async function getOwnerRestaurants(session: Session | null): Promise<Restaurant[]> {
  if (!supabase) return [...demoRestaurants]
  if (!session) return []
  const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).order('created_at')
  if (error) throw error
  return (data ?? []) as Restaurant[]
}

export async function getOwnerMenu(session: Session | null, restaurantId?: string): Promise<RestaurantMenu | null> {
  if (!supabase) return demoMenus.find((entry) => entry.restaurant.id === restaurantId) ?? demoMenus[0]
  if (!session) return null
  let query = supabase.from('restaurants').select('*').eq('owner_id', session.user.id)
  if (restaurantId) query = query.eq('id', restaurantId)
  const { data: restaurant, error } = await query.order('created_at').limit(1).maybeSingle()
  if (error) throw error
  if (!restaurant) return null
  const [categories, items] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order').order('id'),
  ])
  if (categories.error) throw categories.error
  if (items.error) throw items.error
  return { restaurant, categories: categories.data ?? [], items: items.data ?? [] }
}

async function ensureOwnerBrand(session: Session, input: RestaurantInput) {
  const existing = await getOwnerBrand(session)
  if (existing) return existing
  const { data, error } = await supabase!.from('brands').insert({
    owner_id: session.user.id,
    slug: input.slug,
    name_en: input.name_en,
    name_ar: input.name_ar,
    primary_color: input.primary_color,
    default_language: input.default_language,
  }).select().single()
  if (error?.code === '23505') throw new Error('This brand link is already taken. Choose a different one.')
  if (error) throw error
  return data as BrandGroup
}

export async function createRestaurant(session: Session | null, input: RestaurantInput, brandId?: string) {
  if (!supabase) {
    if (demoRestaurants.some((place) => place.slug === input.slug)) throw new Error('This menu link is already taken. Choose a different one.')
    const restaurant: Restaurant = {
      ...input,
      id: crypto.randomUUID(),
      brand_id: demoBrand.id,
      is_published: true,
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    }
    demoRestaurants.push(restaurant)
    demoMenus.push({ restaurant, categories: [], items: [] })
    return restaurant
  }
  if (!session) throw new Error('Sign in to add a place.')
  const brand = brandId ? { id: brandId } : await ensureOwnerBrand(session, input)
  const { data, error } = await supabase.from('restaurants').insert({
    ...input,
    owner_id: session.user.id,
    brand_id: brand.id,
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  }).select().single()
  if (error?.code === '23505') throw new Error('This menu link is already taken. Choose a different one.')
  if (error) throw error
  return data as Restaurant
}

/** Creates a hidden independent menu, then copies personal assets before it is
 * ready to edit. Shared active gallery files stay shared; source files are never
 * deleted or modified. All writes use the signed-in owner's normal permissions. */
export async function createPlaceFromMenu(session: Session | null, input: RestaurantInput, sourceId: string): Promise<RestaurantMenu> {
  if (!supabase) {
    const source = demoMenus.find((entry) => entry.restaurant.id === sourceId)
    if (!source || source.restaurant.menu_copy_pending) throw new Error('Could not copy this menu. Please try again.')
    // Blob URLs represent owner-uploaded photos in offline mode. Give the copy
    // its own URLs so replacing/removing a source photo cannot revoke both.
    const assetUrls = new Map<string, string>()
    let restaurant: Restaurant
    try {
      const urls = new Set([source.restaurant.logo_url, source.restaurant.cover_image_url, ...source.items.map((item) => item.image_url)])
      for (const url of urls) if (url?.startsWith('blob:')) {
        const response = await fetch(url)
        if (!response.ok) throw new Error('Could not copy this menu. Please try again.')
        assetUrls.set(url, URL.createObjectURL(await response.blob()))
      }
      restaurant = await createRestaurant(session, input, source.restaurant.brand_id)
    } catch (caught) {
      assetUrls.forEach((url) => URL.revokeObjectURL(url))
      throw caught
    }
    const { description_en, description_ar, logo_url, cover_image_url, primary_color, instagram, currency, default_language, template_id, show_item_images, takeaway_enabled } = source.restaurant
    Object.assign(restaurant, { description_en, description_ar, logo_url, cover_image_url, primary_color, instagram, currency, default_language, template_id, show_item_images, takeaway_enabled, temporarily_closed: false, is_published: false, menu_copy_pending: false })
    restaurant.logo_url = assetUrls.get(logo_url ?? '') ?? logo_url
    restaurant.cover_image_url = assetUrls.get(cover_image_url ?? '') ?? cover_image_url
    const categoryIds = new Map(source.categories.map((category) => [category.id, crypto.randomUUID()]))
    const copied: RestaurantMenu = {
      restaurant,
      categories: source.categories.map((category) => ({ ...structuredClone(category), id: categoryIds.get(category.id)!, restaurant_id: restaurant.id })),
      items: source.items.map((item) => ({ ...structuredClone(item), image_url: assetUrls.get(item.image_url ?? '') ?? item.image_url, id: crypto.randomUUID(), restaurant_id: restaurant.id, category_id: categoryIds.get(item.category_id)! })),
    }
    Object.assign(demoMenus.find((entry) => entry.restaurant.id === restaurant.id)!, copied)
    return structuredClone(copied)
  }
  if (!session) throw new Error('Sign in to add a place.')
  const client = supabase
  const { data, error } = await client.rpc('owner_create_place_with_menu', { source_restaurant_id_input: sourceId, place_input: input })
  if (error?.code === '23505') throw new Error('This menu link is already taken. Choose a different one.')
  if (error?.code === 'PGRST202') throw new Error('Menu copying is not ready yet. Please contact support.')
  if (error) throw error
  const copied = data as RestaurantMenu
  const target = copied.restaurant
  const attemptedPaths: string[] = []
  try {
    const urls = new Set([target.logo_url, target.cover_image_url, ...copied.items.filter((item) => !item.gallery_image_id).map((item) => item.image_url)])
    const assetUrls: Record<string, string> = {}
    // Sequential copies bound requests/memory on large menus. Repeated photos
    // are copied once per new branch, without downloading or recompressing them.
    for (const url of urls) {
      if (!url) continue
      const asset = restaurantCopyAsset(url)
      if (!asset) continue
      const extension = asset.path.split('.').pop()?.match(/^(?:jpe?g|png|webp)$/i)?.[0] ?? 'webp'
      const path = `${target.id}/copy-${crypto.randomUUID()}.${extension}`
      // Track before requesting: a lost response may still have created a file.
      attemptedPaths.push(path)
      const result = await client.storage.from(asset.bucket).copy(asset.path, path, { destinationBucket: 'menu-assets' })
      if (result.error) throw result.error
      assetUrls[url] = client.storage.from('menu-assets').getPublicUrl(path).data.publicUrl
    }
    const finished = await client.rpc('owner_finish_place_menu_copy', { restaurant_id_input: target.id, asset_urls_input: assetUrls })
    if (finished.error) throw finished.error
    return finished.data as RestaurantMenu
  } catch (caught) {
    // Remove only this attempt's files, while Storage RLS still sees its row.
    if (attemptedPaths.length) {
      try { await client.storage.from('menu-assets').remove(attemptedPaths) } catch { /* best-effort asset cleanup */ }
    }
    try { await deleteRestaurant(target.id, target.slug) } catch {
      throw new Error('The copy could not finish. Refresh your places and delete the hidden incomplete branch before trying again.')
    }
    throw caught
  }
}

function restaurantCopyAsset(publicUrl: string): { bucket: 'menu-assets' | 'gallery-assets'; path: string } | null {
  if (!supabase) return null
  try {
    const url = new URL(publicUrl)
    const origin = new URL(supabase.storage.from('menu-assets').getPublicUrl('').data.publicUrl).origin
    if (url.origin !== origin) return null
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/(menu-assets|gallery-assets)\/(.+)$/)
    if (!match) return null
    const path = decodeURIComponent(match[2])
    if (path.includes('..')) throw new Error('Could not copy this menu. Please try again.')
    return { bucket: match[1] as 'menu-assets' | 'gallery-assets', path }
  } catch { return null }
}

export async function updateRestaurant(id: string, values: Partial<Restaurant>) {
  if (!supabase) {
    const restaurant = demoRestaurants.find((place) => place.id === id)
    if (restaurant) Object.assign(restaurant, values)
    return
  }
  const { error } = await supabase.from('restaurants').update(values).eq('id', id)
  if (error) throw error
}

/** Persist before changing dashboard state; owners retain access to hidden places. */
export async function setPlacePublished(id: string, published: boolean): Promise<Restaurant> {
  if (!supabase) {
    const restaurant = demoRestaurants.find((place) => place.id === id)
    if (!restaurant) throw new Error('Could not update branch visibility.')
    if (published && restaurant.menu_copy_pending) throw new Error('Could not update branch visibility.')
    restaurant.is_published = published
    return { ...restaurant }
  }
  const { data, error } = await supabase.from('restaurants').update({ is_published: published }).eq('id', id).select().single()
  if (error) throw error
  return data as Restaurant
}

/** The RPC checks ownership, the typed slug, and the last-place guard atomically. */
export async function deleteRestaurant(id: string, slugConfirmation: string) {
  if (!supabase) {
    const index = demoRestaurants.findIndex((place) => place.id === id && place.slug === slugConfirmation)
    if (index < 0) throw new Error('The menu link does not match.')
    if (demoRestaurants.length <= 1) throw new Error('Keep at least one place. Hide it instead.')
    demoRestaurants.splice(index, 1)
    const menuIndex = demoMenus.findIndex((entry) => entry.restaurant.id === id)
    if (menuIndex >= 0) demoMenus.splice(menuIndex, 1)
    return
  }
  const { error } = await supabase.rpc('owner_delete_place', { restaurant_id_input: id, slug_confirmation: slugConfirmation })
  if (error) throw error
}

/** Stores the owner's chosen public menu design. */
export async function setRestaurantTemplate(id: string, templateId: string) {
  return updateRestaurant(id, { template_id: templateId })
}

export async function createCategory(input: CategoryInput) {
  if (!supabase) {
    const category = { ...input, id: crypto.randomUUID() } as Category
    demoMenus.find((entry) => entry.restaurant.id === input.restaurant_id)?.categories.push(structuredClone(category))
    return category
  }
  const { data, error } = await supabase.from('menu_categories').insert(input).select().single()
  if (error) throw error
  return data as Category
}

/** Keeps spreadsheet imports to one category insert instead of one request per row. */
export async function createCategories(inputs: CategoryInput[]) {
  if (!inputs.length) return []
  if (!supabase) return Promise.all(inputs.map(createCategory))
  const { data, error } = await supabase.from('menu_categories').insert(inputs).select()
  if (error) throw error
  return data as Category[]
}

export async function updateCategory(id: string, values: Partial<Category>) {
  if (!supabase) {
    const category = demoMenus.flatMap((entry) => entry.categories).find((entry) => entry.id === id)
    if (category) Object.assign(category, structuredClone(values))
    return
  }
  const { error } = await supabase.from('menu_categories').update(values).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string) {
  if (!supabase) {
    for (const entry of demoMenus) {
      entry.categories = entry.categories.filter((category) => category.id !== id)
      entry.items = entry.items.filter((item) => item.category_id !== id)
    }
    return
  }
  const { error } = await supabase.from('menu_categories').delete().eq('id', id)
  if (error) throw error
}

export async function createItem(input: ItemInput) {
  if (!supabase) {
    const item = { ...structuredClone(input), id: crypto.randomUUID(), highlighted: input.highlighted ?? false } as MenuItem
    demoMenus.find((entry) => entry.restaurant.id === input.restaurant_id)?.items.push(structuredClone(item))
    return item
  }
  const { data, error } = await supabase.from('menu_items').insert(input).select().single()
  if (error) throw error
  return data as MenuItem
}

/** Inserts an already-validated workbook in one owner-scoped request. */
export async function createItems(inputs: ItemInput[]) {
  if (!inputs.length) return []
  if (!supabase) return Promise.all(inputs.map(createItem))
  const { data, error } = await supabase.from('menu_items').insert(inputs).select()
  if (error) throw error
  return data as MenuItem[]
}

export async function updateItem(id: string, values: Partial<MenuItem>) {
  if (!supabase) {
    const item = demoMenus.flatMap((entry) => entry.items).find((entry) => entry.id === id)
    if (item) Object.assign(item, structuredClone(values))
    return
  }
  const { error } = await supabase.from('menu_items').update(values).eq('id', id)
  if (error) throw error
}

/** Moves only this item; all other items keep their relative category order. */
export async function moveItemToEdge(restaurantId: string, categoryId: string, itemId: string, edge: 'top' | 'bottom'): Promise<number> {
  const demo = !supabase ? demoMenus.find((menu) => menu.restaurant.id === restaurantId) : undefined
  let siblings: Pick<MenuItem, 'id' | 'sort_order'>[]
  if (!supabase) {
    siblings = demo?.items.filter((item) => item.category_id === categoryId) ?? []
  } else {
    const { data, error } = await supabase.from('menu_items').select('id, sort_order')
      .eq('restaurant_id', restaurantId).eq('category_id', categoryId).order('sort_order').order('id')
    if (error) throw error
    siblings = data ?? []
  }
  siblings = [...siblings].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  const item = siblings.find((entry) => entry.id === itemId)
  if (!item) throw new Error('Item not found in this category.')
  const boundary = edge === 'top' ? siblings[0] : siblings[siblings.length - 1]
  if (boundary.id === itemId) return item.sort_order
  const sortOrder = boundary.sort_order + (edge === 'top' ? -1 : 1)
  if (sortOrder < -2147483648 || sortOrder > 2147483647) throw new Error('Could not reorder menu items.')
  if (!supabase) {
    item.sort_order = sortOrder
    // Public demo reads share this runtime menu and must see the saved order.
    demo!.items = [...demo!.items].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    return sortOrder
  }
  const { data, error } = await supabase.from('menu_items').update({ sort_order: sortOrder })
    .eq('restaurant_id', restaurantId).eq('category_id', categoryId).eq('id', itemId).select('sort_order').single()
  if (error) throw error
  return data.sort_order as number
}

/** Uses existing owner RLS and confirms that a matching item was updated. */
export async function setItemHighlighted(restaurantId: string, id: string, highlighted: boolean): Promise<boolean> {
  if (!supabase) {
    const item = demoMenus.find((entry) => entry.restaurant.id === restaurantId)?.items.find((entry) => entry.id === id)
    if (!item) throw new Error('Item not found.')
    item.highlighted = highlighted
    return highlighted
  }
  const { data, error } = await supabase.from('menu_items').update({ highlighted })
    .eq('restaurant_id', restaurantId).eq('id', id).select('highlighted').single()
  if (error) throw error
  return data.highlighted as boolean
}

export async function deleteItem(id: string) {
  if (!supabase) {
    for (const entry of demoMenus) entry.items = entry.items.filter((item) => item.id !== id)
    return
  }
  const { error } = await supabase.from('menu_items').delete().eq('id', id)
  if (error) throw error
}

export async function uploadRestaurantAsset(restaurantId: string, file: File, purpose: AssetPurpose = 'item') {
  const optimizedFile = await optimizeImage(file, purpose)
  if (!supabase) return URL.createObjectURL(optimizedFile)
  const extension = optimizedFile.name.split('.').pop() || 'webp'
  const path = `${restaurantId}/${purpose}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('menu-assets').upload(path, optimizedFile, { contentType: optimizedFile.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('menu-assets').getPublicUrl(path).data.publicUrl
}

/**
 * Removes only assets generated inside this restaurant's own Storage folder.
 * External URLs and bundled demo images are deliberately ignored.
 */
export async function deleteRestaurantAsset(restaurantId: string, publicUrl?: string | null) {
  if (!publicUrl) return
  if (publicUrl.startsWith('blob:')) {
    const referenced = demoMenus.some((entry) => entry.restaurant.logo_url === publicUrl || entry.restaurant.cover_image_url === publicUrl || entry.items.some((item) => item.image_url === publicUrl))
    if (!referenced) URL.revokeObjectURL(publicUrl)
    return
  }
  if (!supabase) return

  const marker = '/storage/v1/object/public/menu-assets/'
  let path = ''
  try {
    const assetUrl = new URL(publicUrl)
    if (assetUrl.origin !== new URL(supabase.storage.from('menu-assets').getPublicUrl('').data.publicUrl).origin) return
    const pathname = assetUrl.pathname
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex < 0) return
    path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
  } catch {
    return
  }

  if (path.split('/')[0] !== restaurantId || path.includes('..')) return
  // A menu copy may reuse one copied file for several items. Only remove the
  // file after the last saved reference is gone; also preserve brand QR logos.
  const [items, restaurant, brands] = await Promise.all([
    supabase.from('menu_items').select('id').eq('image_url', publicUrl).limit(1),
    supabase.from('restaurants').select('logo_url, cover_image_url').eq('id', restaurantId).maybeSingle(),
    supabase.from('brands').select('id').eq('logo_url', publicUrl).limit(1),
  ])
  if (items.error) throw items.error
  if (restaurant.error) throw restaurant.error
  if (brands.error) throw brands.error
  if (items.data?.length || brands.data?.length || restaurant.data?.logo_url === publicUrl || restaurant.data?.cover_image_url === publicUrl) return
  const { error } = await supabase.storage.from('menu-assets').remove([path])
  if (error) throw error
}

/**
 * The signed-in user's operator role, or null for everyone else.
 *
 * Demo mode has no Supabase and therefore no real data to protect, so it opens
 * the console to make the operator tooling demonstrable.
 */
export async function getAdminRole(): Promise<AdminRole | null> {
  if (!supabase) return 'super_admin'
  const { data, error } = await supabase.rpc('platform_admin_role')
  // A failure here means "not an operator" as far as the UI is concerned; the
  // database rejects the privileged calls regardless of what this returns.
  if (error) return null
  return (data as AdminRole | null) ?? null
}

export async function listPlatformRestaurants(): Promise<PlatformRestaurant[]> {
  if (!supabase) return demoPlatformRestaurants
  const { data, error } = await supabase.rpc('platform_list_restaurants')
  if (error) throw error
  return (data ?? []) as PlatformRestaurant[]
}

export async function getPlatformAudit(limit = 50): Promise<PlatformAuditEntry[]> {
  if (!supabase) return demoPlatformAudit
  const { data, error } = await supabase.rpc('platform_audit', { limit_input: limit })
  if (error) throw error
  return (data ?? []) as PlatformAuditEntry[]
}

/**
 * Passing a null `endsAt` for an activation lets the database extend from the
 * existing renewal date, so renewing early does not discard remaining time.
 */
export async function setSubscription(restaurantId: string, status: Restaurant['subscription_status'], endsAt: string | null) {
  if (!supabase) return
  const { error } = await supabase.rpc('platform_set_subscription', {
    restaurant_id_input: restaurantId,
    status_input: status,
    ends_at_input: endsAt,
  })
  if (error) throw error
}

/** Active, owner-safe gallery records. Provenance stays inside the console. */
export async function listGalleryImages(): Promise<GalleryImage[]> {
  if (!supabase) return demoGalleryImages.filter((image) => image.active).map((image) => ({
    id: image.id, category_id: image.category_id, name_en: image.name_en, name_ar: image.name_ar,
    category_en: image.category_en, category_ar: image.category_ar,
    tags_en: image.tags_en, tags_ar: image.tags_ar, image_url: image.image_url,
    thumbnail_url: image.thumbnail_url, active: image.active,
    created_at: image.created_at, updated_at: image.updated_at,
  }))
  const { data, error } = await supabase.rpc('list_gallery_images')
  if (error) throw error
  return (data ?? []) as GalleryImage[]
}

export async function listGalleryCategories(): Promise<GalleryCategory[]> {
  if (!supabase) return demoGalleryCategories.filter((category) => category.active).map((category) => ({
    ...category,
    image_count: demoGalleryImages.filter((image) => image.active && image.category_id === category.id).length,
  }))
  const { data, error } = await supabase.rpc('list_gallery_categories')
  if (error) throw error
  return (data ?? []) as GalleryCategory[]
}

export async function listPlatformGalleryImages(categoryId?: string): Promise<GalleryImage[]> {
  if (!supabase) {
    const images = categoryId ? demoGalleryImages.filter((image) => image.category_id === categoryId) : demoGalleryImages
    return structuredClone(images)
  }
  const result = categoryId
    ? await supabase.rpc('platform_list_gallery_images', { category_id_input: categoryId })
    : await supabase.rpc('platform_list_gallery_images')
  const { data, error } = result
  if (error) throw error
  return (data ?? []) as GalleryImage[]
}

export async function listPlatformGalleryCategories(): Promise<GalleryCategory[]> {
  if (!supabase) return demoGalleryCategories.map((category) => ({
    ...structuredClone(category),
    image_count: demoGalleryImages.filter((image) => image.category_id === category.id).length,
  }))
  const { data, error } = await supabase.rpc('platform_list_gallery_categories')
  if (error) throw error
  return (data ?? []) as GalleryCategory[]
}

/** Uploads one shared original and one browsing thumbnail under a gallery UUID. */
export async function uploadGalleryAssets(categoryId: string, id: string, file: File) {
  await validateGalleryImage(file)
  const [full, thumbnail] = await Promise.all([optimizeImage(file, 'item'), optimizeImage(file, 'gallery-thumb')])
  if (!supabase) return { image_url: URL.createObjectURL(full), thumbnail_url: URL.createObjectURL(thumbnail) }
  const fullExtension = full.name.split('.').pop() || 'webp'
  const thumbExtension = thumbnail.name.split('.').pop() || 'webp'
  const fullPath = `${categoryId}/${id}/full.${fullExtension}`
  const thumbnailPath = `${categoryId}/${id}/thumbnail.${thumbExtension}`
  const fullResult = await supabase.storage.from('gallery-assets').upload(fullPath, full, { contentType: full.type, cacheControl: '31536000' })
  if (fullResult.error) throw fullResult.error
  const thumbnailResult = await supabase.storage.from('gallery-assets').upload(thumbnailPath, thumbnail, { contentType: thumbnail.type, cacheControl: '31536000' })
  if (thumbnailResult.error) {
    await supabase.storage.from('gallery-assets').remove([fullPath])
    throw thumbnailResult.error
  }
  return {
    image_url: supabase.storage.from('gallery-assets').getPublicUrl(fullPath).data.publicUrl,
    thumbnail_url: supabase.storage.from('gallery-assets').getPublicUrl(thumbnailPath).data.publicUrl,
  }
}

export async function createGalleryImage(id: string, input: GalleryImageInput, urls: Pick<GalleryImage, 'image_url' | 'thumbnail_url'>): Promise<GalleryImage> {
  if (!supabase) {
    const category = demoGalleryCategories.find((entry) => entry.id === input.category_id)
    if (!category?.active) throw new Error('Choose an active gallery folder.')
    const image: GalleryImage = { id, ...input, category_en: category.name_en, category_ar: category.name_ar, ...urls, active: true, usage_count: 0, created_at: new Date().toISOString() }
    demoGalleryImages.unshift(image)
    return image
  }
  const { data, error } = await supabase.rpc('platform_create_gallery_image', {
    id_input: id, category_id_input: input.category_id, name_en_input: input.name_en, name_ar_input: input.name_ar,
    tags_en_input: input.tags_en, tags_ar_input: input.tags_ar,
    image_url_input: urls.image_url, thumbnail_url_input: urls.thumbnail_url,
    source_input: input.source ?? '', license_notes_input: input.license_notes ?? '',
  })
  if (error) throw error
  return { ...(data as GalleryImage), usage_count: 0 }
}

export async function updateGalleryImage(id: string, input: GalleryImageInput & { active: boolean }) {
  if (!supabase) {
    const image = demoGalleryImages.find((entry) => entry.id === id)
    if (image) Object.assign(image, input, { updated_at: new Date().toISOString() })
    return
  }
  const { error } = await supabase.rpc('platform_update_gallery_image', {
    id_input: id, category_id_input: input.category_id, name_en_input: input.name_en, name_ar_input: input.name_ar,
    tags_en_input: input.tags_en, tags_ar_input: input.tags_ar,
    source_input: input.source ?? '', license_notes_input: input.license_notes ?? '', active_input: input.active,
  })
  if (error) throw error
}

export async function createGalleryCategory(input: Pick<GalleryCategory, 'name_en' | 'name_ar' | 'sort_order'>): Promise<GalleryCategory> {
  if (!supabase) {
    const category: GalleryCategory = { id: crypto.randomUUID(), ...input, active: true, image_count: 0, created_at: new Date().toISOString() }
    demoGalleryCategories.push(category)
    return category
  }
  const { data, error } = await supabase.rpc('platform_create_gallery_category', {
    name_en_input: input.name_en, name_ar_input: input.name_ar, sort_order_input: input.sort_order,
  })
  if (error) throw error
  return { ...(data as GalleryCategory), image_count: 0 }
}

export async function updateGalleryCategory(id: string, input: Pick<GalleryCategory, 'name_en' | 'name_ar' | 'active' | 'sort_order'>) {
  if (!supabase) {
    const category = demoGalleryCategories.find((entry) => entry.id === id)
    if (category) Object.assign(category, input, { updated_at: new Date().toISOString() })
    for (const image of demoGalleryImages.filter((entry) => entry.category_id === id)) {
      image.category_en = input.name_en; image.category_ar = input.name_ar
    }
    return
  }
  const { error } = await supabase.rpc('platform_update_gallery_category', {
    id_input: id, name_en_input: input.name_en, name_ar_input: input.name_ar,
    active_input: input.active, sort_order_input: input.sort_order,
  })
  if (error) throw error
}

export async function deleteGalleryCategory(category: GalleryCategory) {
  if (!supabase) {
    if (demoGalleryImages.some((image) => image.category_id === category.id)) throw new Error('Move or delete the images in this folder first.')
    const index = demoGalleryCategories.findIndex((entry) => entry.id === category.id)
    if (index >= 0) demoGalleryCategories.splice(index, 1)
    return
  }
  const { error } = await supabase.rpc('platform_delete_gallery_category', { id_input: category.id })
  if (error) throw error
}

/** Removes gallery storage only after the database confirms there are no uses. */
export async function deleteGalleryImage(image: GalleryImage) {
  if (!supabase) {
    if (image.usage_count) throw new Error('This image is still used by menu items. Archive it instead.')
    const index = demoGalleryImages.findIndex((entry) => entry.id === image.id)
    if (index >= 0) demoGalleryImages.splice(index, 1)
    for (const url of [image.image_url, image.thumbnail_url]) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    return
  }
  const { error } = await supabase.rpc('platform_delete_gallery_image', { id_input: image.id })
  if (error) throw error
  await supabase.storage.from('gallery-assets').remove([
    galleryStoragePath(image.image_url), galleryStoragePath(image.thumbnail_url),
  ].filter((path): path is string => Boolean(path)))
}

/**
 * Removes the curated gallery as a deliberate admin-only reset. The RPC clears
 * every linked menu item before deleting gallery records; this client then
 * removes only the matching files from the separate shared-assets bucket.
 */
export async function clearGalleryImages(images: GalleryImage[]) {
  if (!supabase) {
    for (const item of demoMenu.items) {
      if (item.gallery_image_id) {
        item.gallery_image_id = null
        item.image_url = null
      }
    }
    for (const image of demoGalleryImages) {
      for (const url of [image.image_url, image.thumbnail_url]) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
    const deletedCount = demoGalleryImages.length
    demoGalleryImages.splice(0, demoGalleryImages.length)
    return deletedCount
  }

  const { data, error } = await supabase.rpc('platform_clear_gallery_images')
  if (error) throw error

  const paths = [...new Set(images.flatMap((image) => [
    galleryStoragePath(image.image_url), galleryStoragePath(image.thumbnail_url),
  ].filter((path): path is string => Boolean(path))))]
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from('gallery-assets').remove(paths)
    if (storageError) {
      throw new Error(`Gallery records and menu references were cleared, but some stored files could not be removed: ${storageError.message}`)
    }
  }
  return Number(data ?? images.length)
}

export async function discardGalleryAssets(id: string, urls?: Partial<Pick<GalleryImage, 'image_url' | 'thumbnail_url'>>) {
  if (!supabase) {
    for (const url of [urls?.image_url, urls?.thumbnail_url]) if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    return
  }
  const paths = urls
    ? [galleryStoragePath(urls.image_url), galleryStoragePath(urls.thumbnail_url)].filter((path): path is string => Boolean(path))
    : []
  if (paths.length) await supabase.storage.from('gallery-assets').remove(paths)
}

function galleryStoragePath(publicUrl?: string) {
  if (!publicUrl) return null
  const marker = '/storage/v1/object/public/gallery-assets/'
  try {
    const pathname = new URL(publicUrl).pathname
    const index = pathname.indexOf(marker)
    const path = index >= 0 ? decodeURIComponent(pathname.slice(index + marker.length)) : ''
    return path && !path.includes('..') ? path : null
  } catch { return null }
}

export function cleanVariants(variants: Variant[]) {
  return variants
    .filter((variant) => variant.name_en.trim() && variant.price > 0)
    .map((variant) => ({ id: variant.id, name_en: variant.name_en.trim(), price: variant.price }))
}

export function cleanExtras(extras: ItemExtra[]) {
  return extras
    .filter((extra) => extra.name_en.trim() && extra.name_ar.trim() && extra.price >= 0)
    .map((extra) => ({
      id: extra.id ?? crypto.randomUUID(),
      name_en: extra.name_en.trim(),
      name_ar: extra.name_ar.trim(),
      price: extra.price,
    }))
}
