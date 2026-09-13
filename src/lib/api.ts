import type { Session } from '@supabase/supabase-js'
import { demoMenu } from './demo'
import { supabase } from './supabase'
import type { Category, MenuItem, Restaurant, RestaurantMenu, Variant } from './types'

type RestaurantInput = Pick<Restaurant, 'name_en' | 'name_ar' | 'slug' | 'primary_color' | 'phone' | 'address_en' | 'address_ar' | 'default_language'>
type CategoryInput = Pick<Category, 'restaurant_id' | 'name_en' | 'name_ar' | 'sort_order'>
type ItemInput = Pick<MenuItem, 'restaurant_id' | 'category_id' | 'name_en' | 'name_ar' | 'description_en' | 'description_ar' | 'price_lbp' | 'variants' | 'available' | 'sort_order'>

export async function getPublicMenu(slug: string): Promise<RestaurantMenu | null> {
  if (!supabase || slug === 'demo') return slug === 'demo' ? demoMenu : null

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
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).eq('available', true).order('sort_order'),
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (itemsResult.error) throw itemsResult.error
  return { restaurant, categories: categoriesResult.data ?? [], items: itemsResult.data ?? [] }
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
  if (error) throw error
  return data as Restaurant
}

export async function updateRestaurant(id: string, values: Partial<Restaurant>) {
  if (!supabase) return
  const { error } = await supabase.from('restaurants').update(values).eq('id', id)
  if (error) throw error
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

export async function uploadRestaurantAsset(restaurantId: string, file: File) {
  if (!supabase) return URL.createObjectURL(file)
  const extension = file.name.split('.').pop() || 'jpg'
  const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('menu-assets').upload(path, file)
  if (error) throw error
  return supabase.storage.from('menu-assets').getPublicUrl(path).data.publicUrl
}

export async function listPlatformRestaurants() {
  if (!supabase) return [demoMenu.restaurant]
  const { data, error } = await supabase.rpc('platform_list_restaurants')
  if (error) throw error
  return data as Restaurant[]
}

export async function setSubscription(restaurantId: string, status: Restaurant['subscription_status'], endsAt: string | null) {
  if (!supabase) return
  const { error } = await supabase.rpc('platform_set_subscription', {
    restaurant_id_input: restaurantId,
    status_input: status,
    ends_at_input: endsAt,
  })
  if (error) throw error
}

export function cleanVariants(variants: Variant[]) {
  return variants.filter((variant) => variant.name_en.trim() && variant.price_lbp > 0)
}
