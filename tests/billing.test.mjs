import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const uri = code => 'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile = name => ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const billing = await import(uri(compile('billing')))
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
async function demo() {
  const nonce='// '+crypto.randomUUID()+'\n'
  return import(uri(nonce+compile('billingDemo').replace("'./billing'",JSON.stringify(uri(compile('billing')))).replace("'./demo'",JSON.stringify(uri(nonce+compile('demo'))))))
}
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
