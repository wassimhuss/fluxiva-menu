import type { Category, MenuItem, RestaurantMenu, Variant } from './types'

const categories: Category[] = [
  ['pizza', 'Pizza', 'بيتزا'], ['manakish', 'Manakish', 'مناقيش'], ['sandwiches', 'Oven sandwiches', 'سندويشات الفرن'],
  ['plates', 'Plates', 'أطباق'], ['sides', 'Sides', 'مقبلات'], ['salads', 'Salads', 'سلطات'], ['desserts', 'Desserts', 'حلويات'], ['drinks', 'Drinks', 'مشروبات'],
].map(([id, name_en, name_ar], index) => ({ id: `cat-${id}`, restaurant_id: 'demo-restaurant', name_en, name_ar, sort_order: index + 1 }))

const categoryId = (name: string) => categories.find((category) => category.name_en === name)?.id ?? categories[0].id
const variant = (id: string, name_en: string, name_ar: string, price_lbp: number): Variant => ({ id, name_en, name_ar, price_lbp })
let itemNumber = 0
function item(category: string, name_en: string, name_ar: string, description_en: string, description_ar: string, price_lbp: number, variants: Variant[] = []): MenuItem {
  itemNumber += 1
  return { id: `demo-item-${itemNumber}`, restaurant_id: 'demo-restaurant', category_id: categoryId(category), name_en, name_ar, description_en, description_ar, price_lbp, variants, available: true, sort_order: itemNumber }
}

export const demoMenu: RestaurantMenu = {
  restaurant: {
    id: 'demo-restaurant', slug: 'demo', name_en: 'Cedar Oven', name_ar: 'فرن الأرز',
    description_en: 'Fresh from our oven, every day.', description_ar: 'طازج من فرننا، كل يوم.', logo_url: '/cedar-oven-logo.svg', primary_color: '#b84d2f',
    phone: '+961 70 123 456', whatsapp: '+96170123456', instagram: '@cedaroven', maps_url: 'https://maps.google.com/?q=Tripoli,Lebanon',
    address_en: 'Tripoli, Lebanon', address_ar: 'طرابلس، لبنان', opening_hours: 'Every day · 10:00 – 23:00', temporarily_closed: false,
    default_language: 'en', subscription_status: 'active',
  },
  categories,
  items: [
    item('Pizza', 'Margherita', 'مارغريتا', 'Tomato, mozzarella and fresh basil', 'طماطم، موزاريلا وريحان طازج', 350000, [variant('margherita-s', 'S', 'ص', 350000), variant('margherita-m', 'M', 'و', 500000), variant('margherita-l', 'L', 'ك', 650000)]),
    item('Pizza', 'Pepperoni', 'بيبروني', 'Mozzarella, pepperoni and tomato sauce', 'موزاريلا، بيبروني وصلصة طماطم', 550000, [variant('pepperoni-s', 'S', 'ص', 550000), variant('pepperoni-m', 'M', 'و', 700000), variant('pepperoni-l', 'L', 'ك', 850000)]),
    item('Pizza', 'Four cheese', 'أربع أجبان', 'Mozzarella, akkawi, cheddar and parmesan', 'موزاريلا، عكاوي، شيدر وبارميزان', 600000, [variant('four-cheese-s', 'S', 'ص', 600000), variant('four-cheese-m', 'M', 'و', 750000), variant('four-cheese-l', 'L', 'ك', 900000)]),
    item('Pizza', 'Chicken BBQ', 'دجاج باربكيو', 'Chicken, smoked cheese, onion and BBQ sauce', 'دجاج، جبنة مدخّنة، بصل وصلصة باربكيو', 600000, [variant('bbq-s', 'S', 'ص', 600000), variant('bbq-m', 'M', 'و', 750000), variant('bbq-l', 'L', 'ك', 900000)]),
    item('Pizza', 'Vegetarian garden', 'خضار', 'Mushroom, peppers, olives, onion and corn', 'فطر، فليفلة، زيتون، بصل وذرة', 500000, [variant('veg-s', 'S', 'ص', 500000), variant('veg-m', 'M', 'و', 650000), variant('veg-l', 'L', 'ك', 800000)]),
    item('Manakish', 'Zaatar', 'زعتر', 'Local zaatar blend, sesame and olive oil', 'خلطة زعتر بلدية، سمسم وزيت زيتون', 100000),
    item('Manakish', 'Cheese', 'جبنة', 'Melted akkawi cheese', 'جبنة عكاوي ذائبة', 180000),
    item('Manakish', 'Zaatar and cheese', 'زعتر وجبنة', 'Zaatar blend with melted cheese', 'خلطة زعتر مع جبنة ذائبة', 220000),
    item('Manakish', 'Lahm bi ajeen', 'لحم بعجين', 'Seasoned beef, tomato, onion and herbs', 'لحم بقري متبّل، طماطم، بصل وأعشاب', 250000),
    item('Manakish', 'Muhammara', 'محمّرة', 'Red pepper, walnut and pomegranate molasses', 'فليفلة حمراء، جوز ودبس رمان', 180000),
    item('Manakish', 'Sujuk and cheese', 'سجق وجبنة', 'Spiced sujuk and melted cheese', 'سجق متبّل وجبنة ذائبة', 300000),
    item('Oven sandwiches', 'Chicken tawook', 'سندويش طاووق', 'Garlic marinated chicken, pickles and toum', 'دجاج متبّل بالثوم، مخلل وثوم', 450000),
    item('Oven sandwiches', 'Crispy chicken', 'دجاج كريسبي', 'Crispy chicken, lettuce and house sauce', 'دجاج مقرمش، خس وصلصة البيت', 500000),
    item('Oven sandwiches', 'Philly steak', 'فيلي ستيك', 'Beef strips, peppers, onion and melted cheese', 'شرائح لحم، فليفلة، بصل وجبنة ذائبة', 650000),
    item('Oven sandwiches', 'Oven burger', 'برغر الفرن', 'Beef patty, cheddar, lettuce and special sauce', 'قطعة لحم، شيدر، خس وصلصة خاصة', 550000),
    item('Oven sandwiches', 'Falafel wrap', 'راب فلافل', 'Falafel, parsley, pickles and tahini', 'فلافل، بقدونس، مخلل وطحينة', 250000),
    item('Plates', 'Chicken tawook plate', 'طبق طاووق', 'Grilled chicken, fries, coleslaw and garlic sauce', 'دجاج مشوي، بطاطا، كولسلو وصلصة ثوم', 850000),
    item('Plates', 'Mixed grill', 'مشاوي مشكلة', 'Tawook, kafta, kabab, fries and grilled vegetables', 'طاووق، كفتة، كباب، بطاطا وخضار مشوية', 1200000),
    item('Plates', 'Kafta plate', 'طبق كفتة', 'Charcoal kafta, hummus, fries and salad', 'كفتة على الفحم، حمص، بطاطا وسلطة', 900000),
    item('Plates', 'Family chicken', 'وجبة دجاج عائلية', 'Whole roasted chicken, fries, salad and garlic sauce', 'دجاجة كاملة مشوية، بطاطا، سلطة وصلصة ثوم', 1500000),
    item('Sides', 'French fries', 'بطاطا مقلية', 'Crispy fries with your choice of sauce', 'بطاطا مقرمشة مع صلصة من اختيارك', 180000),
    item('Sides', 'Spicy fries', 'بطاطا حرة', 'Fries, garlic, coriander and chili', 'بطاطا، ثوم، كزبرة وفلفل حار', 250000),
    item('Sides', 'Garlic bread', 'خبز بالثوم', 'Oven baked bread with garlic butter', 'خبز بالفرن مع زبدة الثوم', 200000),
    item('Sides', 'Mozzarella sticks', 'أصابع موزاريلا', 'Crispy mozzarella with marinara sauce', 'موزاريلا مقرمشة مع صلصة مارينارا', 300000),
    item('Sides', 'Hummus', 'حمص', 'Creamy chickpeas, tahini and olive oil', 'حمص كريمي، طحينة وزيت زيتون', 250000),
    item('Salads', 'Fattoush', 'فتوش', 'Mixed greens, toasted bread and sumac dressing', 'خضار مشكلة، خبز محمّص وصلصة سماق', 350000),
    item('Salads', 'Greek salad', 'سلطة يونانية', 'Tomato, cucumber, olives, feta and oregano', 'طماطم، خيار، زيتون، فيتا وأوريغانو', 400000),
    item('Salads', 'Chicken Caesar', 'سيزر بالدجاج', 'Romaine, grilled chicken, parmesan and Caesar dressing', 'خس روماني، دجاج مشوي، بارميزان وصلصة سيزر', 450000),
    item('Desserts', 'Nutella pizza', 'بيتزا نوتيلا', 'Warm oven dough, Nutella and crushed hazelnuts', 'عجينة دافئة، نوتيلا وبندق مجروش', 450000),
    item('Desserts', 'Kunafa cup', 'كنافة بالكاس', 'Warm cheese kunafa with orange blossom syrup', 'كنافة جبنة دافئة مع قطر وماء زهر', 300000),
    item('Desserts', 'Brownie', 'براوني', 'Fudgy chocolate brownie', 'براوني شوكولاتة غني', 250000),
    item('Drinks', 'Water', 'مياه', 'Still mineral water', 'مياه معدنية', 50000),
    item('Drinks', 'Soft drink', 'مشروب غازي', 'Choose cola, orange or lemon-lime', 'اختر كولا، برتقال أو ليمون', 100000),
    item('Drinks', 'Ayran', 'لبن عيران', 'Cold salted yogurt drink', 'شراب لبن بارد مع الملح', 120000),
    item('Drinks', 'Fresh lemonade', 'ليموناضة طازجة', 'Fresh lemon, mint and a little sweetness', 'ليمون طازج، نعنع وقليل من الحلاوة', 180000),
  ],
}
