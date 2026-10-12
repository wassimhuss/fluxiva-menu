import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const uri = code => 'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile = name => ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const billing = await import(uri(compile('billing')))
async function demo() {
  const nonce='// '+crypto.randomUUID()+'\n'
  return import(uri(nonce+compile('billingDemo').replace("'./billing'",JSON.stringify(uri(compile('billing')))).replace("'./demo'",JSON.stringify(uri(nonce+compile('demo'))))))
}
test('cash parsing retains cents, accepts Arabic numerals and rejects malformed/overflow amounts',()=>{
  assert.equal(billing.usdCents('20.35'),2035)
  assert.equal(billing.usdCents('٢٠٫٣٥'),2035)
  for(const bad of ['0','-1','1e4','1.001','Infinity','1,20','1000000.01']) assert.throws(()=>billing.usdCents(bad))
})
test('Beirut input round-trips winter/summer dates and calendar coverage agrees with PostgreSQL',()=>{
  for(const date of ['2024-01-31T08:00:00.000Z','2024-07-31T07:00:00.000Z']) {
    assert.equal(billing.parseBeirutInput(billing.beirutInput(new Date(date))),date)
  }
  assert.throws(()=>billing.parseBeirutInput('2024-02-31T10:00'))
  assert.equal(billing.calendarCoverage('2024-01-31T08:00:00Z',6000,12000),'2024-07-31T07:00:00.000Z')
  assert.equal(billing.calendarCoverage('2024-01-31T08:00:00Z',500,12000),'2024-02-14T20:00:00.000Z')
  assert.equal(billing.calendarCoverage('2024-01-31T08:00:00Z',12000,12000),'2025-01-31T08:00:00.000Z')
})
test('offline receipts enforce financial rules, idempotency, corrections, owner-safe fields and branch isolation',async()=>{
  const api=await demo()
  const id='demo-restaurant', otherBefore=api.demoShopBilling('demo-restaurant-beirut',true)
  const when=billing.parseBeirutInput(billing.beirutInput())
  let q=api.demoPreview(id,2000,when)
  const request={shop_input:id,amount_input:2000,collected_input:when,reference_input:'DEMO-RECEIPT',note_input:'Private note',request_input:crypto.randomUUID(),version_input:q.version}
  let result=api.demoRecord(request)
  assert.equal(result.payment_count,2); assert.equal(result.remaining_cents,6000)
  assert.equal(api.demoRecord(request).payment_count,2)
  assert.throws(()=>api.demoPreview(id,2000,when),/third payment/)
  assert.throws(()=>api.demoRecord({...request,request_input:crypto.randomUUID()}),/Billing changed/)
  assert.equal(api.demoShopBilling(id).agreements[0].receipts[0].note,null)
  api.demoSetPrice(id,24000)
  q=api.demoPreview(id,6000,when)
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
