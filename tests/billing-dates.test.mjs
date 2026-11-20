import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile=name=>ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const billingUri=uri(compile('billing'))
const {beirutInput}=await import(billingUri)
const {addBillingMonths,beirutDayStart,beirutDayExpiry,accessThroughDay,collectionDateInstant}=await import(uri(compile('billingDates').replace("'./billing'",JSON.stringify(billingUri))))
test('explicit month shortcuts clamp month ends and preserve leap/year boundaries',()=>{
  assert.equal(addBillingMonths('2024-01-31',1),'2024-02-29')
  assert.equal(addBillingMonths('2023-01-31',1),'2023-02-28')
  assert.equal(addBillingMonths('2024-02-29',12),'2025-02-28')
  assert.equal(addBillingMonths('2026-11-20',3),'2027-02-20')
  for(const day of ['2024-02-31','not a date'])assert.throws(()=>addBillingMonths(day,3),/valid date/)
  for(const months of [0,-1,1.5,NaN])assert.throws(()=>addBillingMonths('2026-11-20',months),/valid number/)
})
test('selected expiry includes the whole Beirut day across normal and daylight saving boundaries',()=>{
  for(const day of ['2024-02-29','2024-03-30','2024-03-31','2024-10-26','2024-10-27','2026-12-31']) {
    const end=beirutDayExpiry(day),lastInstant=new Date(Date.parse(end)-1)
    assert.equal(beirutInput(lastInstant).slice(0,10),day)
    assert.equal(accessThroughDay(end),day)
    assert.ok(Date.parse(end)>Date.parse(beirutDayStart(day)))
  }
  assert.equal(accessThroughDay('2027-09-27T12:08:02.803184Z'),'2027-09-27')
})
test('date-only collection handles today, backdating and later same-day receipts including voids',()=>{
  const now=new Date('2026-11-20T09:22:33.456Z')
  assert.equal(collectionDateInstant('2026-11-20',null,now),now.toISOString())
  assert.equal(beirutInput(new Date(collectionDateInstant('2026-11-19',null,now))),'2026-11-19T12:00')
  const latest='2026-11-19T17:23:24.123456Z'
  assert.equal(collectionDateInstant('2026-11-19',latest,now),latest)
  assert.throws(()=>collectionDateInstant('2026-11-21',null,now),/future/)
})
test('admin form has no time pickers and preserves exact uncertain receipts and chosen current boundaries',()=>{
  const source=readFileSync(new URL('../src/components/ShopBillingPanel.tsx',import.meta.url),'utf8')
  assert.ok(!source.includes('datetime-local'))
  assert.match(source,/exactStarts\.current\?\?beirutDayStart\(starts\)/)
  assert.match(source,/exactEnds\.current\?\?beirutDayExpiry\(ends\)/)
  assert.match(source,/const prepared = pending \?\? \{ preview/)
})
