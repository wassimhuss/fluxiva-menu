import type { Category, MenuContactCard, MenuItem, MenuViewDay, MenuViewStats, PlatformAuditEntry, PlatformRestaurant, RestaurantMenu, Variant } from './types'

const categories: Category[] = [
  ['manakish', 'Manakish', 'مناقيش'], ['croissants', 'Croissants', 'كرواسون'], ['soiree', 'Soiree', 'سوارية'],
  ['pizza', 'Pizza', 'بيتزا'], ['drinks', 'Cold drinks', 'مشروبات باردة'],
].map(([id, name_en, name_ar], index) => ({ id: `cat-${id}`, restaurant_id: 'demo-restaurant', name_en, name_ar, sort_order: index + 1 }))

const categoryId = (name: string) => categories.find((category) => category.name_en === name)?.id ?? categories[0].id
const categoryImages: Record<string, string[]> = {
  Manakish: ['/menu/manakish.jpg', '/menu/manakish-alt.jpg'],
  Croissants: ['/menu/croissants.jpg', '/menu/croissants-alt.jpg'],
  Soiree: ['/menu/soiree-alt.jpg', '/menu/soiree.jpg'],
  Pizza: ['/menu/pizza.jpg', '/menu/pizza-alt.jpg'],
  'Cold drinks': ['/menu/drinks.jpg', '/menu/water.jpg'],
}
const categoryImageCounts: Record<string, number> = {}
const variant = (id: string, name_en: string, name_ar: string, price_lbp: number): Variant => ({ id, name_en, name_ar, price_lbp })
let itemNumber = 0
function item(category: string, name_en: string, name_ar: string, description_en: string, description_ar: string, price_lbp: number, variants: Variant[] = []): MenuItem {
  itemNumber += 1
  const images = categoryImages[category] ?? []
  const imageIndex = categoryImageCounts[category] ?? 0
  categoryImageCounts[category] = imageIndex + 1
  return { id: `demo-item-${itemNumber}`, restaurant_id: 'demo-restaurant', category_id: categoryId(category), name_en, name_ar, description_en, description_ar, price_lbp, image_url: images[imageIndex % images.length], variants, available: true, sort_order: itemNumber }
}

export const demoMenu: RestaurantMenu = {
  restaurant: {
    id: 'demo-restaurant', slug: 'demo', name_en: 'Hilal Oven', name_ar: 'فرن الهلال',
    description_en: 'Traditional Lebanese oven favorites, baked fresh.', description_ar: 'أطيب المخبوزات اللبنانية، طازجة من الفرن.', logo_url: '/hilal-oven-logo.png', cover_image_url: '/hilal-oven-cover.jpg', primary_color: '#4f5535',
    phone: '+961 71 636 189', whatsapp: '+96171636189', instagram: '@hilaloven', maps_url: 'https://maps.google.com/?q=Tripoli,Lebanon',
    address_en: 'Tripoli - Lebanon', address_ar: 'طرابلس - لبنان', opening_hours: 'Every day · 07:00 – 23:00', temporarily_closed: false,
    template_id: 'classic', show_item_images: true, default_language: 'en', subscription_status: 'active',
  },
  categories,
  items: [
    item('Manakish', 'Zaatar Manoushe', 'مناقيش زعتر', 'Traditional zaatar, sesame and olive oil', 'زعتر بلدي، سمسم وزيت زيتون', 100000),
    item('Manakish', 'Cheese Manoushe', 'مناقيش جبنة', 'Melted akkawi cheese', 'جبنة عكاوي ذائبة', 180000),
    item('Manakish', 'Zaatar & Cheese', 'مناقيش زعتر وجبنة', 'Zaatar blend with melted cheese', 'خلطة زعتر مع جبنة ذائبة', 220000),
    item('Manakish', 'Lahm bi Ajeen', 'لحم بعجين', 'Seasoned beef, tomato, onion and herbs', 'لحم متبّل، طماطم، بصل وأعشاب', 250000),
    item('Manakish', 'Labneh & Vegetables', 'مناقيش لبنة وخضار', 'Labneh, cucumber, tomato, mint and olives', 'لبنة، خيار، طماطم، نعنع وزيتون', 250000),
    item('Manakish', 'Sujuk & Cheese', 'مناقيش سجق وجبنة', 'Spiced sujuk and melted cheese', 'سجق متبّل وجبنة ذائبة', 300000),
    item('Croissants', 'Butter Croissant', 'كرواسون سادة', 'Classic all-butter French pastry', 'كرواسون كلاسيكي بالزبدة', 150000),
    item('Croissants', 'Chocolate Croissant', 'كرواسون شوكولاتة', 'Flaky pastry filled with chocolate', 'عجينة مورّقة محشوة بالشوكولاتة', 200000),
    item('Croissants', 'Cheese Croissant', 'كرواسون جبنة', 'Golden croissant with melted cheese', 'كرواسون ذهبي مع جبنة ذائبة', 200000),
    item('Croissants', 'Zaatar Croissant', 'كرواسون زعتر', 'Butter croissant with zaatar and sesame', 'كرواسون بالزبدة مع زعتر وسمسم', 180000),
    item('Croissants', 'Almond Croissant', 'كرواسون لوز', 'Almond cream, toasted almonds and sugar', 'كريمة لوز، لوز محمّص وسكر', 250000),
    item('Soiree', 'Spinach Fatayer', 'فطاير سبانخ', 'Spinach, onion, sumac and lemon', 'سبانخ، بصل، سماق وحامض', 150000),
    item('Soiree', 'Cheese Sambousek', 'سمبوسك جبنة', 'Crisp pastry filled with akkawi cheese', 'عجينة مقرمشة محشوة بجبنة عكاوي', 180000),
    item('Soiree', 'Meat Sambousek', 'سمبوسك لحم', 'Seasoned beef, onion and pine nuts', 'لحم متبّل، بصل وصنوبر', 200000),
    item('Soiree', 'Mini Pizza', 'بيتزا صغيرة', 'Tomato, mozzarella and oregano', 'طماطم، موزاريلا وأوريغانو', 180000),
    item('Soiree', 'Mini Zaatar', 'مناقيش صغيرة', 'Mini zaatar bites with sesame', 'مناقيش صغيرة بالزعتر والسمسم', 150000),
    item('Pizza', 'Margherita', 'مارغريتا', 'Tomato, mozzarella and fresh basil', 'طماطم، موزاريلا وريحان طازج', 350000, [variant('margherita-s', 'S', 'ص', 350000), variant('margherita-m', 'M', 'و', 500000), variant('margherita-l', 'L', 'ك', 650000)]),
    item('Pizza', 'Vegetarian', 'خضار', 'Mushroom, peppers, olives, onion and corn', 'فطر، فليفلة، زيتون، بصل وذرة', 500000, [variant('vegetarian-s', 'S', 'ص', 500000), variant('vegetarian-m', 'M', 'و', 650000), variant('vegetarian-l', 'L', 'ك', 800000)]),
    item('Pizza', 'Four Cheese', 'أربع أجبان', 'Mozzarella, akkawi, cheddar and parmesan', 'موزاريلا، عكاوي، شيدر وبارميزان', 600000, [variant('four-cheese-s', 'S', 'ص', 600000), variant('four-cheese-m', 'M', 'و', 750000), variant('four-cheese-l', 'L', 'ك', 900000)]),
    item('Pizza', 'Chicken Pizza', 'بيتزا دجاج', 'Chicken, smoked cheese, onion and BBQ sauce', 'دجاج، جبنة مدخّنة، بصل وصلصة باربكيو', 600000, [variant('chicken-s', 'S', 'ص', 600000), variant('chicken-m', 'M', 'و', 750000), variant('chicken-l', 'L', 'ك', 900000)]),
    item('Pizza', 'Pepperoni', 'بيبروني', 'Mozzarella, pepperoni and tomato sauce', 'موزاريلا، بيبروني وصلصة طماطم', 550000, [variant('pepperoni-s', 'S', 'ص', 550000), variant('pepperoni-m', 'M', 'و', 700000), variant('pepperoni-l', 'L', 'ك', 850000)]),
    item('Cold drinks', 'Water', 'مياه', 'Still mineral water', 'مياه معدنية', 50000),
    item('Cold drinks', 'Ayran', 'عيران', 'Cold salted yogurt drink', 'شراب لبن بارد مع الملح', 120000),
    item('Cold drinks', 'Fresh Lemonade', 'ليموناضة طازجة', 'Fresh lemon, mint and a little sweetness', 'ليمون طازج، نعنع وقليل من الحلاوة', 180000),
    item('Cold drinks', 'Orange Juice', 'عصير برتقال', 'Freshly squeezed orange juice', 'عصير برتقال طازج', 220000),
    item('Cold drinks', 'Soft Drink', 'مشروب غازي', 'Choose cola, orange or lemon-lime', 'اختر كولا، برتقال أو ليمون', 100000),
  ]
}

// ---------------------------------------------------------------------------
// Operator console sample data
// ---------------------------------------------------------------------------

/** Days from now as an ISO timestamp; negative values are in the past. */
const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

/**
 * Deliberately spans every lifecycle the console has to surface — perpetual,
 * renewing soon, lapsed, mid-trial, trial run out and suspended — so the
 * filters and attention ordering are visible without real customers.
 */
export const demoPlatformRestaurants: PlatformRestaurant[] = [
  { id: 'demo-restaurant', slug: 'demo', name_en: 'Hilal Oven', name_ar: 'فرن الهلال', primary_color: '#4f5535', template_id: 'classic', temporarily_closed: false, subscription_status: 'active', subscription_ends_at: undefined, created_at: daysFromNow(-420), owner_email: 'owner@hilaloven.com', item_count: 26, views_30d: 1352 },
  { id: 'demo-2', slug: 'cedar-grill', name_en: 'Cedar Grill', name_ar: 'مشاوي الأرز', primary_color: '#8c3b2a', template_id: 'kiosk', temporarily_closed: false, subscription_status: 'active', subscription_ends_at: daysFromNow(12), created_at: daysFromNow(-360), owner_email: 'hello@cedargrill.com', item_count: 41, views_30d: 2057 },
  { id: 'demo-3', slug: 'beirut-bites', name_en: 'Beirut Bites', name_ar: 'لقمة بيروت', primary_color: '#2f5d62', template_id: 'aurora', temporarily_closed: false, subscription_status: 'active', subscription_ends_at: daysFromNow(-6), created_at: daysFromNow(-400), owner_email: 'team@beirutbites.com', item_count: 18, views_30d: 976 },
  { id: 'demo-4', slug: 'saida-sweets', name_en: 'Saida Sweets', name_ar: 'حلويات صيدا', primary_color: '#b8860b', template_id: 'reel', temporarily_closed: false, subscription_status: 'trial', trial_ends_at: daysFromNow(9), created_at: daysFromNow(-5), owner_email: 'info@saidasweets.com', item_count: 12, views_30d: 694 },
  { id: 'demo-5', slug: 'zahle-kitchen', name_en: 'Zahle Kitchen', name_ar: 'مطبخ زحلة', primary_color: '#3f6d4e', template_id: 'noir', temporarily_closed: true, subscription_status: 'trial', trial_ends_at: daysFromNow(-3), created_at: daysFromNow(-17), owner_email: 'chef@zahlekitchen.com', item_count: 7, views_30d: 459 },
  { id: 'demo-6', slug: 'byblos-cafe', name_en: 'Byblos Cafe', name_ar: 'مقهى جبيل', primary_color: '#6b4f8a', template_id: 'story', temporarily_closed: false, subscription_status: 'suspended', subscription_ends_at: daysFromNow(-58), created_at: daysFromNow(-500), owner_email: 'contact@bybloscafe.com', item_count: 23, views_30d: 1211 },
]

export const demoPlatformAudit: PlatformAuditEntry[] = [
  { id: 'audit-1', actor_email: 'you@fluxiva.com', action: 'subscription.active', restaurant_slug: 'cedar-grill', details: { previous_ends_at: daysFromNow(-353), ends_at: daysFromNow(12) }, created_at: daysFromNow(-353) },
  { id: 'audit-2', actor_email: 'you@fluxiva.com', action: 'subscription.suspended', restaurant_slug: 'byblos-cafe', details: { previous_ends_at: daysFromNow(-58), ends_at: null }, created_at: daysFromNow(-58) },
  { id: 'audit-3', actor_email: 'you@fluxiva.com', action: 'subscription.active', restaurant_slug: 'beirut-bites', details: { previous_ends_at: null, ends_at: daysFromNow(-6) }, created_at: daysFromNow(-371) },
]

/** Contact card shown by the unavailable screen in demo mode. */
export const demoContactCard: MenuContactCard = {
  name_en: demoMenu.restaurant.name_en,
  name_ar: demoMenu.restaurant.name_ar,
  logo_url: demoMenu.restaurant.logo_url,
  primary_color: demoMenu.restaurant.primary_color,
  phone: demoMenu.restaurant.phone,
  whatsapp: demoMenu.restaurant.whatsapp,
  instagram: demoMenu.restaurant.instagram,
  default_language: demoMenu.restaurant.default_language,
}

/** A month of menu opens with a weekend-heavy shape, for the analytics card. */
const demoViewDays: MenuViewDay[] = Array.from({ length: 60 }, (_, index) => {
  const date = new Date(Date.now() - (59 - index) * 86400000)
  const weekend = date.getDay() === 5 || date.getDay() === 6
  const base = weekend ? 74 : 41
  // A gentle upward trend, so the period-on-period comparison shows growth.
  const drift = Math.round(index * 0.45)
  return { viewed_on: date.toISOString().slice(0, 10), views: base + drift + ((index * 7) % 11) }
})

const demoRecent = demoViewDays.slice(30)
const demoPrevious = demoViewDays.slice(0, 30)

export const demoMenuViewStats: MenuViewStats = {
  days: demoRecent,
  total: demoRecent.reduce((sum, day) => sum + day.views, 0),
  previousTotal: demoPrevious.reduce((sum, day) => sum + day.views, 0),
  busiestDay: demoRecent.reduce((best, day) => day.views > best.views ? day : best, demoRecent[0]),
}
