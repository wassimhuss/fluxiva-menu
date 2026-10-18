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
const { harness } = await import(uri(compile(`export function harness(currency='LBP',initialLbp='',initialUsd='') {let lbp=initialLbp,usd=initialUsd;const changes=[];const setLbp=v=>lbp=v,setUsd=v=>usd=v,onChange=(price,secondary)=>changes.push({price,secondary});${handlers};return {enterLbp,enterUsd,changes,get lbp(){return lbp},get usd(){return usd}}}`)))

test('new and saved prices are manual: LBP never calculates or overwrites USD', () => {
  const form = harness()
  form.enterLbp('895000')
  assert.equal(form.usd, '')
  assert.deepEqual(form.changes.at(-1), { price: '895000', secondary: null })
  form.enterUsd('12.50')
  assert.equal(form.lbp, '895000')
  assert.deepEqual(form.changes.at(-1), { price: '895000', secondary: 12.5 })
  form.enterLbp('1790000')
  assert.equal(form.usd, '12.50')
  assert.deepEqual(form.changes.at(-1), { price: '1790000', secondary: 12.5 })
  form.enterUsd('0'); assert.equal(form.changes.at(-1).secondary, 0)
  form.enterLbp(''); assert.equal(form.usd, '0')
  assert.deepEqual(form.changes.at(-1), {price:'',secondary:0})
  form.enterUsd(''); assert.equal(form.changes.at(-1).secondary,null)
  const saved = harness('LBP','895000','10')
  saved.enterLbp('950000')
  assert.equal(saved.usd,'10')
  assert.deepEqual(saved.changes.at(-1),{price:'950000',secondary:10})
  saved.enterUsd('11.75'); assert.equal(saved.lbp,'950000')
})

test('legacy USD menus accept LBP input and independently editable dollars without changing either value on reload', () => {
  const form = harness('USD')
  form.enterLbp('895000'); assert.deepEqual(form.changes.at(-1), { price: '', secondary: 895000 })
  form.enterUsd('12.50'); assert.deepEqual(form.changes.at(-1), { price: '12.50', secondary: 895000 })
  form.enterLbp('950000'); assert.deepEqual(form.changes.at(-1), { price: '12.50', secondary: 950000 })
  const usdFirst=harness()
  usdFirst.enterUsd('10');assert.equal(usdFirst.lbp,'')
  usdFirst.enterLbp('950000');assert.equal(usdFirst.usd,'10')
  assert.equal(pricing.formatMenuPrice(12.5, 'USD', 895000), '895,000 LBP / $12.50')
})

test('missing prices are never converted; zero is explicit and currency switches require complete manual pairs', () => {
  assert.equal(pricing.roundUsd(1.005), 1.01)
  assert.equal(pricing.secondaryPrice({price:895000,price_secondary:0}),0)
  assert.equal(pricing.secondaryPrice({price:895000,price_secondary:null}),null)
  assert.equal(pricing.secondaryPrice({price:895000}),null)
  assert.equal(pricing.formatMenuPrice(10,'USD'), '$10.00')
  assert.equal(pricing.formatMenuPrice(895000,'LBP'), '895,000 LBP')
  assert.equal(pricing.formatMenuPrice(895000,'LBP',0), '895,000 LBP / $0.00')
  const item={price:895000,price_secondary:12.5,variants:[{price:179000,price_secondary:2.5}],extras:[{price:89500,price_secondary:1.25}]}
  const usd=pricing.swapMenuCurrency(item)
  assert.equal(usd.price,12.5);assert.equal(usd.price_secondary,895000)
  assert.equal(usd.variants[0].price,2.5);assert.equal(usd.extras[0].price,1.25)
  assert.deepEqual(pricing.swapMenuCurrency(usd),item)
  for(const incomplete of [{...item,price_secondary:null},{...item,variants:[{price:1}]},{...item,extras:[{price:0}]}]) assert.throws(()=>pricing.swapMenuCurrency(incomplete),/Enter both LBP and USD/)
})

test('sizes/extras, quantities, basket and WhatsApp total the entered dollar overrides rather than reconverting the LBP total', () => {
  const item={id:'dish',name_en:'Pasta',name_ar:'باستا',price:89500,price_secondary:7,available:true,
    variants:[{name_en:'Large',price:895000,price_secondary:10}],extras:[{id:'cheese',name_en:'Cheese',name_ar:'جبنة',price:89500,price_secondary:1.25}]}
  const lines=order.resolveLines([{itemId:'dish',variantIndex:0,quantity:2,extraIds:['cheese']}],[item])
  assert.equal(lines[0].unitPriceSecondary,11.25) // Entered variant $10, not base $7.
  assert.equal(order.orderTotal(lines),1969000)
  assert.equal(order.orderTotalSecondary(lines),22.5)
  const message=order.buildOrderMessage({restaurantName:'Demo',lines,language:'en',formatPrice:(price,secondary)=>pricing.formatMenuPrice(price,'LBP',secondary)})
  assert.match(message,/1,969,000 LBP \/ \$22\.50/)
  assert.match(message,/Total: 1,969,000 LBP \/ \$22\.50/)
  assert.equal(order.resolveLines([{itemId:'dish',variantIndex:0,quantity:2,extraIds:[]}],[{...item,available:false}]).length,0)
})

test('paired editor fields never suggest a converted price and retain manual values, required fields and Arabic labels', async () => {
  const i18n=uri(compile(source('lib/dashboardI18n.ts')))
  const code=compile(priceFields).replace(/(['"])(react\/jsx-runtime|react)\1/g,(_,q,name)=>JSON.stringify(import.meta.resolve(name))).replace("'../lib/pricing'",JSON.stringify(pricingUri)).replace("'../lib/dashboardI18n'",JSON.stringify(i18n))
  const {PriceFields}=await import(uri(code))
  const render=props=>renderToStaticMarkup(createElement(PriceFields,{price:'895000',currency:'LBP',language:'en',onChange(){},...props}))
  assert.match(render(),/value=""/)
  assert.doesNotMatch(render(),/value="10"/)
  assert.match(render({secondary:12.5}),/value="12.5"/)
  assert.match(render({language:'ar'}),/السعر بالدولار/)
  assert.match(render(),/step="0.01"/)
  assert.doesNotMatch(render(),/Recalculate|89,500|calculate USD/)
  assert.match(render(),/Enter both prices manually/)
  assert.equal((render().match(/required=""/g)??[]).length,2)
  assert.match(render({price:'',secondary:10}),/value="10"/)
  assert.match(render({currency:'USD',price:10,secondary:null}),/value=""/)
})

test('missing alternate prices hide alternate line and basket totals instead of inventing or partially summing USD',()=>{
  const item={id:'dish',name_en:'Dish',name_ar:'طبق',price:895000,price_secondary:10,available:true,variants:[],extras:[{id:'cheese',name_en:'Cheese',name_ar:'جبنة',price:89500}]}
  const lines=order.resolveLines([{itemId:'dish',variantIndex:0,quantity:2,extraIds:['cheese']}],[item])
  assert.equal(lines[0].unitPriceSecondary,null)
  assert.equal(lines[0].lineTotalSecondary,null)
  assert.equal(order.orderTotalSecondary(lines),null)
  const message=order.buildOrderMessage({restaurantName:'Demo',lines,language:'en',formatPrice:(p,s)=>pricing.formatMenuPrice(p,'LBP',s)})
  assert.doesNotMatch(message,/\$/)
  assert.match(message,/1,969,000 LBP/)
  const missing=order.resolveLines([{itemId:'dish',variantIndex:0,quantity:1,extraIds:[]}],[{...item,variants:[{price:895000}]}])
  assert.equal(missing[0].unitPriceSecondary,null) // Do not reuse the base USD amount for an unpriced size.
  assert.equal(pricing.sumSecondaryPrices([{price:1,price_secondary:0},{price:2,price_secondary:1.5}]),1.5)
})

test('Excel exports/imports overrides for items, sizes and extras; old workbooks without the optional column still work', async () => {
  const workbookCode=compile(source('lib/menuWorkbook.ts'))+'\nexport {buildWorkbook};'
  const workbook=await import(uri(workbookCode.replace("'exceljs'",JSON.stringify(import.meta.resolve('exceljs')))))
  const menu={restaurant:{currency:'LBP'},categories:[{id:'cat',name_en:'Pasta',name_ar:'باستا'}],items:[{category_id:'cat',name_en:'Dish',name_ar:'طبق',price:895000,price_secondary:12.5,available:true,variants:[{name_en:'L',price:179000,price_secondary:3}],extras:[{name_en:'Cheese',name_ar:'جبنة',price:89500,price_secondary:0}]}]}
  const xlsx=await workbook.buildWorkbook(menu)
  const instructions=JSON.stringify(xlsx.getWorksheet('Read me').getSheetValues())
  assert.match(instructions,/no currency conversion/)
  assert.doesNotMatch(instructions,/89,500|automatic conversion/)
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
