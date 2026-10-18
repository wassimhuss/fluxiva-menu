import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {resolve,dirname} from 'node:path'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require=createRequire(import.meta.url),cache=new Map()
function moduleUri(path) {
  if(cache.has(path)) return cache.get(path)
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const code=source.replace(/from (["'])([^"']+)\1/g,(_,quote,name)=>{
    const target=name.startsWith('.')?moduleUri(resolve(dirname(path),name+(name.includes('BillingIconButton')?'.tsx':'.ts'))):pathToFileURL(require.resolve(name)).href
    return 'from '+JSON.stringify(target)
  })
  const uri='data:text/javascript;base64,'+Buffer.from(code).toString('base64')
  cache.set(path,uri);return uri
}
const {OwnerBillingSummary}=await import(moduleUri(resolve('src/components/OwnerBillingSummary.tsx')))
const receipt={id:'receipt',amount_cents:4000,collected_at:'2026-01-01T10:00:00Z',reference:'FV-123',coverage_from:'2026-01-01T10:00:00Z',coverage_until:'2099-02-01T10:00:00Z',voided:false,can_void:false,note:'Internal note must stay private',actor_email:'internal-admin@example.com'}
const shop={restaurant_id:'shop',owner_id:'owner',name_en:'Test Restaurant',name_ar:'مطعم الاختبار',slug:'test',archived:false,subscription_status:'active',is_published:true,trial_ends_at:'2001-01-01',paid_until:'2099-02-01T10:00:00Z',next_annual_cents:12000,annual_cents:12000,agreement_id:'agreement',paid_cents:4000,remaining_cents:8000,payment_count:1,legacy_access:false,version:'1',agreements:[{id:'agreement',annual_cents:12000,created_at:'2026-01-01',paid_cents:4000,receipts:[receipt]}]}
const render=(overrides={},props={})=>renderToStaticMarkup(React.createElement(OwnerBillingSummary,{billing:{...shop,...overrides},language:'en',loading:false,onRefresh:()=>{},...props}))

test('owner billing explains partial payments independently from manual access and hides staff-only fields',()=>{
  const html=render()
  for(const phrase of ['Subscription active','Paid so far','Left to pay','$40.00','$80.00','2099','How payments work','does not automatically set your access end date']) assert.ok(html.includes(phrase),phrase)
  for(const phrase of ['Next collection date','Payment number','Record cash payment','Internal note must stay private','internal-admin@example.com','can_void']) assert.ok(!html.includes(phrase),phrase)
  assert.match(html,/<details class="owner-payment">/)
  assert.match(html,/<time dateTime="2099-02-01T10:00:00Z"/)
})
test('owner billing distinguishes trials, exact expired access, suspended access and hidden publication',()=>{
  const trial=render({subscription_status:'trial',trial_ends_at:'2098-01-01',paid_until:'2099-02-01T10:00:00Z'})
  assert.ok(trial.includes('Free trial'));assert.ok(trial.includes('Trial ends'));assert.ok(trial.includes('2098'))
  const expired=render({paid_until:'2001-01-01'})
  assert.ok(expired.includes('Subscription ended'));assert.ok(expired.includes('Customers cannot open your menu.'))
  const paused=render({subscription_status:'suspended'})
  assert.ok(paused.includes('Subscription paused'));assert.ok(paused.includes('Payments do not automatically restore'))
  const hidden=render({is_published:false})
  assert.ok(hidden.includes('Subscription active'));assert.ok(hidden.includes('Your menu is hidden from customers.'))
})
test('unknown historical payments and undated access never become zero debt or unlimited access claims',()=>{
  const html=render({legacy_access:true,agreement_id:null,annual_cents:null,remaining_cents:null,paid_until:null,agreements:[]})
  for(const phrase of ['End date not recorded','To be confirmed','Not recorded','This does not mean you have not paid.']) assert.ok(html.includes(phrase),phrase)
  assert.ok(!html.includes('$0.00'));assert.ok(!html.includes('Fully paid'))
})
test('settlement, cancelled receipts and previous agreements retain clear separate meanings',()=>{
  const html=render({paid_cents:12000,remaining_cents:0,agreements:[{...shop.agreements[0],receipts:[{...receipt,voided:true}]},{...shop.agreements[0],id:'older',annual_cents:6000,receipts:[{...receipt,id:'old',reference:'OLD-REF'}]}]})
  for(const phrase of ['Fully paid','Planning your renewal?','Payment cancelled','not included in your paid total','Previous subscriptions','OLD-REF']) assert.ok(html.includes(phrase),phrase)
})
test('Arabic owner content is RTL and contact actions require a usable configured support phone',()=>{
  const html=render({}, {language:'ar',supportContact:'+961 70 123 456',loading:true})
  assert.ok(html.includes('dir="rtl"'));assert.ok(html.includes('lang="ar"'))
  for(const phrase of ['اشتراكك شغّال','اللي دفعتو لهلّق','اللي بعد عليك','سجل الدفعات','احكي مع فلوكسيفا']) assert.ok(html.includes(phrase),phrase)
  assert.ok(html.includes('https://wa.me/96170123456'))
  assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="تحديث بيانات الاشتراك"/)
  assert.ok(!render({}, {supportContact:'---'}).includes('wa.me'))
  assert.ok(render().includes('Contact your Fluxiva representative'))
})

test('mobile starts with closed history/help disclosures while retaining receipts, contact and exact access details',()=>{
  const html=render({}, {supportContact:'+96170123456'})
  assert.match(html,/<details class="owner-billing-section owner-billing-history"[^>]*><summary>/)
  assert.match(html,/<details class="owner-payment-info owner-billing-help"><summary>/)
  assert.doesNotMatch(html,/<details[^>]*class="owner-billing-section owner-billing-history"[^>]*open/)
  assert.match(html,/class="owner-date-full"/)
  assert.match(html,/class="owner-date-compact"/)
  assert.ok(html.includes('FV-123'))
  assert.ok(html.includes('https://wa.me/96170123456'))
  const paused=render({subscription_status:'suspended',is_published:false,paid_until:null})
  const status=paused.slice(paused.indexOf('<section class="owner-access'),paused.indexOf('<section class="owner-billing-section'))
  for(const warning of ['Customers cannot open your menu','End date not recorded','Your menu is hidden'])assert.ok(status.includes(warning),warning)
  const archived=render({archived:true})
  assert.match(archived,/Subscription archived/)
  assert.doesNotMatch(archived,/Need to arrange a payment/)
})

test('native disclosures adapt at the desktop breakpoint and unsubscribe without overriding user toggles on rerender',async()=>{
  const code=readFileSync('src/components/OwnerBillingSummary.tsx','utf8')
  const ast=ts.createSourceFile('OwnerBillingSummary.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let effect
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect')effect=node.arguments[0].getText(ast);ts.forEachChild(node,visit)}
  visit(ast)
  assert.ok(effect)
  const fixture=`export function harness(initial) {const history={current:{open:false}},help={current:{open:false}};let listener,removed=false;const media={matches:initial,addEventListener:(name,fn)=>{listener=fn},removeEventListener:(name,fn)=>{removed=listener===fn}};const window={matchMedia:query=>{if(query!=='(min-width: 681px)')throw Error(query);return media}};const cleanup=(${effect})();return {history,help,resize(matches){media.matches=matches;listener()},cleanup,get removed(){return removed}};}`
  const compiled=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  const {harness}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
  const mobile=harness(false)
  assert.equal(mobile.history.current.open,false);assert.equal(mobile.help.current.open,false)
  mobile.history.current.open=true // a user's native toggle remains until a breakpoint transition
  assert.equal(mobile.help.current.open,false)
  mobile.resize(true);assert.equal(mobile.history.current.open,true);assert.equal(mobile.help.current.open,true)
  mobile.resize(false);assert.equal(mobile.history.current.open,false);assert.equal(mobile.help.current.open,false)
  mobile.cleanup();assert.equal(mobile.removed,true)
  assert.equal(harness(true).history.current.open,true)
})
