import type { ItemExtra, Language, RestaurantMenu, Variant } from './types'

export type WorkbookMenuItem = {
  itemKey: string
  categoryEn: string
  categoryAr: string
  nameEn: string
  nameAr: string
  descriptionEn: string
  descriptionAr: string
  price: number
  available: boolean
  variants: Variant[]
  extras: ItemExtra[]
}

export type MenuWorkbookPreview = {
  items: WorkbookMenuItem[]
  categoryCount: number
  variantCount: number
  extraCount: number
  errors: string[]
}

type SheetRow = Record<string, string>

const ITEM_HEADERS = ['item_key', 'category_en', 'category_ar', 'name_en', 'name_ar', 'description_en', 'description_ar', 'price', 'available']
const VARIANT_HEADERS = ['item_key', 'name', 'price']
const EXTRA_HEADERS = ['item_key', 'name_en', 'name_ar', 'price']

async function createExcelWorkbook() {
  const module = await import('exceljs')
  // ExcelJS is CommonJS in Node and exposed as named exports by Vite in the
  // browser. Supporting both shapes keeps the parser testable and the UI lazy.
  const WorkbookConstructor = module.Workbook ?? (module as unknown as { default: typeof module }).default.Workbook
  return new WorkbookConstructor()
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function localized(language: Language, english: string, arabic: string) {
  return language === 'ar' ? arabic : english
}

function rowsFromSheet(sheet: import('exceljs').Worksheet | undefined, requiredHeaders: string[], sheetName: string, errors: string[], language: Language) {
  if (!sheet) {
    errors.push(localized(language, `Missing “${sheetName}” sheet.`, `صفحة “${sheetName}” غير موجودة.`))
    return []
  }

  const headers = sheet.getRow(1).values as Array<string | undefined>
  const positions = new Map<string, number>()
  headers.forEach((value, index) => {
    const header = normalizeHeader(String(value ?? ''))
    if (header) positions.set(header, index)
  })
  const missing = requiredHeaders.filter((header) => !positions.has(header))
  if (missing.length) {
    errors.push(localized(language, `${sheetName}: missing columns ${missing.join(', ')}.`, `${sheetName}: الأعمدة التالية غير موجودة: ${missing.join(', ')}.`))
    return []
  }

  const rows: SheetRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = Object.fromEntries(requiredHeaders.map((header) => [header, row.getCell(positions.get(header)!).text.trim()]))
    if (Object.values(values).some(Boolean)) rows.push({ ...values, __row: String(rowNumber) })
  })
  return rows
}

function parsePrice(value: string, location: string, errors: string[], language: Language, optional = false, positive = false) {
  if (!value.trim() && optional) return 0
  const price = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(price) || price < 0 || (positive && price === 0)) {
    errors.push(positive
      ? localized(language, `${location}: price must be greater than zero.`, `${location}: يجب أن يكون السعر أكبر من صفر.`)
      : localized(language, `${location}: price must be zero or a positive number.`, `${location}: يجب أن يكون السعر صفراً أو رقماً موجباً.`))
    return 0
  }
  return price
}

function parseAvailable(value: string, location: string, errors: string[], language: Language) {
  const normalized = value.trim().toLowerCase()
  if (!normalized || ['true', 'yes', '1', 'نعم'].includes(normalized)) return true
  if (['false', 'no', '0', 'لا'].includes(normalized)) return false
  errors.push(localized(language, `${location}: available must be TRUE or FALSE.`, `${location}: يجب أن تكون available إما TRUE أو FALSE.`))
  return true
}

/** Reads and fully validates a Fluxiva workbook before any database write. */
export async function readMenuWorkbook(file: File, language: Language): Promise<MenuWorkbookPreview> {
  const workbook = await createExcelWorkbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const errors: string[] = []
  const findSheet = (name: string) => workbook.worksheets.find((sheet) => sheet.name.toLowerCase() === name.toLowerCase())
  const itemRows = rowsFromSheet(findSheet('Items'), ITEM_HEADERS, 'Items', errors, language)
  const variantRows = rowsFromSheet(findSheet('Variants'), VARIANT_HEADERS, 'Variants', errors, language)
  const extraRows = rowsFromSheet(findSheet('Extras'), EXTRA_HEADERS, 'Extras', errors, language)
  const seenKeys = new Set<string>()

  const items = itemRows.map((row) => {
    const location = `Items row ${row.__row}`
    const itemKey = row.item_key.trim()
    if (!itemKey) errors.push(localized(language, `${location}: item_key is required.`, `${location}: حقل item_key مطلوب.`))
    else if (seenKeys.has(itemKey.toLowerCase())) errors.push(localized(language, `${location}: item_key “${itemKey}” is duplicated.`, `${location}: قيمة item_key “${itemKey}” مكررة.`))
    else seenKeys.add(itemKey.toLowerCase())
    if (!row.category_en) errors.push(localized(language, `${location}: category_en is required.`, `${location}: حقل category_en مطلوب.`))
    if (!row.category_ar) errors.push(localized(language, `${location}: category_ar is required.`, `${location}: حقل category_ar مطلوب.`))
    if (!row.name_en) errors.push(localized(language, `${location}: name_en is required.`, `${location}: حقل name_en مطلوب.`))
    if (!row.name_ar) errors.push(localized(language, `${location}: name_ar is required.`, `${location}: حقل name_ar مطلوب.`))
    return {
      itemKey,
      categoryEn: row.category_en,
      categoryAr: row.category_ar,
      nameEn: row.name_en,
      nameAr: row.name_ar,
      descriptionEn: row.description_en,
      descriptionAr: row.description_ar,
      price: parsePrice(row.price, location, errors, language, true),
      available: parseAvailable(row.available, location, errors, language),
      variants: [] as Variant[],
      extras: [] as ItemExtra[],
    }
  })

  const itemByKey = new Map(items.map((item) => [item.itemKey.toLowerCase(), item]))
  variantRows.forEach((row) => {
    const location = `Variants row ${row.__row}`
    const item = itemByKey.get(row.item_key.toLowerCase())
    if (!item) { errors.push(localized(language, `${location}: item_key “${row.item_key}” was not found in Items.`, `${location}: لم يتم العثور على item_key “${row.item_key}” في صفحة Items.`)); return }
    if (!row.name) { errors.push(localized(language, `${location}: name is required.`, `${location}: حقل name مطلوب.`)); return }
    item.variants.push({ name_en: row.name, price: parsePrice(row.price, location, errors, language, false, true) })
  })
  extraRows.forEach((row) => {
    const location = `Extras row ${row.__row}`
    const item = itemByKey.get(row.item_key.toLowerCase())
    if (!item) { errors.push(localized(language, `${location}: item_key “${row.item_key}” was not found in Items.`, `${location}: لم يتم العثور على item_key “${row.item_key}” في صفحة Items.`)); return }
    if (!row.name_en) errors.push(localized(language, `${location}: name_en is required.`, `${location}: حقل name_en مطلوب.`))
    if (!row.name_ar) errors.push(localized(language, `${location}: name_ar is required.`, `${location}: حقل name_ar مطلوب.`))
    item.extras.push({ name_en: row.name_en, name_ar: row.name_ar, price: parsePrice(row.price, location, errors, language) })
  })

  if (!items.length && !errors.length) errors.push(localized(language, 'The Items sheet does not contain any menu items.', 'لا تحتوي صفحة Items على أي أصناف.'))
  return {
    items,
    categoryCount: new Set(items.map((item) => item.categoryEn.trim().toLowerCase())).size,
    variantCount: items.reduce((total, item) => total + item.variants.length, 0),
    extraCount: items.reduce((total, item) => total + item.extras.length, 0),
    errors,
  }
}

function styleSheet(sheet: import('exceljs').Worksheet, widths: number[]) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(widths.length).address }
  sheet.columns.forEach((column, index) => { column.width = widths[index] })
  const header = sheet.getRow(1)
  header.height = 25
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F35' } }
    cell.alignment = { vertical: 'middle' }
  })
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true }
  })
}

function addInstructions(workbook: import('exceljs').Workbook, currency: string) {
  const sheet = workbook.addWorksheet('Read me', { properties: { tabColor: { argb: 'FFD76A42' } } })
  sheet.columns = [{ width: 30 }, { width: 88 }]
  const rows = [
    ['Fluxiva Menu Excel import', 'Use the three sheets exactly as provided. Do not rename sheets or column headers.'],
    ['1. Items', `One row per menu item. Prices use ${currency}. item_key must be unique inside this workbook.`],
    ['2. Variants', 'Optional sizes or choices. Connect each row to an item using item_key. Variant names are entered once and shown in both menu languages.'],
    ['3. Extras', 'Optional add-ons. Connect each row using item_key and provide English and Arabic names.'],
    ['Availability', 'Use TRUE to show an item or FALSE to hide it.'],
    ['Photos', 'Photos are not embedded in Excel. Add or choose item photos in the Menu Editor after importing.'],
    ['Before import', 'Fluxiva validates the whole workbook first. Nothing is saved while errors remain. Imports add items; they do not replace existing items.'],
    ['تعليمات بالعربية', 'أدخل الأصناف في صفحة Items، والأحجام في Variants، والإضافات في Extras. لا تغيّر أسماء الصفحات أو الأعمدة. استخدم item_key نفسه لربط الأحجام والإضافات بالصنف. أضف صور الأصناف من محرّر القائمة بعد الاستيراد.'],
  ]
  rows.forEach((values, index) => {
    const row = sheet.addRow(values)
    row.height = index === 0 ? 32 : 38
    row.alignment = { vertical: 'middle', wrapText: true }
    if (index === 0) {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
      row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F35' } } })
    } else row.getCell(1).font = { bold: true, color: { argb: 'FF173F35' } }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function addExample(workbook: import('exceljs').Workbook, currency: string) {
  const sheet = workbook.addWorksheet('Example', { properties: { tabColor: { argb: 'FF8CA99F' } } })
  sheet.columns = [{ width: 20 }, { width: 62 }]
  const basePrice = currency === 'USD' ? '3.50' : '350,000'
  const extraPrice = currency === 'USD' ? '1.00' : '100,000'
  ;[
    ['Sheet', 'Example row'],
    ['Items', `manoushe-zaatar | Manakish | مناقيش | Zaatar Manoushe | منقوشة زعتر | ${basePrice} | TRUE (${currency})`],
    ['Variants', `manoushe-zaatar | Regular | ${basePrice}`],
    ['Extras', `manoushe-zaatar | Extra cheese | جبنة إضافية | ${extraPrice}`],
  ].forEach((values) => sheet.addRow(values))
  styleSheet(sheet, [20, 62])
}

async function buildWorkbook(menu?: RestaurantMenu) {
  const workbook = await createExcelWorkbook()
  workbook.creator = 'Fluxiva Menu'
  workbook.created = new Date()
  const currency = menu?.restaurant.currency ?? 'LBP'
  addInstructions(workbook, currency)

  const items = workbook.addWorksheet('Items', { properties: { tabColor: { argb: 'FF173F35' } } })
  items.addRow(ITEM_HEADERS)
  const variants = workbook.addWorksheet('Variants', { properties: { tabColor: { argb: 'FFD76A42' } } })
  variants.addRow(VARIANT_HEADERS)
  const extras = workbook.addWorksheet('Extras', { properties: { tabColor: { argb: 'FF4C7C6F' } } })
  extras.addRow(EXTRA_HEADERS)

  if (menu) {
    const categoryById = new Map(menu.categories.map((category) => [category.id, category]))
    menu.items.forEach((item, index) => {
      const key = `item_${String(index + 1).padStart(3, '0')}`
      const category = categoryById.get(item.category_id)
      items.addRow([key, category?.name_en ?? '', category?.name_ar ?? '', item.name_en, item.name_ar, item.description_en ?? '', item.description_ar ?? '', item.price, item.available])
      item.variants.forEach((variant) => variants.addRow([key, variant.name_en, variant.price]))
      item.extras.forEach((extra) => extras.addRow([key, extra.name_en, extra.name_ar, extra.price]))
    })
  }

  styleSheet(items, [18, 22, 22, 28, 28, 42, 42, 14, 14])
  styleSheet(variants, [18, 28, 14])
  styleSheet(extras, [18, 28, 28, 14])
  const priceFormat = currency === 'USD' ? '#,##0.00' : '#,##0'
  items.getColumn(8).numFmt = priceFormat
  variants.getColumn(3).numFmt = priceFormat
  extras.getColumn(4).numFmt = priceFormat
  ;[3, 5, 7].forEach((column) => { items.getColumn(column).alignment = { horizontal: 'right' } })
  extras.getColumn(3).alignment = { horizontal: 'right' }
  for (let row = 2; row <= 1000; row += 1) {
    items.getCell(`I${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"TRUE,FALSE"'] }
  }
  addExample(workbook, currency)
  return workbook
}

function safeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'menu'
}

async function downloadWorkbook(fileName: string, menu?: RestaurantMenu) {
  const workbook = await buildWorkbook(menu)
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadMenuTemplate() {
  return downloadWorkbook('fluxiva-menu-template.xlsx')
}

export function exportMenuWorkbook(menu: RestaurantMenu) {
  return downloadWorkbook(`${safeFileName(menu.restaurant.slug)}-menu.xlsx`, menu)
}
