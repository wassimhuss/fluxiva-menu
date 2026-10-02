export type Language = 'en' | 'ar'
export type SubscriptionStatus = 'trial' | 'active' | 'suspended'

/** The little that is shown when a menu is not currently being served. */
export interface MenuContactCard {
  name_en: string
  name_ar: string
  logo_url?: string
  primary_color: string
  phone?: string
  whatsapp?: string
  instagram?: string
  default_language: Language
}

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
  views_30d: number
}

/** One day's worth of menu opens. */
export interface MenuViewDay {
  viewed_on: string
  views: number
}

export interface MenuViewStats {
  days: MenuViewDay[]
  /** Opens in the last 30 days, and the 30 before that, for comparison. */
  total: number
  previousTotal: number
  busiestDay?: MenuViewDay
}

export interface PlatformAuditEntry {
  id: string
  actor_email?: string
  action: string
  restaurant_slug?: string
  details: { previous_ends_at?: string | null; ends_at?: string | null }
  created_at: string
}

/** A reusable food photo curated by Fluxiva. Internal provenance fields are
 * returned only to the super-admin console. */
export interface GalleryImage {
  id: string
  category_id: string
  name_en: string
  name_ar: string
  category_en: string
  category_ar: string
  tags_en: string[]
  tags_ar: string[]
  image_url: string
  thumbnail_url: string
  active: boolean
  source?: string
  license_notes?: string
  usage_count?: number
  created_at?: string
  updated_at?: string
}

/** A bilingual folder used to organize the shared gallery. */
export interface GalleryCategory {
  id: string
  name_en: string
  name_ar: string
  active: boolean
  sort_order: number
  image_count?: number
  created_at?: string
  updated_at?: string
}

/** How the diner intends to eat, chosen before the menu opens. */
export type ServiceMode = 'dine-in' | 'takeaway'

/** The currencies a restaurant can price in. */
export type Currency = 'LBP' | 'USD'

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
  /** Which currency the restaurant prices in. Defaults to Lebanese pounds. */
  currency?: Currency
  temporarily_closed?: boolean
  /** Id of the public menu design; unknown values fall back to the default. */
  template_id?: string
  /** Whether food-item photos are rendered on the public menu. Defaults to true. */
  show_item_images?: boolean
  /** Whether diners may build a takeaway order and send it over WhatsApp. */
  takeaway_enabled?: boolean
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
  price: number
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name_en: string
  name_ar: string
  description_en?: string
  description_ar?: string
  /** Price in the restaurant's own currency — see `Restaurant.currency`. The
   *  field name predates dollar pricing and is kept to avoid renaming it
   *  across the menu, the dashboard, the basket and every template. */
  price: number
  image_url?: string | null
  /** Set only when image_url points at the shared Fluxiva Gallery. */
  gallery_image_id?: string | null
  variants: Variant[]
  available: boolean
  sort_order: number
}

export interface RestaurantMenu {
  restaurant: Restaurant
  categories: Category[]
  items: MenuItem[]
}
