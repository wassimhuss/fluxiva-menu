import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync,readdirSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8')
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const dictionaries={}
for(const name of ['auth','landing','dashboard','billing','gallery','branchRequest','notification']) {
  const code=read(`lib/${name}I18n.ts`)
  dictionaries[name]=await import(uri(compile(code+'\nexport {arabic as copy};')))
}

test('all seven Arabic dictionaries retain complete, independently selectable English keys',()=>{
  for(const [name,module] of Object.entries(dictionaries)) {
    const text=module[name+'Text']
    assert.ok(Object.keys(module.copy).length>20,name)
    for(const [key,value] of Object.entries(module.copy)) {
      assert.equal(text('en',key),key,`${name}: ${key}`)
      assert.equal(text('ar',key),value)
      assert.ok(value.trim(),`${name}: empty ${key}`)
      assert.doesNotMatch(value,/سفري|السفري|يرجى|تعذّر|جارٍ|قائمتك|قائمة الطعام/,`${name}: ${key}`)
    }
  }
})

test('Lebanese terms and whole sentences are consistent across owner, guest and admin workflows',()=>{
  const {auth,landing,dashboard,billing,gallery,branchRequest,notification}=dictionaries
  assert.equal(auth.authText('ar','Email address'),'الإيميل')
  assert.equal(auth.authText('ar','Password'),'الباسوورد')
  assert.match(auth.authErrorText('ar','Invalid login credentials'),/الإيميل أو الباسوورد مش صحيح/)
  assert.equal(landing.landingText('ar','Create your menu'),'اعمل منيوك')
  assert.equal(dashboard.dashboardText('ar','Menu editor'),'تعديل المنيو')
  assert.equal(dashboard.dashboardText('ar','Takeaway orders'),'طلبات الدليفري')
  assert.equal(billing.billingText('ar','Takeaway orders'),'طلبات الدليفري')
  assert.equal(gallery.galleryText('ar','New folder'),'فولدر جديد')
  assert.match(branchRequest.branchRequestText('ar','Your request is being reviewed. No need to send it again.'),/ما في داعي تبعتو من جديد/)
  assert.match(notification.notificationText('ar','Messages appear in the dashboard of current owner accounts. No email or WhatsApp is sent.'),/ما منبعت إيميل ولا واتساب/)
})

test('informal wording preserves irreversible deletion, no-refund and payment-period boundaries',()=>{
  const bill=key=>dictionaries.billing.billingText('ar',key)
  const dash=key=>dictionaries.dashboard.dashboardText('ar',key)
  assert.match(bill('This permanently deletes the account and its menus. Billing history is retained.'),/نهائياً، وما فيك ترجّعهن/)
  assert.match(bill('This permanently deletes the account and its menus. Billing history is retained.'),/سجلّ الدفعات بيضلّ محفوظ/)
  assert.match(dash('This permanently deletes this branch, its categories, items and analytics. This cannot be undone. Your other branches and shared QR code stay unchanged.'),/نهائياً، وما فيك ترجّعهن/)
  assert.match(bill('This removes this receipt’s cash credit. Other receipts keep their agreed expiry dates. No cash refund is issued.'),/ما بترجّع كاش/)
  assert.match(bill('Recording this receipt updates access. No money is charged online.'),/ما منسحب أي مبلغ أونلاين/)
  assert.match(bill('Your payment amount does not automatically set your access end date. Fluxiva confirms that date with you.'),/ما بيحدّد تاريخ انتهاء الاشتراك لحالو/)
  assert.match(bill('Pay in USD cash, in up to three payments per annual subscription. The third payment clears the remaining balance.'),/٣ دفعات بالكتير/)
  assert.match(bill('Pay in USD cash, in up to three payments per annual subscription. The third payment clears the remaining balance.'),/بالدفعة التالتة لازم تخلّص كل المبلغ/)
})

test('Arabic delivery labels stay a WhatsApp draft with restaurant confirmation, not an automatic order',async()=>{
  const service=read('components/ServiceChoice.tsx'),bar=read('components/OrderBar.tsx')
  assert.match(service,/t\('Takeaway', 'دليفري'\)/)
  assert.match(service,/t\('Dine in', 'بالمطعم'\)/)
  assert.match(bar,/الطلب ما بيتأكّد قبل ما يردّ المطعم/)
  assert.doesNotMatch(service+bar,/سفري/)
  const formatUri=uri(compile(read('lib/format.ts')))
  const pricingUri=uri(compile(read('lib/pricing.ts')).replace("'./format'",JSON.stringify(formatUri)))
  const order=await import(uri(compile(read('lib/order.ts')).replace("'./pricing'",JSON.stringify(pricingUri))))
  const item={id:'dish',name_en:'Dish',name_ar:'اسم من المالك لا يتغيّر',price:100000,available:true,variants:[],extras:[]}
  const lines=order.resolveLines([{itemId:'dish',variantIndex:0,quantity:1,extraIds:[]}],[item])
  const input={restaurantName:'Test',lines,formatPrice:value=>String(value)}
  const arabic=order.buildOrderMessage({...input,language:'ar'})
  const english=order.buildOrderMessage({...input,language:'en'})
  assert.match(arabic,/^طلب دليفري من Test/)
  assert.match(arabic,/اسم من المالك لا يتغيّر/)
  assert.match(english,/^Takeaway order from Test/)
})

test('public designs retain restaurant-provided Arabic names and use the same Lebanese empty states',()=>{
  for(const template of readdirSync(new URL('../src/templates/',import.meta.url)).filter(n=>/^[A-Z]/.test(n))) {
    const code=read(`templates/${template}/index.tsx`)
    assert.match(code,/item\.name_ar|restaurant\.name_ar/,template)
    assert.doesNotMatch(code,/لا توجد أصناف|نحضّره طازجاً من أجلك|نفد|القائمة/,template)
  }
})
