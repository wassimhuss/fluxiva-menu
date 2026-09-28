import type { Session } from '@supabase/supabase-js'
import { demoContactCard, demoGalleryImages, demoMenu, demoMenuViewStats, demoPlatformAudit, demoPlatformRestaurants } from './demo'
import { supabase } from './supabase'
import type { AdminRole, Category, GalleryImage, MenuContactCard, MenuItem, MenuViewDay, MenuViewStats, PlatformAuditEntry, PlatformRestaurant, Restaurant, RestaurantMenu, Variant } from './types'

type RestaurantInput = Pick<Restaurant, 'name_en' | 'name_ar' | 'slug' | 'primary_color' | 'phone' | 'whatsapp' | 'instagram' | 'maps_url' | 'address_en' | 'address_ar' | 'opening_hours' | 'opening_hours_ar' | 'currency' | 'temporarily_closed' | 'default_language'>
type CategoryInput = Pick<Category, 'restaurant_id' | 'name_en' | 'name_ar' | 'sort_order'>
type ItemInput = Pick<MenuItem, 'restaurant_id' | 'category_id' | 'name_en' | 'name_ar' | 'description_en' | 'description_ar' | 'price' | 'image_url' | 'gallery_image_id' | 'variants' | 'available' | 'sort_order'>
type AssetPurpose = 'cover' | 'item' | 'logo' | 'gallery-thumb'
export type GalleryImageInput = Pick<GalleryImage, 'name_en' | 'name_ar' | 'category_en' | 'category_ar' | 'tags_en' | 'tags_ar'> & Pick<GalleryImage, 'source' | 'license_notes'>

const IMAGE_LIMITS: Record<AssetPurpose, { width: number; height: number; quality: number; maxBytes: number }> = {
  cover: { width: 1600, height: 1200, quality: 0.8, maxBytes: 420 * 1024 },
  item: { width: 1200, height: 1200, quality: 0.8, maxBytes: 280 * 1024 },
  logo: { width: 512, height: 512, quality: 0.88, maxBytes: 160 * 1024 },
  'gallery-thumb': { width: 320, height: 320, quality: 0.76, maxBytes: 80 * 1024 },
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This image could not be opened.')) }
    image.src = objectUrl
  })
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
  if (!supabase) return slug === 'demo' ? demoMenu : null

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .in('subscription_status', ['trial', 'active'])
    .maybeSingle()
  if (error) throw error
  if (!restaurant) return null

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (itemsResult.error) throw itemsResult.error
  return { restaurant, categories: categoriesResult.data ?? [], items: itemsResult.data ?? [] }
}

/**
 * Contact details for a slug whose menu is not being served. Returns null when
 * the slug does not exist at all.
 */
export async function getMenuContactCard(slug: string): Promise<MenuContactCard | null> {
  if (!supabase) return slug === 'demo' ? demoContactCard : null
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
  if (!supabase) return demoMenuViewStats

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

export async function getOwnerMenu(session: Session): Promise<RestaurantMenu | null> {
  if (!supabase) return demoMenu
  const { data: restaurant, error } = await supabase
    .from('restaurants').select('*').eq('owner_id', session.user.id).maybeSingle()
  if (error) throw error
  if (!restaurant) return null
  const [categories, items] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
  ])
  if (categories.error) throw categories.error
  if (items.error) throw items.error
  return { restaurant, categories: categories.data ?? [], items: items.data ?? [] }
}

export async function createRestaurant(session: Session, input: RestaurantInput) {
  if (!supabase) return demoMenu.restaurant
  const { data, error } = await supabase.from('restaurants').insert({
    ...input,
    owner_id: session.user.id,
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  }).select().single()
  if (error?.code === '23505') throw new Error('This menu link is already taken. Choose a different one.')
  if (error) throw error
  return data as Restaurant
}

export async function updateRestaurant(id: string, values: Partial<Restaurant>) {
  if (!supabase) return
  const { error } = await supabase.from('restaurants').update(values).eq('id', id)
  if (error) throw error
}

/** Stores the owner's chosen public menu design. */
export async function setRestaurantTemplate(id: string, templateId: string) {
  return updateRestaurant(id, { template_id: templateId })
}

export async function createCategory(input: CategoryInput) {
  if (!supabase) return { ...input, id: crypto.randomUUID() } as Category
  const { data, error } = await supabase.from('menu_categories').insert(input).select().single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, values: Partial<Category>) {
  if (!supabase) return
  const { error } = await supabase.from('menu_categories').update(values).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('menu_categories').delete().eq('id', id)
  if (error) throw error
}

export async function createItem(input: ItemInput) {
  if (!supabase) return { ...input, id: crypto.randomUUID() } as MenuItem
  const { data, error } = await supabase.from('menu_items').insert(input).select().single()
  if (error) throw error
  return data as MenuItem
}

export async function updateItem(id: string, values: Partial<MenuItem>) {
  if (!supabase) return
  const { error } = await supabase.from('menu_items').update(values).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string) {
  if (!supabase) return
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
  if (publicUrl.startsWith('blob:')) { URL.revokeObjectURL(publicUrl); return }
  if (!supabase) return

  const marker = '/storage/v1/object/public/menu-assets/'
  let path = ''
  try {
    const pathname = new URL(publicUrl).pathname
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex < 0) return
    path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
  } catch {
    return
  }

  if (path.split('/')[0] !== restaurantId || path.includes('..')) return
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
    id: image.id, name_en: image.name_en, name_ar: image.name_ar,
    category_en: image.category_en, category_ar: image.category_ar,
    tags_en: image.tags_en, tags_ar: image.tags_ar, image_url: image.image_url,
    thumbnail_url: image.thumbnail_url, active: image.active,
    created_at: image.created_at, updated_at: image.updated_at,
  }))
  const { data, error } = await supabase.rpc('list_gallery_images')
  if (error) throw error
  return (data ?? []) as GalleryImage[]
}

export async function listPlatformGalleryImages(): Promise<GalleryImage[]> {
  if (!supabase) return structuredClone(demoGalleryImages)
  const { data, error } = await supabase.rpc('platform_list_gallery_images')
  if (error) throw error
  return (data ?? []) as GalleryImage[]
}

/** Uploads one shared original and one browsing thumbnail under a gallery UUID. */
export async function uploadGalleryAssets(id: string, file: File) {
  const [full, thumbnail] = await Promise.all([optimizeImage(file, 'item'), optimizeImage(file, 'gallery-thumb')])
  if (!supabase) return { image_url: URL.createObjectURL(full), thumbnail_url: URL.createObjectURL(thumbnail) }
  const fullExtension = full.name.split('.').pop() || 'webp'
  const thumbExtension = thumbnail.name.split('.').pop() || 'webp'
  const fullPath = `${id}/full.${fullExtension}`
  const thumbnailPath = `${id}/thumbnail.${thumbExtension}`
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
    const image: GalleryImage = { id, ...input, ...urls, active: true, usage_count: 0, created_at: new Date().toISOString() }
    demoGalleryImages.unshift(image)
    return image
  }
  const { data, error } = await supabase.rpc('platform_create_gallery_image', {
    id_input: id, name_en_input: input.name_en, name_ar_input: input.name_ar,
    category_en_input: input.category_en, category_ar_input: input.category_ar,
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
    id_input: id, name_en_input: input.name_en, name_ar_input: input.name_ar,
    category_en_input: input.category_en, category_ar_input: input.category_ar,
    tags_en_input: input.tags_en, tags_ar_input: input.tags_ar,
    source_input: input.source ?? '', license_notes_input: input.license_notes ?? '', active_input: input.active,
  })
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

export async function discardGalleryAssets(id: string, urls?: Partial<Pick<GalleryImage, 'image_url' | 'thumbnail_url'>>) {
  if (!supabase) {
    for (const url of [urls?.image_url, urls?.thumbnail_url]) if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    return
  }
  const paths = urls
    ? [galleryStoragePath(urls.image_url), galleryStoragePath(urls.thumbnail_url)].filter((path): path is string => Boolean(path))
    : [`${id}/full.webp`, `${id}/full.jpg`, `${id}/full.png`, `${id}/thumbnail.webp`, `${id}/thumbnail.jpg`, `${id}/thumbnail.png`]
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
  return variants.filter((variant) => variant.name_en.trim() && variant.price > 0)
}
