import type { Session } from '@supabase/supabase-js'
import { demoBrand, demoContactCard, demoGalleryCategories, demoGalleryImages, demoMenu, demoMenus, demoMenuViewStats, demoPlatformAudit, demoPlatformRestaurants, demoRestaurants } from './demo'
import { supabase } from './supabase'
import { getCachedOwnerQueryClient, getOwnerQueryClient, ownerCacheGeneration } from './queryClient'
import { patchMenuItem } from './menuState'
import { subscriptionState } from './subscription'
import type { AdminRole, BrandGroup, BrandPlaces, Category, GalleryCategory, GalleryImage, ItemExtra, MenuContactCard, MenuItem, MenuViewDay, MenuViewStats, PlatformAuditEntry, PlatformRestaurant, Restaurant, RestaurantMenu, Variant } from './types'
import type { CashCollections, CashPaymentPreview, CashPaymentRequest, ShopBilling, SubscriberPage } from './types'

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

const readSignal = (signal?: AbortSignal) => signal
  ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
  : AbortSignal.timeout(15_000)

const CATEGORY_COLUMNS = 'id,restaurant_id,name_en,name_ar,sort_order'
const ITEM_COLUMNS = 'id,restaurant_id,category_id,name_en,name_ar,description_en,description_ar,price,image_url,gallery_image_id,variants,extras,available,highlighted,sort_order'
const RESTAURANT_COLUMNS = 'id,owner_id,brand_id,slug,name_en,name_ar,description_en,description_ar,logo_url,cover_image_url,primary_color,phone,whatsapp,instagram,maps_url,address_en,address_ar,currency,temporarily_closed,is_published,menu_copy_pending,template_id,show_item_images,takeaway_enabled,default_language,subscription_status,trial_ends_at,subscription_ends_at'
const MENU_COLUMNS = `${RESTAURANT_COLUMNS},categories:menu_categories(${CATEGORY_COLUMNS}),items:menu_items(${ITEM_COLUMNS})`
const orderRows = <T extends { sort_order: number; id: string }>(rows: T[]) => [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))

/** One response contains the restaurant and both ordered child collections, under RLS. */
function unpackMenu(data: Restaurant & { categories: Category[]; items: MenuItem[] }): RestaurantMenu {
  const { categories, items, ...restaurant } = data
  return { restaurant, categories: orderRows(categories ?? []), items: orderRows(items ?? []) }
}

export async function getPublicMenu(slug: string, signal?: AbortSignal): Promise<RestaurantMenu | null> {
  if (!supabase) return demoMenus.find((menu) => menu.restaurant.slug === slug && isPublicPlace(menu.restaurant)) ?? null
  const { data, error } = await supabase.from('restaurants').select(MENU_COLUMNS)
    .eq('slug', slug).eq('is_published', true).in('subscription_status', ['trial', 'active'])
    .abortSignal(readSignal(signal)).maybeSingle()
  if (error) throw error
  if (!data || !isPublicPlace(data as unknown as Restaurant)) return null
  return unpackMenu(data as unknown as Restaurant & { categories: Category[]; items: MenuItem[] })
}

/** Loads only the public branch-card fields in the same request as its brand. */
export async function getPublicBrand(slug: string, signal?: AbortSignal): Promise<BrandPlaces | null> {
  if (!supabase) return ['demo', demoBrand.slug].includes(slug) ? { brand: demoBrand, restaurants: demoRestaurants.filter(isPublicPlace) } : null
  const { data, error } = await supabase.from('brands')
    .select(`id,slug,name_en,name_ar,logo_url,primary_color,default_language,restaurants(id,slug,name_en,name_ar,primary_color,default_language,address_en,address_ar,temporarily_closed,is_published,subscription_status,trial_ends_at,subscription_ends_at)`)
    .eq('slug', slug).eq('restaurants.is_published', true).in('restaurants.subscription_status', ['trial', 'active'])
    .abortSignal(readSignal(signal)).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { restaurants, ...brand } = data
  return { brand: brand as BrandGroup, restaurants: (restaurants as Restaurant[]).filter(isPublicPlace).sort((a, b) => a.name_en.localeCompare(b.name_en)) }
}

function isPublicPlace(restaurant: Restaurant) {
  return restaurant.is_published !== false && subscriptionState(restaurant).serving
}

/**
 * Contact details for a slug whose menu is not being served. Returns null when
 * the slug does not exist at all.
 */
export async function getMenuContactCard(slug: string, signal?: AbortSignal): Promise<MenuContactCard | null> {
  if (!supabase) return slug === 'demo' && demoRestaurants.some((restaurant) => restaurant.slug === slug && restaurant.is_published !== false) ? demoContactCard : null
  const { data, error } = await supabase.rpc('menu_contact_card', { slug_input: slug }).abortSignal(readSignal(signal))
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

export async function getMenuViewStats(restaurantId: string, signal?: AbortSignal): Promise<MenuViewStats> {
  const empty: MenuViewStats = { days: [], total: 0, previousTotal: 0 }
  if (!supabase) return restaurantId.startsWith('demo-restaurant') ? demoMenuViewStats : empty

  const { data, error } = await supabase
    .from('menu_view_daily')
    .select('viewed_on, views')
    .eq('restaurant_id', restaurantId)
    .gte('viewed_on', isoDate(VIEW_WINDOW_DAYS * 2 - 1))
    .order('viewed_on').abortSignal(readSignal(signal))
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

export async function getOwnerBrand(session: Session | null, signal?: AbortSignal): Promise<BrandGroup | null> {
  if (!supabase) return demoBrand
  if (!session) return null
  const { data, error } = await supabase.from('brands').select('*').eq('owner_id', session.user.id).abortSignal(readSignal(signal)).maybeSingle()
  if (error) throw error
  return data as BrandGroup | null
}

export async function getOwnerRestaurants(session: Session | null, signal?: AbortSignal): Promise<Restaurant[]> {
  if (!supabase) return [...demoRestaurants]
  if (!session) return []
  const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).order('created_at').abortSignal(readSignal(signal))
  if (error) throw error
  return (data ?? []) as Restaurant[]
}

const ownerMenuKey = (session: Session | null, restaurantId?: string) => ['owner-menu', session?.user.id ?? 'demo', restaurantId ?? 'first'] as const

export function getCachedOwnerMenu(session: Session | null, restaurantId: string) {
  const cached = getCachedOwnerQueryClient()?.getQueryData<RestaurantMenu | null>(ownerMenuKey(session, restaurantId))
  return cached ? structuredClone(cached) : null
}

/** Fresh branch visits share one in-flight request and reuse data for 30 seconds. */
export async function getOwnerMenu(session: Session | null, restaurantId?: string): Promise<RestaurantMenu | null> {
  if (supabase && !session) return null
  const generation = ownerCacheGeneration()
  const queryClient = await getOwnerQueryClient()
  if (generation !== ownerCacheGeneration()) throw new Error('Account changed while loading.')
  const data = await queryClient.fetchQuery({
    queryKey: ownerMenuKey(session, restaurantId),
    queryFn: async ({ signal }) => {
      if (!supabase) return structuredClone(demoMenus.find((entry) => entry.restaurant.id === restaurantId) ?? demoMenus[0])
      let query = supabase.from('restaurants').select(MENU_COLUMNS).eq('owner_id', session!.user.id)
      if (restaurantId) query = query.eq('id', restaurantId)
      const { data, error } = await query.order('created_at').limit(1)
        .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(15_000)])).maybeSingle()
      if (error) throw error
      return data ? unpackMenu(data as unknown as Restaurant & { categories: Category[]; items: MenuItem[] }) : null
    },
  })
  return data ? structuredClone(data) : null
}

/** Patch confirmed saved data, never dashboard form drafts, into matching branches. */
function patchOwnerMenus(matches: (menu: RestaurantMenu) => boolean, change: (menu: RestaurantMenu) => RestaurantMenu) {
  const queryClient = getCachedOwnerQueryClient()
  if (!queryClient) return
  for (const [key, menu] of queryClient.getQueriesData<RestaurantMenu | null>({ queryKey: ['owner-menu'] })) {
    if (!menu || !matches(menu)) continue
    void queryClient.cancelQueries({ queryKey: key, exact: true })
    queryClient.setQueryData(key, change(structuredClone(menu)))
  }
}

function patchRestaurant(restaurant: Restaurant) {
  patchOwnerMenus((menu) => menu.restaurant.id === restaurant.id, (menu) => ({ ...menu, restaurant }))
}
function patchCategories(categories: Category[]) {
  if (!categories.length) return
  patchOwnerMenus((menu) => categories.some((category) => category.restaurant_id === menu.restaurant.id), (menu) => ({
    ...menu, categories: orderRows([...menu.categories.filter((entry) => !categories.some((category) => category.id === entry.id)), ...categories.filter((entry) => entry.restaurant_id === menu.restaurant.id)]),
  }))
}
function patchItems(items: MenuItem[]) {
  if (!items.length) return
  patchOwnerMenus((menu) => items.some((item) => item.restaurant_id === menu.restaurant.id), (menu) => ({
    ...menu, items: orderRows([...menu.items.filter((entry) => !items.some((item) => item.id === entry.id)), ...items.filter((entry) => entry.restaurant_id === menu.restaurant.id)]),
  }))
}

function patchItemFields(item: MenuItem, fields: Partial<MenuItem>) {
  const patch = Object.fromEntries(Object.keys(fields).map((key) => [key, item[key as keyof MenuItem]])) as Partial<MenuItem>
  if ('gallery_image_id' in fields) patch.image_url = item.image_url
  patchOwnerMenus((menu) => menu.restaurant.id === item.restaurant_id, (menu) => patchMenuItem(menu, item.restaurant_id, item.id, patch)!)
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
    if (!restaurant) throw new Error('Restaurant not found.')
    Object.assign(restaurant, values)
    patchRestaurant(structuredClone(restaurant))
    return structuredClone(restaurant)
  }
  const { data, error } = await supabase.from('restaurants').update(values).eq('id', id).select().single()
  if (error) throw error
  patchRestaurant(data as Restaurant)
  return data as Restaurant
}

/** Persist before changing dashboard state; owners retain access to hidden places. */
export async function setPlacePublished(id: string, published: boolean): Promise<Restaurant> {
  if (!supabase) {
    const restaurant = demoRestaurants.find((place) => place.id === id)
    if (!restaurant) throw new Error('Could not update branch visibility.')
    if (published && restaurant.menu_copy_pending) throw new Error('Could not update branch visibility.')
    restaurant.is_published = published
    patchRestaurant(structuredClone(restaurant))
    return { ...restaurant }
  }
  const { data, error } = await supabase.from('restaurants').update({ is_published: published }).eq('id', id).select().single()
  if (error) throw error
  patchRestaurant(data as Restaurant)
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
    for (const query of getCachedOwnerQueryClient()?.getQueryCache().findAll({ queryKey: ['owner-menu'] }) ?? []) {
      if (query.queryKey[2] === id || (query.state.data as RestaurantMenu | null)?.restaurant.id === id) {
        void getCachedOwnerQueryClient()?.cancelQueries({ queryKey: query.queryKey, exact: true })
        getCachedOwnerQueryClient()?.removeQueries({ queryKey: query.queryKey, exact: true })
      }
    }
    return
  }
  const { error } = await supabase.rpc('owner_delete_place', { restaurant_id_input: id, slug_confirmation: slugConfirmation })
  if (error) throw error
  for (const query of getCachedOwnerQueryClient()?.getQueryCache().findAll({ queryKey: ['owner-menu'] }) ?? []) {
      if (query.queryKey[2] === id || (query.state.data as RestaurantMenu | null)?.restaurant.id === id) {
        void getCachedOwnerQueryClient()?.cancelQueries({ queryKey: query.queryKey, exact: true })
        getCachedOwnerQueryClient()?.removeQueries({ queryKey: query.queryKey, exact: true })
      }
    }
}

/** Stores the owner's chosen public menu design. */
export async function setRestaurantTemplate(id: string, templateId: string) {
  return updateRestaurant(id, { template_id: templateId })
}

export async function createCategory(input: CategoryInput) {
  if (!supabase) {
    const category = { ...input, id: crypto.randomUUID() } as Category
    demoMenus.find((entry) => entry.restaurant.id === input.restaurant_id)?.categories.push(structuredClone(category))
    patchCategories([structuredClone(category)])
    return category
  }
  const { data, error } = await supabase.from('menu_categories').insert(input).select().single()
  if (error) throw error
  patchCategories([data as Category])
  return data as Category
}

/** Keeps spreadsheet imports to one category insert instead of one request per row. */
export async function createCategories(inputs: CategoryInput[]) {
  if (!inputs.length) return []
  if (!supabase) return Promise.all(inputs.map(createCategory))
  const { data, error } = await supabase.from('menu_categories').insert(inputs).select()
  if (error) throw error
  patchCategories((data ?? []) as Category[])
  return data as Category[]
}

export async function updateCategory(id: string, values: Partial<Category>) {
  if (!supabase) {
    const category = demoMenus.flatMap((entry) => entry.categories).find((entry) => entry.id === id)
    if (!category) throw new Error('Category not found.')
    Object.assign(category, structuredClone(values))
    patchCategories([structuredClone(category)])
    return structuredClone(category)
  }
  const { data, error } = await supabase.from('menu_categories').update(values).eq('id', id).select().single()
  if (error) throw error
  patchCategories([data as Category])
  return data as Category
}

/** Persists a one-position move in one batch, including any tied-rank normalization. */
export async function moveCategoryByOne(restaurantId: string, categoryId: string, direction: 'up' | 'down'): Promise<Category[]> {
  const demo = !supabase ? demoMenus.find((menu) => menu.restaurant.id === restaurantId) : undefined
  let categories: Category[]
  if (!supabase) {
    categories = demo?.categories ?? []
  } else {
    const { data, error } = await supabase.from('menu_categories').select('*')
      .eq('restaurant_id', restaurantId).order('sort_order').order('id')
    if (error) throw error
    categories = (data ?? []) as Category[]
  }
  categories = [...categories].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  const index = categories.findIndex((entry) => entry.id === categoryId)
  if (index < 0) throw new Error('Category not found in this restaurant.')
  const nextIndex = index + (direction === 'up' ? -1 : 1)
  if (nextIndex < 0 || nextIndex >= categories.length) return []
  const ranks = new Map(categories.map((entry) => [entry.id, entry.sort_order]))
  const adjacent = categories[nextIndex]
  categories[nextIndex] = categories[index]
  categories[index] = adjacent
  const changed = categories.map((category, position) => ({ ...category, sort_order: position + 1 }))
    .filter((category) => category.sort_order !== ranks.get(category.id))
  if (!supabase) {
    const updated = new Map(changed.map((category) => [category.id, category.sort_order]))
    demo!.categories = categories.map((category) => ({ ...category, sort_order: updated.get(category.id) ?? category.sort_order }))
    patchCategories(changed)
    return changed
  }
  // Include the existing records so the database can swap their ranks atomically.
  // Owner INSERT/UPDATE RLS applies to the complete statement, as with Excel imports.
  const { data, error } = await supabase.from('menu_categories').upsert(changed, { onConflict: 'id' }).select()
  if (error) throw error
  patchCategories((data ?? []) as Category[])
  return (data ?? []) as Category[]
}

export async function deleteCategory(id: string) {
  if (!supabase) {
    for (const entry of demoMenus) {
      entry.categories = entry.categories.filter((category) => category.id !== id)
      entry.items = entry.items.filter((item) => item.category_id !== id)
    }
    patchOwnerMenus((menu) => menu.categories.some((category) => category.id === id), (menu) => ({ ...menu, categories: menu.categories.filter((category) => category.id !== id), items: menu.items.filter((item) => item.category_id !== id) }))
    return
  }
  const { error } = await supabase.from('menu_categories').delete().eq('id', id).select('id').single()
  if (error) throw error
  patchOwnerMenus((menu) => menu.categories.some((category) => category.id === id), (menu) => ({ ...menu, categories: menu.categories.filter((category) => category.id !== id), items: menu.items.filter((item) => item.category_id !== id) }))
}

export async function createItem(input: ItemInput) {
  if (!supabase) {
    const item = { ...structuredClone(input), id: crypto.randomUUID(), highlighted: input.highlighted ?? false } as MenuItem
    demoMenus.find((entry) => entry.restaurant.id === input.restaurant_id)?.items.push(structuredClone(item))
    patchItems([structuredClone(item)])
    return item
  }
  const { data, error } = await supabase.from('menu_items').insert(input).select().single()
  if (error) throw error
  patchItems([data as MenuItem])
  return data as MenuItem
}

/** Inserts an already-validated workbook in one owner-scoped request. */
export async function createItems(inputs: ItemInput[]) {
  if (!inputs.length) return []
  if (!supabase) return Promise.all(inputs.map(createItem))
  const { data, error } = await supabase.from('menu_items').insert(inputs).select()
  if (error) throw error
  patchItems((data ?? []) as MenuItem[])
  return data as MenuItem[]
}

export async function updateItem(id: string, values: Partial<MenuItem>) {
  if (!supabase) {
    const item = demoMenus.flatMap((entry) => entry.items).find((entry) => entry.id === id)
    if (!item) throw new Error('MenuItem not found.')
    Object.assign(item, structuredClone(values))
    patchItemFields(item, values)
    return structuredClone(item)
  }
  const { data, error } = await supabase.from('menu_items').update(values).eq('id', id).select().single()
  if (error) throw error
  patchItemFields(data as MenuItem, values)
  return data as MenuItem
}

/** Moves one position within this category and saves sibling ranks atomically. */
export async function moveItemByOne(restaurantId: string, categoryId: string, itemId: string, direction: 'up' | 'down'): Promise<MenuItem[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('owner_move_menu_item', {
      restaurant_id_input: restaurantId,
      category_id_input: categoryId,
      item_id_input: itemId,
      direction_input: direction,
    })
    if (error) throw error
    for (const item of (data ?? []) as MenuItem[]) patchItemFields(item, { sort_order: item.sort_order })
    return (data ?? []) as MenuItem[]
  }
  const demo = demoMenus.find((menu) => menu.restaurant.id === restaurantId)
  let siblings = demo?.items.filter((item) => item.category_id === categoryId) ?? []
  siblings = [...siblings].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  const index = siblings.findIndex((entry) => entry.id === itemId)
  if (index < 0) throw new Error('Item not found in this category.')
  const nextIndex = index + (direction === 'up' ? -1 : 1)
  if (nextIndex < 0 || nextIndex >= siblings.length) return []
  const ranks = new Map(siblings.map((entry) => [entry.id, entry.sort_order]))
  const adjacent = siblings[nextIndex]
  siblings[nextIndex] = siblings[index]
  siblings[index] = adjacent
  const changed = siblings.map((item, position) => ({ ...item, sort_order: position + 1 }))
    .filter((item) => item.sort_order !== ranks.get(item.id))
  const updated = new Map(changed.map((item) => [item.id, item.sort_order]))
  demo!.items = demo!.items.map((item) => ({ ...item, sort_order: updated.get(item.id) ?? item.sort_order }))
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  for (const item of changed) patchItemFields(item, { sort_order: item.sort_order })
  return changed
}

/** Uses existing owner RLS and confirms that a matching item was updated. */
export async function setItemHighlighted(restaurantId: string, id: string, highlighted: boolean): Promise<boolean> {
  if (!supabase) {
    const item = demoMenus.find((entry) => entry.restaurant.id === restaurantId)?.items.find((entry) => entry.id === id)
    if (!item) throw new Error('Item not found.')
    item.highlighted = highlighted
    patchItemFields(item, { highlighted })
    return highlighted
  }
  const { data, error } = await supabase.from('menu_items').update({ highlighted })
    .eq('restaurant_id', restaurantId).eq('id', id).select().single()
  if (error) throw error
  patchItemFields(data as MenuItem, { highlighted })
  return data.highlighted as boolean
}

export async function deleteItem(id: string) {
  if (!supabase) {
    for (const entry of demoMenus) entry.items = entry.items.filter((item) => item.id !== id)
    patchOwnerMenus((menu) => menu.items.some((item) => item.id === id), (menu) => ({ ...menu, items: menu.items.filter((item) => item.id !== id) }))
    return
  }
  const { error } = await supabase.from('menu_items').delete().eq('id', id).select('id').single()
  if (error) throw error
  patchOwnerMenus((menu) => menu.items.some((item) => item.id === id), (menu) => ({ ...menu, items: menu.items.filter((item) => item.id !== id) }))
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
  const { data, error } = await supabase.rpc('platform_admin_role').abortSignal(readSignal())
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

export async function listSubscribers(search = '', page = 0, signal?: AbortSignal): Promise<SubscriberPage> {
  if (!supabase) return (await import('./billingDemo')).demoSubscribers(search, page)
  const { data, error } = await supabase.rpc('platform_subscribers', { search_input: search, page_input: page }).abortSignal(readSignal(signal))
  if (error) throw error
  return data as SubscriberPage
}
export async function setSubscriberStatus(ownerId: string, status: 'active' | 'suspended') {
  if (!supabase) { (await import('./billingDemo')).demoSetSubscriberStatus(ownerId, status); return }
  const { error } = await supabase.rpc('platform_set_subscriber_status', { owner_id_input: ownerId, status_input: status })
  if (error) throw error
}
export async function deleteSubscriber(ownerId: string, emailConfirmation: string) {
  if (!supabase) { (await import('./billingDemo')).demoDeleteSubscriber(ownerId, emailConfirmation); return }
  const { error } = await supabase.rpc('platform_delete_subscriber', { owner_id_input: ownerId, email_confirmation: emailConfirmation })
  if (error) throw error
}
export async function getShopBilling(shopId: string, admin = false, signal?: AbortSignal): Promise<ShopBilling> {
  if (!supabase) return (await import('./billingDemo')).demoShopBilling(shopId, admin)
  const { data, error } = await supabase.rpc(admin ? 'platform_get_shop_billing' : 'owner_get_shop_billing', { shop_input: shopId }).abortSignal(readSignal(signal))
  if (error) throw error
  return data as ShopBilling
}
export async function setShopPrice(shopId: string, annualCents: number): Promise<ShopBilling> {
  if (!supabase) return (await import('./billingDemo')).demoSetPrice(shopId, annualCents)
  const { data, error } = await supabase.rpc('platform_set_shop_price', { shop_input: shopId, annual_input: annualCents })
  if (error) throw error
  return data as ShopBilling
}
export async function previewCashPayment(shopId: string, amount: number, collectedAt: string): Promise<CashPaymentPreview> {
  if (!supabase) return (await import('./billingDemo')).demoPreview(shopId, amount, collectedAt)
  const { data, error } = await supabase.rpc('platform_preview_cash_payment', { shop_input: shopId, amount_input: amount, collected_input: collectedAt }).abortSignal(readSignal())
  if (error) throw error
  return data as CashPaymentPreview
}
export async function reviewLegacyAccess(shopId: string, endsAt: string, version: string): Promise<ShopBilling> {
  if (!supabase) return (await import('./billingDemo')).demoReviewLegacy(shopId, endsAt, version)
  const { data, error } = await supabase.rpc('platform_review_legacy_access', { shop_input: shopId, ends_input: endsAt, version_input: version })
  if (error) throw error
  return data as ShopBilling
}
export async function recordCashPayment(request: CashPaymentRequest): Promise<ShopBilling> {
  if (!supabase) return (await import('./billingDemo')).demoRecord(request)
  const { data, error } = await supabase.rpc('platform_record_cash_payment', request)
  if (error) throw error
  return data as ShopBilling
}
export async function voidCashReceipt(receiptId: string, reason: string, requestId: string, version: string): Promise<ShopBilling> {
  if (!supabase) return (await import('./billingDemo')).demoVoid(receiptId, reason, requestId, version)
  const { data, error } = await supabase.rpc('platform_void_cash_receipt', { receipt_input: receiptId, reason_input: reason, request_input: requestId, version_input: version })
  if (error) throw error
  return data as ShopBilling
}
export async function getCashCollections(from: string, until: string, page = 0, signal?: AbortSignal): Promise<CashCollections> {
  if (!supabase) return (await import('./billingDemo')).demoCollections(from, until, page)
  const { data, error } = await supabase.rpc('platform_cash_collections', { from_input: from, until_input: until, page_input: page }).abortSignal(readSignal(signal))
  if (error) throw error
  return data as CashCollections
}

export async function getPlatformAudit(limit = 50): Promise<PlatformAuditEntry[]> {
  if (!supabase) return demoPlatformAudit
  const { data, error } = await supabase.rpc('platform_audit', { limit_input: limit })
  if (error) throw error
  return (data ?? []) as PlatformAuditEntry[]
}

/** Suspend/restore only. Restoration preserves the server's existing expiry. */
export async function setSubscription(restaurantId: string, status: Restaurant['subscription_status'], endsAt: string | null) {
  if (!supabase) { (await import('./billingDemo')).demoSuspension(restaurantId, status, endsAt); return }
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
