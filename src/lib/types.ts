export type Language = 'en' | 'ar'
export type BranchRequestStatus = 'pending' | 'approved' | 'rejected' | 'created'
export type BranchRequestInput = Pick<Restaurant, 'name_en' | 'name_ar' | 'slug' | 'address_en' | 'address_ar' | 'whatsapp'>
export interface BranchRequest extends BranchRequestInput {
  id: string
  owner_id: string
  owner_email: string
  status: BranchRequestStatus
  decision_note: string
  created_at: string
  reviewed_at: string | null
  restaurant_id: string | null
}
export interface BranchRequestPage {
  requests: BranchRequest[]
  total: number
  pending_count: number
  page: number
  page_size: number
}
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

/** All subscription money is integer USD cents, independent of menu currency. */
export interface CashReceipt {
  id: string
  amount_cents: number
  collected_at: string
  reference: string
  coverage_from: string
  coverage_until: string
  voided: boolean
  can_void: boolean
  note?: string | null
  actor_email?: string | null
  void_reason?: string | null
}
export interface CashAgreement {
  id: string
  annual_cents: number
  created_at: string
  paid_cents: number
  receipts: CashReceipt[]
}
export interface ShopBilling {
  restaurant_id: string
  owner_id: string
  name_en: string
  name_ar: string
  slug: string
  whatsapp?: string | null
  address_en?: string | null
  address_ar?: string | null
  archived: boolean
  subscription_status: SubscriptionStatus
  is_published: boolean
  trial_ends_at: string | null
  paid_until: string | null
  next_annual_cents: number | null
  annual_cents: number | null
  agreement_id: string | null
  paid_cents: number
  remaining_cents: number | null
  payment_count: number
  legacy_access: boolean
  version: string
  /** Directory rows omit history; shop detail loads it on demand. */
  agreements?: CashAgreement[]
}
export interface PlatformSubscriber {
  id: string
  email: string
  created_at: string | null
  archived: boolean
  shops: ShopBilling[]
  matching_shop_ids?: string[]
}
export interface SubscriberFilters {
  status: 'any' | 'trial' | 'active' | 'expired' | 'suspended' | 'expiring'
  visibility: 'any' | 'listed' | 'hidden'
  payments: 'any' | 'balance' | 'settled' | 'none'
  account: 'any' | 'current' | 'archived'
  shops: 'any' | 'with' | 'none'
  registered_from: string
  registered_to: string
  sort: 'newest' | 'oldest' | 'email_asc' | 'email_desc' | 'expiry'
}
export interface SubscriberPage {
  subscribers: PlatformSubscriber[]
  total: number
  page: number
  page_size: number
}
export interface SubscriberDetails {
  account: Pick<PlatformSubscriber, 'id' | 'email' | 'archived'> & {
    created_at: string | null; updated_at: string | null; last_sign_in_at: string | null;
    email_confirmed_at: string | null; phone: string | null; phone_confirmed_at: string | null; banned_until: string | null
  }
  brand: BrandGroup | null
  shops: Array<{
    billing: ShopBilling; restaurant: Restaurant | null; created_at: string | null; updated_at: string | null;
    category_count: number | null; item_count: number | null; unavailable_count: number | null;
    views_30d: number | null; storage_files: number | null; storage_bytes: number | null
  }>
  activity: { entries: PlatformAuditEntry[]; total: number; page: number; page_size: number }
}
export interface CashPaymentPreview {
  restaurant_id: string
  annual_cents: number
  amount_cents: number
  collected_at: string
  previous_paid_until: string | null
  coverage_from: string
  paid_until: string
  remaining_cents: number
  payment_count: number
  version: string
  suspended: boolean
  is_published: boolean
}
export interface CashPaymentRequest {
  shop_input: string
  amount_input: number
  collected_input: string
  starts_input: string
  ends_input: string
  reference_input: string
  note_input: string
  request_input: string
  version_input: string
}
export interface CashCollections {
  collected_cents: number
  daily_totals: Array<{ date: string; collected_cents: number; receipt_count: number }>
  receipts_total: number
  due_total: number
  due_shops: ShopBilling[]
  receipts: Array<Pick<CashReceipt, 'id' | 'amount_cents' | 'collected_at' | 'reference' | 'voided'> & {
    name_en: string; name_ar: string; slug: string; owner_email: string; shop_id: string
  }>
}

export interface StorageUsageBucket {
  bucket_id: string
  file_count: number
  bytes: number
}

export interface StorageUsageRestaurant {
  restaurant_id: string
  name_en: string
  name_ar: string
  slug: string
  file_count: number
  bytes: number
}

export interface StorageUsageOwner {
  owner_id: string
  owner_email: string
  file_count: number
  bytes: number
  restaurants: StorageUsageRestaurant[]
}

export interface PlatformStorageUsage {
  generated_at: string
  total_files: number
  used_bytes: number
  /** The configured plan quota used to calculate the remaining value. */
  quota_bytes: number
  buckets: StorageUsageBucket[]
  owners: StorageUsageOwner[]
  unattributed_menu_files: number
  unattributed_menu_bytes: number
  shared_gallery_files: number
  shared_gallery_bytes: number
}

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
  details: { previous_ends_at?: string | null; ends_at?: string | null; annual_cents?: number; amount_cents?: number; reference?: string; receipt_id?: string; reason?: string; owner_id?: string; owner_email?: string }
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

/** Public identity shared by every place managed under one owner account. */
export interface BrandGroup {
  id: string
  owner_id?: string
  slug: string
  name_en: string
  name_ar: string
  logo_url?: string
  primary_color: string
  default_language: Language
}

export interface BrandPlaces {
  brand: BrandGroup
  restaurants: Restaurant[]
}

export interface Restaurant {
  id: string
  owner_id?: string
  /** Groups independently managed places behind one public branch selector. */
  brand_id?: string
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
  /** Hidden places stay editable but are unavailable through all public links. */
  is_published?: boolean
  /** A new copied branch cannot be shown before its personal photos finish copying. */
  menu_copy_pending?: boolean
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
  /** Legacy rows may still contain this until migration 018 is applied. */
  name_ar?: string
  price: number
}

/** An optional add-on whose price is added to the item's base or size price. */
export interface ItemExtra {
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
  /** Optional add-ons. Diners may choose more than one. */
  extras: ItemExtra[]
  available: boolean
  /** Shows a recommendation badge without changing the item's category or position. */
  highlighted?: boolean
  sort_order: number
}

export interface RestaurantMenu {
  restaurant: Restaurant
  categories: Category[]
  items: MenuItem[]
}
