import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile=name=>ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
test('demo registration reviews retain exact shop access and publication, with current/pending/empty accounts',async()=>{
  const sourceUri=uri('//'+crypto.randomUUID()+'\n'+compile('demo'))
  const source=await import(sourceUri),api=await import(uri(compile('shopRegistrationsDemo').replace("'./demo'",JSON.stringify(sourceUri))))
  const before=structuredClone(source.demoMenus)
  const list=api.demoShopRegistrations()
  const empty=list.requests.find(row=>!row.shop),owner=list.requests.find(row=>row.shop?.id==='demo-restaurant')
  assert.ok(empty);assert.ok(owner)
  assert.equal(api.demoRegistrationReview(owner.owner_id).registration_status,'pending')
  assert.throws(()=>api.demoApproveShopRegistration(empty.owner_id,'missing'),/finish shop setup/)
  assert.throws(()=>api.demoApproveShopRegistration(owner.owner_id,'wrong'),/Registration changed/)
  api.demoApproveShopRegistration(owner.owner_id,owner.shop.id);api.demoApproveShopRegistration(owner.owner_id,owner.shop.id)
  assert.equal(api.demoShopRegistrations('','approved').total,1)
  assert.equal(api.demoRegistrationReview(owner.owner_id).registration_status,'approved')
  assert.ok(api.demoRegistrationReview(owner.owner_id).registration_reviewed_at)
  assert.equal(api.demoShopRegistrations().total,list.total-1)
  assert.deepEqual(source.demoMenus,before)
  assert.equal(source.demoPlatformAudit.filter(row=>row.action==='registration.approved').length,1)
  assert.equal(api.demoShopRegistrations('%_').total,0)
})
test('registration copy keeps the 14-day trial independent of payment, review and branch approvals in both languages',async()=>{
  const {registrationText}=await import(uri(compile('registrationI18n')))
  for(const lang of ['en','ar']) {
    assert.notEqual(registrationText(lang,'New shops'),registrationText(lang,'Branches'))
    assert.ok(registrationText(lang,'The first shop starts a 14-day free trial when setup is completed. Payment and account approval are not required to start the trial.').length>40)
  }
  const page=readFileSync(new URL('../src/pages/PlatformPage.tsx',import.meta.url),'utf8')
  assert.match(page,/<PlatformRequests /)
})
