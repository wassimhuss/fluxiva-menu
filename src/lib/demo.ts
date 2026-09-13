import type { RestaurantMenu } from './types'

export const demoMenu: RestaurantMenu = {
  restaurant: {
    id: 'demo-restaurant',
    slug: 'demo',
    name_en: 'Cedar Oven',
    name_ar: 'فرن الأرز',
    description_en: 'Fresh from our oven, every day.',
    description_ar: 'طازج من فرننا، كل يوم.',
    primary_color: '#b84d2f',
    phone: '+961 70 123 456',
    whatsapp: '+96170123456',
    instagram: '@cedaroven',
    maps_url: 'https://maps.google.com/?q=Tripoli,Lebanon',
    address_en: 'Tripoli, Lebanon',
    address_ar: 'طرابلس، لبنان',
    opening_hours: 'Every day · 10:00 – 23:00',
    temporarily_closed: false,
    default_language: 'en',
    subscription_status: 'active',
  },
  categories: [
    { id: 'cat-pizza', restaurant_id: 'demo-restaurant', name_en: 'Pizza', name_ar: 'بيتزا', sort_order: 1 },
    { id: 'cat-manaeesh', restaurant_id: 'demo-restaurant', name_en: 'Manaeesh', name_ar: 'مناقيش', sort_order: 2 },
    { id: 'cat-drinks', restaurant_id: 'demo-restaurant', name_en: 'Drinks', name_ar: 'مشروبات', sort_order: 3 },
  ],
  items: [
    {
      id: 'item-margherita', restaurant_id: 'demo-restaurant', category_id: 'cat-pizza',
      name_en: 'Margherita', name_ar: 'مارغريتا',
      description_en: 'Tomato, mozzarella and basil', description_ar: 'طماطم، موزاريلا وريحان',
      price_lbp: 350000, available: true, sort_order: 1,
      variants: [
        { id: 'small', name_en: 'S', name_ar: 'ص', price_lbp: 350000 },
        { id: 'medium', name_en: 'M', name_ar: 'و', price_lbp: 500000 },
        { id: 'large', name_en: 'L', name_ar: 'ك', price_lbp: 650000 },
      ],
    },
    {
      id: 'item-pepperoni', restaurant_id: 'demo-restaurant', category_id: 'cat-pizza',
      name_en: 'Pepperoni', name_ar: 'بيبروني',
      description_en: 'Mozzarella, pepperoni and tomato sauce', description_ar: 'موزاريلا، بيبروني وصلصة طماطم',
      price_lbp: 550000, available: true, sort_order: 2, variants: [],
    },
    {
      id: 'item-zaatar', restaurant_id: 'demo-restaurant', category_id: 'cat-manaeesh',
      name_en: 'Zaatar', name_ar: 'زعتر',
      description_en: 'Local zaatar blend and olive oil', description_ar: 'خلطة زعتر بلدية وزيت زيتون',
      price_lbp: 100000, available: true, sort_order: 1, variants: [],
    },
    {
      id: 'item-cheese', restaurant_id: 'demo-restaurant', category_id: 'cat-manaeesh',
      name_en: 'Akkawi Cheese', name_ar: 'جبنة عكاوي',
      description_en: 'Melted akkawi cheese', description_ar: 'جبنة عكاوي ذائبة',
      price_lbp: 180000, available: true, sort_order: 2, variants: [],
    },
    {
      id: 'item-ayran', restaurant_id: 'demo-restaurant', category_id: 'cat-drinks',
      name_en: 'Ayran', name_ar: 'لبن عيران', price_lbp: 75000,
      available: true, sort_order: 1, variants: [],
    },
  ],
}
