import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const uri = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const formatUri = uri(compile(source('lib/format.ts')))
const pricingUri = uri(compile(source('lib/pricing.ts')).replace("'./format'", JSON.stringify(formatUri)))
const pricing = await import(pricingUri)
const order = await import(uri(compile(source('lib/order.ts')).replace("'./pricing'", JSON.stringify(pricingUri))))
const priceFields = source('components/PriceFields.tsx')
const ast = ts.createSourceFile('PriceFields.tsx', priceFields, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'PriceFields')
const handlers = component.body.statements.filter(n => ts.isFunctionDeclaration(n)).map(n => n.getText(ast)).join('\n')
const { harness } = await import(uri(compile(`import {lbpToUsd} from ${JSON.stringify(pricingUri)};
export function harness(currency='LBP',initialLbp='') {let lbp=initialLbp,usd='';const changes=[];const setLbp=v=>lbp=v,setUsd=v=>usd=v,onChange=(price,secondary)=>changes.push({price,secondary});${handlers};return {enterLbp,enterUsd,changes,get lbp(){return lbp},get usd(){return usd}}}`)))

test('LBP entry calculates dollars at 89,500, allows overrides and recalculates on another LBP edit', () => {
  const form = harness()
  form.enterLbp('895000')
  assert.equal(form.usd, '10')
  assert.deepEqual(form.changes.at(-1), { price: '895000', secondary: null })
  form.enterUsd('12.50')
  assert.equal(form.lbp, '895000')
  assert.deepEqual(form.changes.at(-1), { price: '895000', secondary: 12.5 })
  form.enterLbp('1790000')
  assert.equal(form.usd, '20')
  assert.deepEqual(form.changes.at(-1), { price: '1790000', secondary: null })
  form.enterUsd('0'); assert.equal(form.changes.at(-1).secondary, 0)
  form.enterLbp(''); assert.equal(form.usd, '')
})

test('legacy USD menus accept LBP input and independently editable dollars without changing either value on reload', () => {
  const form = harness('USD')
  form.enterLbp('895000'); assert.deepEqual(form.changes.at(-1), { price: '10', secondary: 895000 })
  form.enterUsd('12.50'); assert.deepEqual(form.changes.at(-1), { price: '12.50', secondary: 895000 })
  assert.equal(pricing.formatMenuPrice(12.5, 'USD', 895000), '895,000 LBP / $12.50')
})

test('rounding and legacy/null/zero prices are deterministic; primary-currency switches preserve price pairs', () => {
  assert.equal(pricing.lbpToUsd(895000), 10)
  assert.equal(pricing.lbpToUsd(500000), 5.59)
  assert.equal(pricing.roundUsd(1.005), 1.01)
  assert.equal(pricing.secondaryPrice({price:895000,price_secondary:0}),0)
  assert.equal(pricing.secondaryPrice({price:895000,price_secondary:null}),10)
  assert.equal(pricing.formatMenuPrice(10,'USD'), '895,000 LBP / $10.00')
  const item={price:895000,price_secondary:12.5,variants:[{price:179000,price_secondary:2.5}],extras:[{price:89500}]}
  const usd=pricing.swapMenuCurrency(item,'LBP')
  assert.equal(usd.price,12.5);assert.equal(usd.price_secondary,895000)
  assert.equal(usd.variants[0].price,2.5);assert.equal(usd.extras[0].price,1)
  assert.deepEqual(pricing.swapMenuCurrency(usd,'USD'),{...item,extras:[{price:89500,price_secondary:1}]})
})

test('sizes/extras, quantities, basket and WhatsApp total the entered dollar overrides rather than reconverting the LBP total', () => {
  const item={id:'dish',name_en:'Pasta',name_ar:'باستا',price:89500,price_secondary:7,available:true,
    variants:[{name_en:'Large',price:895000}],extras:[{id:'cheese',name_en:'Cheese',name_ar:'جبنة',price:89500,price_secondary:1.25}]}
  const lines=order.resolveLines([{itemId:'dish',variantIndex:0,quantity:2,extraIds:['cheese']}],[item])
  assert.equal(lines[0].unitPriceSecondary,11.25) // Variant auto $10, not base override $7.
  assert.equal(order.orderTotal(lines),1969000)
  assert.equal(order.orderTotalSecondary(lines),22.5)
  const message=order.buildOrderMessage({restaurantName:'Demo',lines,language:'en',formatPrice:(price,secondary)=>pricing.formatMenuPrice(price,'LBP',secondary)})
  assert.match(message,/1,969,000 LBP \/ \$22\.50/)
  assert.match(message,/Total: 1,969,000 LBP \/ \$22\.50/)
  assert.equal(order.resolveLines([{itemId:'dish',variantIndex:0,quantity:2,extraIds:[]}],[{...item,available:false}]).length,0)
})

test('paired editor fields start with calculated or saved values and have Arabic labels and valid number steps', async () => {
  const i18n=uri(compile(source('lib/dashboardI18n.ts')))
  const code=compile(priceFields).replace(/(['"])(react\/jsx-runtime|react)\1/g,(_,q,name)=>JSON.stringify(import.meta.resolve(name))).replace("'../lib/pricing'",JSON.stringify(pricingUri)).replace("'../lib/dashboardI18n'",JSON.stringify(i18n))
  const {PriceFields}=await import(uri(code))
  const render=props=>renderToStaticMarkup(createElement(PriceFields,{price:'895000',currency:'LBP',language:'en',onChange(){},...props}))
  assert.match(render(),/value="10"/)
  assert.match(render({secondary:12.5}),/value="12.5"/)
  assert.match(render({language:'ar'}),/السعر بالدولار/)
  assert.match(render(),/step="0.01"/)
  assert.match(render(),/Recalculate USD/)
})

test('Excel exports/imports overrides for items, sizes and extras; old workbooks without the optional column still work', async () => {
  const workbookCode=compile(source('lib/menuWorkbook.ts'))+'\nexport {buildWorkbook};'
  const workbook=await import(uri(workbookCode.replace("'exceljs'",JSON.stringify(import.meta.resolve('exceljs')))))
  const menu={restaurant:{currency:'LBP'},categories:[{id:'cat',name_en:'Pasta',name_ar:'باستا'}],items:[{category_id:'cat',name_en:'Dish',name_ar:'طبق',price:895000,price_secondary:12.5,available:true,variants:[{name_en:'L',price:179000,price_secondary:3}],extras:[{name_en:'Cheese',name_ar:'جبنة',price:89500,price_secondary:0}]}]}
  const xlsx=await workbook.buildWorkbook(menu)
  const file=async()=>new File([await xlsx.xlsx.writeBuffer()],'prices.xlsx')
  const parsed=await workbook.readMenuWorkbook(await file(),'en')
  assert.deepEqual(parsed.errors,[])
  assert.equal(parsed.items[0].price_secondary,12.5)
  assert.equal(parsed.items[0].variants[0].price_secondary,3)
  assert.equal(parsed.items[0].extras[0].price_secondary,0)
  xlsx.getWorksheet('Items').getCell('J2').value=-1
  assert.ok((await workbook.readMenuWorkbook(await file(),'en')).errors.length)
  for(const [sheet,column] of [['Items',10],['Variants',4],['Extras',5]])xlsx.getWorksheet(sheet).spliceColumns(column,1)
  const old=await workbook.readMenuWorkbook(await file(),'en')
  assert.deepEqual(old.errors,[]);assert.equal(old.items[0].price_secondary,null)
})
