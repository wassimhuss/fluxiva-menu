import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const uri = code => 'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile = name => ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const billing = await import(uri(compile('billing')))
test('demo branch edits validate pending links, preserve owners and require the edited slug for approval and creation',async()=>{
  const sourceUri=uri('// '+crypto.randomUUID()+'\n'+compile('demo'))
  const demo=await import(uri('// '+crypto.randomUUID()+'\n'+compile('branchRequestsDemo').replace("'./demo'",JSON.stringify(sourceUri))))
  const input={name_en:'Branch',name_ar:'فرع',address_en:'Beirut',address_ar:'بيروت',slug:'requested-link',whatsapp:''}
  const id=demo.demoRequestBranch(input)
  for(const slug of ['','UPPER','bad--link','a'.repeat(101)]) assert.throws(()=>demo.demoUpdateBranchRequestLink(id,slug,input.slug),/lowercase/)
  const source=await import(sourceUri)
  assert.throws(()=>demo.demoUpdateBranchRequestLink(id,source.demoMenus[0].restaurant.slug,input.slug),/already taken/)
  demo.demoRequestBranch({...input,slug:'another-request'})
  assert.throws(()=>demo.demoUpdateBranchRequestLink(id,'another-request',input.slug),/already pending/)
  demo.demoUpdateBranchRequestLink(id,' corrected-link ',input.slug)
  const row=demo.demoBranchRequests().requests.find(row=>row.id===id)
  assert.deepEqual(row,{...row,...input,slug:'corrected-link'})
  assert.equal(row.status,'pending')
  assert.throws(()=>demo.demoUpdateBranchRequestLink(id,'next',input.slug),/link changed/)
  assert.throws(()=>demo.demoReviewBranch(id,true,'',input.slug),/link changed/)
  demo.demoReviewBranch(id,true,'Approved','corrected-link')
  assert.throws(()=>demo.demoUpdateBranchRequestLink(id,'next','corrected-link'),/Only pending/)
  assert.throws(()=>demo.demoApprovedBranch(id,input.slug),/Request approval/)
  assert.equal(demo.demoApprovedBranch(id,'corrected-link').status,'approved')
})
test('an interrupted receipt from the previous release retains its ID and preview for reconciliation',async()=>{
  const source=ts.createSourceFile('ShopBillingPanel.tsx',readFileSync(new URL('../src/components/ShopBillingPanel.tsx',import.meta.url),'utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX)
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='restoredReceipt')
  assert.ok(fn)
  const code=ts.transpileModule('export '+fn.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  const {restoredReceipt}=await import(uri(code))
  const old={request:{request_input:crypto.randomUUID(),amount_input:8000,collected_input:'2026-10-12T09:00:00Z',version_input:'old'},preview:{version:'old',coverage_from:'2026-10-12T09:00:00Z',paid_until:'2027-06-12T09:00:00Z'}}
  const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage')
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>JSON.stringify(old)}})
  try { assert.deepEqual(restoredReceipt('pending'),old) }
  finally { if(original) Object.defineProperty(globalThis,'sessionStorage',original); else delete globalThis.sessionStorage }
})
async function demo(withSource=false) {
  const nonce='// '+crypto.randomUUID()+'\n'
  const filtersUri=uri(compile('subscriberFilters').replace("'./subscription'",JSON.stringify(uri(compile('subscription')))))
  const sourceUri=uri(nonce+compile('demo'))
  const api=await import(uri(nonce+compile('billingDemo').replace("'./billing'",JSON.stringify(uri(compile('billing')))).replace("'./demo'",JSON.stringify(sourceUri)).replace("'./subscriberFilters'",JSON.stringify(filtersUri))))
  return withSource?{api,source:await import(sourceUri)}:api
}
test('demo filtering searches contact numbers, matches shop state/ledger, and sorts before pagination',async()=>{
  const {api,source}=await demo(true),base={status:'any',visibility:'any',payments:'any',account:'any',shops:'any',registered_from:'',registered_to:'',sort:'newest'}
  const empty=api.demoSubscribers('',0,{...base,shops:'none'})
  assert.equal(empty.total,1);assert.equal(empty.subscribers[0].id,'demo-empty')
  assert.equal(api.demoSubscribers('',0,{...base,status:'trial'}).total,1)
  assert.equal(api.demoSubscribers('',0,{...base,payments:'balance'}).subscribers[0].email,'owner@hilaloven.com')
  assert.equal(api.demoSubscribers('+٩٦١٧١٦٣٦١٨٩').subscribers[0].email,'owner@hilaloven.com')
  assert.equal(api.demoSubscribers('%_').total,0)
  const emails=api.demoSubscribers('',0,{...base,sort:'email_asc'}).subscribers.map(o=>o.email)
  assert.deepEqual(emails,[...emails].sort((a,b)=>a.localeCompare(b)))
  source.demoMenus.find(menu=>menu.restaurant.id==='demo-restaurant').restaurant.is_published=false
  assert.equal(api.demoSubscribers('',0,{...base,visibility:'hidden'}).subscribers[0].email,'owner@hilaloven.com')
  assert.equal(api.demoShopBilling('demo-restaurant').is_published,false)
  source.demoMenus.find(menu=>menu.restaurant.id==='demo-restaurant').restaurant.is_published=true
  assert.equal(api.demoSubscribers('',0,{...base,visibility:'hidden'}).total,0)
  assert.throws(()=>api.demoSubscribers('',0,{...base,registered_from:'2024-02-02',registered_to:'2024-02-01'}),/registration date range/)
})
test('demo subscriber profiles cover full accounts, empty accounts and scoped live billing/activity refresh',async()=>{
  const api=await demo(),owner=api.demoSubscribers().subscribers.find(row=>row.shops.some(shop=>shop.restaurant_id==='demo-restaurant'))
  const first=api.demoSubscriberDetails(owner.id)
  assert.equal(first.account.created_at,owner.created_at)
  assert.ok(first.account.last_sign_in_at);assert.ok(first.brand)
  assert.ok(first.shops.find(shop=>shop.billing.restaurant_id==='demo-restaurant').item_count>0)
  api.demoSetPrice('demo-restaurant',24000)
  const refreshed=api.demoSubscriberDetails(owner.id)
  assert.deepEqual(refreshed.account,first.account)
  assert.equal(refreshed.shops.find(shop=>shop.billing.restaurant_id==='demo-restaurant').billing.next_annual_cents,24000)
  assert.equal(refreshed.activity.entries[0].action,'billing.price')
  assert.ok(refreshed.activity.entries.every(entry=>owner.shops.some(shop=>shop.slug===entry.restaurant_slug)))
  const empty=api.demoSubscriberDetails('demo-empty')
  assert.equal(empty.shops.length,0);assert.equal(empty.brand,null);assert.equal(empty.account.last_sign_in_at,null)
  assert.throws(()=>api.demoSubscriberDetails('missing'),/Subscriber not found/)
})
test('cash parsing retains cents, accepts Arabic numerals and rejects malformed/overflow amounts',()=>{
  assert.equal(billing.usdCents('20.35'),2035)
  assert.equal(billing.usdCents('٢٠٫٣٥'),2035)
  for(const bad of ['0','-1','1e4','1.001','Infinity','1,20','1000000.01']) assert.throws(()=>billing.usdCents(bad))
})
test('Beirut input round-trips manually entered winter/summer dates and rejects invalid dates',()=>{
  for(const date of ['2024-01-31T08:00:00.000Z','2024-07-31T07:00:00.000Z']) {
    assert.equal(billing.parseBeirutInput(billing.beirutInput(new Date(date))),date)
  }
  assert.throws(()=>billing.parseBeirutInput('2024-02-31T10:00'))
})
test('offline receipts enforce financial rules, idempotency, corrections, owner-safe fields and branch isolation',async()=>{
  const api=await demo()
  const id='demo-restaurant', otherBefore=api.demoShopBilling('demo-restaurant-beirut',true)
  const when=billing.parseBeirutInput(billing.beirutInput())
  const start=when, end=new Date(Date.parse(api.demoShopBilling(id,true).paid_until)+17*86400000).toISOString()
  const exactCurrent=api.demoShopBilling(id,true).paid_until
  const shownCurrent=billing.parseBeirutInput(billing.beirutInput(new Date(exactCurrent)))
  assert.equal(api.demoPreview(id,8000,when,start,shownCurrent).paid_until,exactCurrent)
  assert.throws(()=>api.demoPreview(id,2000,when),/manually/)
  let q=api.demoPreview(id,2000,when,start,end)
  const request={shop_input:id,amount_input:2000,collected_input:when,starts_input:start,ends_input:end,reference_input:'DEMO-RECEIPT',note_input:'Private note',request_input:crypto.randomUUID(),version_input:q.version}
  let result=api.demoRecord(request)
  assert.equal(result.payment_count,2); assert.equal(result.remaining_cents,6000)
  assert.equal(api.demoRecord(request).payment_count,2)
  assert.equal(result.paid_until,end)
  assert.throws(()=>api.demoPreview(id,2000,when,start,end),/third payment/)
  assert.throws(()=>api.demoRecord({...request,request_input:crypto.randomUUID()}),/Billing changed/)
  assert.equal(api.demoShopBilling(id).agreements[0].receipts[0].note,null)
  api.demoSetPrice(id,24000)
  q=api.demoPreview(id,6000,when,start,end)
  result=api.demoRecord({...request,amount_input:6000,reference_input:'FINAL',request_input:crypto.randomUUID(),version_input:q.version})
  assert.equal(result.annual_cents,12000); assert.equal(result.next_annual_cents,24000)
  assert.equal(result.remaining_cents,0)
  const final=result.agreements[0].receipts[0]
  result=api.demoVoid(final.id,'Wrong cash amount',crypto.randomUUID(),result.version)
  assert.equal(result.payment_count,2); assert.equal(result.remaining_cents,6000)
  assert.equal(result.agreements[0].receipts[0].voided,true)
  assert.deepEqual(api.demoShopBilling('demo-restaurant-beirut',true),otherBefore)
  assert.ok(api.demoSubscribers('new.owner').subscribers.some(o=>!o.shops.length))
})
