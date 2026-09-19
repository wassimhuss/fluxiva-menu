export type Language = 'en' | 'ar'
export type SubscriptionStatus = 'trial' | 'active' | 'suspended'

/** Operator console roles. Only `super_admin` may change subscriptions. */
export type AdminRole = 'super_admin' | 'support'

/** A restaurant as the operator console sees it, with owner and menu context. */
export interface PlatformRestaurant {
  id: string
  slug: string
  name_en: string
  name_ar: string
  primary_color: string
  template_id?: string
  temporarily_closed?: boolean
  subscription_status: SubscriptionStatus
  trial_ends_at?: string
  subscription_ends_at?: string
  created_at: string
  owner_email?: string
  item_count: number
}

export interface PlatformAuditEntry {
  id: string
  actor_email?: string
  action: string
  restaurant_slug?: string
  details: { previous_ends_at?: string | null; ends_at?: string | null }
  created_at: string
}

export interface Restaurant {
  id: string
  owner_id?: string
  slug: string
  name_en: string
  name_ar: string
  description_en?: string
  description_ar?: string
  logo_url?: string
  cover_image_url?: string
  primary_color: string
  phone?: string
  whatsapp?: string
  instagram?: string
  maps_url?: string
  address_en?: string
  address_ar?: string
  opening_hours?: string
  temporarily_closed?: boolean
  /** Id of the public menu design; unknown values fall back to the default. */
  template_id?: string
  default_language: Language
  subscription_status: SubscriptionStatus
  trial_ends_at?: string
  subscription_ends_at?: string
}

export interface Category {
  id: string
  restaurant_id: string
  name_en: string
  name_ar: string
  sort_order: number
}

export interface Variant {
  id?: string
  name_en: string
  name_ar: string
  price_lbp: number
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name_en: string
  name_ar: string
  description_en?: string
  description_ar?: string
  price_lbp: number
  image_url?: string
  variants: Variant[]
  available: boolean
  sort_order: number
}

export interface RestaurantMenu {
  restaurant: Restaurant
  categories: Category[]
  items: MenuItem[]
}
