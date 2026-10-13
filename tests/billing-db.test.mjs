import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// Isolated real PostgreSQL. Only surrounding Supabase auth/storage services
// are stubbed; no request or mutation touches production.
const db = new PGlite()
const ids = Object.fromEntries(['admin','support','owner','other','empty'].map(k=>[k,crypto.randomUUID()]))
const legacy={owner:crypto.randomUUID(),brand:crypto.randomUUID(),shop:crypto.randomUUID(),agreement:crypto.randomUUID(),receipt:crypto.randomUUID()}
let legacySnapshot
const scalar = async (sql, params=[]) => (await db.query(sql,params)).rows[0]?.value
async function asUser(id,role='authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??''])
  await db.exec('set role '+role)
}
async function shop({end='2024-01-31T10:00:00+02:00',status='active',published=true,owner=ids.owner}={}) {
  await db.exec('reset role')
  let brand=await scalar('select id as value from public.brands where owner_id=$1',[owner])
  if(!brand) brand=await scalar("insert into public.brands(owner_id,slug,name_en,name_ar) values($1,$2,'Test','اختبار') returning id as value",[owner,'b-'+crypto.randomUUID()])
  const id=await scalar("insert into public.restaurants(owner_id,brand_id,slug,name_en,name_ar,subscription_status,subscription_ends_at,is_published,trial_ends_at) values($1,$2,$3,'Test shop','متجر اختبار',$4,$5,$6,$7) returning id as value",[owner,brand,'s-'+crypto.randomUUID(),status,end,published,status==='trial'?end:'2023-01-01T00:00:00Z'])
  await asUser(ids.admin)
  await scalar('select public.platform_set_shop_price($1,12000) as value',[id])
  return id
}
async function preview(id,amount,collected='2024-01-31T10:00:00+02:00',dates) {
  if (!dates) {
    const bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
    const start=new Date(Math.max(Date.parse(collected),Date.parse(bill.paid_until??bill.trial_ends_at??collected))).toISOString()
    dates={start,end:new Date(Date.parse(start)+90*86400000).toISOString()}
  }
  return scalar('select public.platform_preview_manual_cash_payment($1,$2,$3,$4,$5) as value',[id,amount,collected,dates.start,dates.end])
}
async function receipt(id,amount,collected='2024-01-31T10:00:00+02:00',request=crypto.randomUUID(),quote) {
  quote??=await preview(id,amount,collected)
  return scalar("select public.platform_record_manual_cash_payment($1,$2,$3,$4,$5,'CASH-TEST','Private collection note',$6,$7) as value",[id,amount,collected,quote.coverage_from,quote.paid_until,request,quote.version])
}
before(async()=>{
  await db.exec([
    "set timezone='UTC'; create role anon; create role authenticated; create role service_role bypassrls;",
    'create schema auth; create schema storage;',
    'create table auth.users(id uuid primary key,email text,created_at timestamptz default now());',
    "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    'create table storage.buckets(id text primary key,name text,public boolean,allowed_mime_types text[],file_size_limit bigint);',
    'create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);',
    'alter table storage.objects enable row level security;',
    "create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;",
    'grant usage on schema auth,storage to anon,authenticated,service_role;',
    'grant execute on function auth.uid() to anon,authenticated,service_role;',
  ].join('\n'))
  for(const name of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()) {
    if(name==='028_manual_cash_access_dates.sql') {
      await db.query("insert into auth.users(id,email) values($1,'legacy@example.com')",[legacy.owner])
      await db.query("insert into public.brands(id,owner_id,slug,name_en,name_ar) values($1,$2,'legacy-brand','Legacy','قديم')",[legacy.brand,legacy.owner])
      await db.query("insert into public.restaurants(id,owner_id,brand_id,slug,name_en,name_ar,subscription_status,subscription_ends_at) values($1,$2,$3,'legacy-shop','Legacy','قديم','active','2024-07-31T07:00:00Z')",[legacy.shop,legacy.owner,legacy.brand])
      await db.query("insert into private.cash_agreements(id,restaurant_id,shop_id,owner_id,owner_email,name_en,name_ar,slug,annual_cents,baseline_until,baseline_status) values($1,$2,$2,$3,'legacy@example.com','Legacy','قديم','legacy-shop',12000,'2024-01-31T08:00:00Z','active')",[legacy.agreement,legacy.shop,legacy.owner])
      await db.query("insert into private.cash_receipts(id,agreement_id,amount_cents,collected_at,reference,note,actor_id,actor_email,coverage_from,coverage_until) values($1,$2,6000,'2024-01-31T08:00:00Z','OLD-RECEIPT','Original cash',$3,'old-admin@example.com','2024-01-31T08:00:00Z','2024-07-31T07:00:00Z')",[legacy.receipt,legacy.agreement,legacy.owner])
      legacySnapshot=await scalar('select jsonb_build_object(\'shop\',to_jsonb(s),\'receipt\',to_jsonb(r)) as value from public.restaurants s cross join private.cash_receipts r where s.id=$1 and r.id=$2',[legacy.shop,legacy.receipt])
    }
    // UUID generation is native PostgreSQL; no other pgcrypto function is used.
    await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8').replace(/create extension if not exists pgcrypto;/gi,''))
  }
  for(const [key,id] of Object.entries(ids)) await db.query('insert into auth.users(id,email) values($1,$2)',[id,key+'@example.com'])
  await db.query("insert into private.platform_admins(user_id,role) values($1,'super_admin'),($2,'support')",[ids.admin,ids.support])
})
after(async()=>{await db.close()})

test('admin chooses exact coverage dates independently of the amount, including settlement without extension',async()=>{
  const id=await shop(), dates={start:'2024-01-31T10:00:00+02:00',end:'2024-02-29T20:15:00+02:00'}
  const quote=await preview(id,8000,undefined,dates)
  assert.equal(quote.paid_until,'2024-02-29T18:15:00+00:00')
  assert.equal((await preview(id,12000,undefined,dates)).paid_until,quote.paid_until)
  let bill=await receipt(id,8000,quote.collected_at,crypto.randomUUID(),quote)
  assert.equal(bill.paid_until,quote.paid_until); assert.equal(bill.remaining_cents,4000)
  const settlement=await preview(id,4000,undefined,dates)
  bill=await receipt(id,4000,settlement.collected_at,crypto.randomUUID(),settlement)
  assert.equal(bill.paid_until,quote.paid_until); assert.equal(bill.remaining_cents,0)
  const small=await shop()
  assert.equal((await receipt(small,1,quote.collected_at,crypto.randomUUID(),await preview(small,1,undefined,dates))).paid_until,quote.paid_until)
})
test('manual dates are required, finite, ordered, preserve existing time and cannot leave a future gap',async()=>{
  const id=await shop(), start='2024-01-31T10:00:00+02:00'
  for(const dates of [{start:null,end:null},{start,end:null},{start,end:start},{start:'2024-02-01T10:00:00+02:00',end:'2024-03-01T10:00:00+02:00'},{start,end:'infinity'}]) {
    await assert.rejects(preview(id,8000,undefined,dates),/access|expiry|gap/i)
  }
  const quoted=await preview(id,8000)
  await receipt(id,8000,quoted.collected_at,crypto.randomUUID(),quoted)
  await assert.rejects(preview(id,4000,undefined,{start,end:'2024-02-29T10:00:00+02:00'}),/shorten/)
  await assert.rejects(scalar('select public.platform_preview_cash_payment($1,8000,$2) as value',[id,start]),/manually/)
  await assert.rejects(scalar("select public.platform_record_cash_payment($1,8000,$2,'old','',$3,'old') as value",[id,start,crypto.randomUUID()]),/manually/)
})
test('choosing the displayed current expiry retains its exact legacy seconds without extending access',async()=>{
  const id=await shop({end:'2024-05-01T10:00:45.123+03:00'})
  const quote=await preview(id,8000,undefined,{start:'2024-01-31T10:00:00+02:00',end:'2024-05-01T10:00:00+03:00'})
  assert.equal(quote.paid_until,'2024-05-01T07:00:45.123+00:00')
  assert.equal((await receipt(id,8000,quote.collected_at,crypto.randomUUID(),quote)).paid_until,quote.paid_until)
})
test('cash preserves future trial, hidden/suspended flags and starts a new segment after a lapse',async()=>{
  const future=new Date(Date.now()+10*86400000).toISOString()
  const trial=await shop({end:future,status:'trial',published:false})
  let bill=await receipt(trial,4000,new Date(Date.now()-1000).toISOString())
  assert.equal(bill.is_published,false); assert.equal(bill.subscription_status,'active')
  assert.equal(new Date(bill.agreements[0].receipts[0].coverage_from).getTime(),new Date(future).getTime())
  const suspended=await shop({status:'suspended'})
  assert.equal((await receipt(suspended,4000)).subscription_status,'suspended')
  const late=await shop()
  await receipt(late,2000)
  const lateQuote=await preview(late,4000,'2024-06-01T10:00:00+03:00')
  assert.equal((await receipt(late,4000,lateQuote.collected_at,crypto.randomUUID(),lateQuote)).paid_until,lateQuote.paid_until)
})
test('limits, cash validation, locked pricing and monotonic dates are enforced',async()=>{
  const id=await shop()
  await assert.rejects(preview(id,0),/positive cash/)
  await assert.rejects(preview(id,-1),/positive cash/)
  await assert.rejects(preview(id,12001),/exceeds/)
  await assert.rejects(preview(id,100,new Date(Date.now()+86400000).toISOString()),/future/)
  await receipt(id,2000)
  await scalar('select public.platform_set_shop_price($1,24000) as value',[id])
  await receipt(id,2000)
  await assert.rejects(preview(id,2000),/third payment/)
  await assert.rejects(preview(id,8000,'2024-01-30T10:00:00+02:00'),/precedes/)
  const bill=await receipt(id,8000)
  assert.equal(bill.annual_cents,12000); assert.equal(bill.next_annual_cents,24000)
  assert.equal(bill.remaining_cents,0)
  assert.equal((await preview(id,24000)).payment_count,1)
})
test('duplicate retries create one receipt and stale concurrent previews cannot double-credit time',async()=>{
  const id=await shop(), quote=await preview(id,4000), request=crypto.randomUUID()
  await receipt(id,4000,quote.collected_at,request,quote)
  assert.equal((await receipt(id,4000,quote.collected_at,request,quote)).payment_count,1)
  await assert.rejects(receipt(id,4000,quote.collected_at,crypto.randomUUID(),quote),/Billing changed/)
  await assert.rejects(receipt(id,2000,quote.collected_at,request,quote),/different information/)
  await assert.rejects(receipt(id,4000,quote.collected_at,request,{...quote,paid_until:'2025-01-01T00:00:00Z'}),/different information/)
  const legacyRetry=await scalar("select public.platform_record_cash_payment($1,$2,$3,'CASH-TEST','Private collection note',$4,$5) as value",[id,4000,quote.collected_at,request,quote.version])
  assert.equal(legacyRetry.payment_count,1)
  await assert.rejects(scalar("select public.platform_record_cash_payment($1,$2,$3,'CASH-TEST','Private collection note',$4,$5) as value",[id,2000,quote.collected_at,request,quote.version]),/different information/)
})
test('voiding earlier cash preserves the remaining receipts explicitly entered dates',async()=>{
  const id=await shop(), first=crypto.randomUUID()
  await receipt(id,4000,undefined,first)
  const secondQuote=await preview(id,4000)
  let bill=await receipt(id,4000,secondQuote.collected_at,crypto.randomUUID(),secondQuote)
  bill=await scalar('select public.platform_void_cash_receipt($1,$2,$3,$4) as value',[first,'Incorrect receipt',crypto.randomUUID(),bill.version])
  assert.equal(bill.paid_cents,4000); assert.equal(bill.payment_count,1)
  assert.equal(bill.paid_until,secondQuote.paid_until)
  assert.equal(bill.agreements[0].receipts.find(r=>!r.voided).coverage_until,secondQuote.paid_until)
})
test('voids retain receipts, recalculate access, preserve suspension and refuse older agreements',async()=>{
  const id=await shop(), request=crypto.randomUUID()
  let bill=await receipt(id,4000,undefined,request)
  await scalar("select public.platform_set_subscription($1,'suspended',null) as value",[id])
  bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  const correction=crypto.randomUUID()
  bill=await scalar('select public.platform_void_cash_receipt($1,$2,$3,$4) as value',[request,'Incorrect cash entry',correction,bill.version])
  assert.equal(bill.paid_cents,0); assert.equal(bill.payment_count,0)
  assert.equal(bill.subscription_status,'suspended')
  assert.equal(bill.agreements[0].receipts[0].voided,true)
  assert.equal(bill.paid_until,'2024-01-31T08:00:00+00:00')
  await scalar('select public.platform_void_cash_receipt($1,$2,$3,$4) as value',[request,'Incorrect cash entry',correction,'old-version'])
  const old=crypto.randomUUID()
  await receipt(id,12000,undefined,old); await receipt(id,12000,'2024-02-01T10:00:00+02:00')
  bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  await assert.rejects(scalar('select public.platform_void_cash_receipt($1,$2,$3,$4) as value',[old,'Older agreement',crypto.randomUUID(),bill.version]),/latest agreement/)
})
test('owner, anonymous and support isolation and the legacy grant restriction hold in PostgreSQL',async()=>{
  const id=await shop()
  await receipt(id,4000); await asUser(ids.owner)
  const bill=await scalar('select public.owner_get_shop_billing($1) as value',[id])
  assert.equal(bill.agreements[0].receipts[0].note,null)
  assert.equal(bill.agreements[0].receipts[0].actor_email,null)
  await assert.rejects(scalar('select public.platform_set_shop_price($1,1) as value',[id]),/Platform access/)
  await assert.rejects(scalar('select * from private.cash_receipts'),/permission denied/)
  await asUser(ids.other)
  await assert.rejects(scalar('select public.owner_get_shop_billing($1) as value',[id]),/ownership/)
  await asUser(ids.support)
  assert.equal((await scalar('select public.platform_get_shop_billing($1) as value',[id])).paid_cents,4000)
  await assert.rejects(preview(id,4000),/Super admin/)
  await asUser(null,'anon')
  await assert.rejects(scalar('select public.platform_get_shop_billing($1) as value',[id]),/permission denied/)
  await asUser(ids.admin)
  await assert.rejects(scalar("select public.platform_set_subscription($1,'active',null) as value",[id]),/cash payment/)
})
test('directory includes empty accounts and retains archived shop financial history',async()=>{
  const id=await shop()
  await receipt(id,12000)
  let directory=await scalar("select public.platform_subscribers('empty@example.com',0) as value")
  assert.equal(directory.subscribers.length,1)
  assert.equal(directory.subscribers[0].shops.length,0)
  await db.exec('reset role'); await db.query('delete from public.restaurants where id=$1',[id]); await asUser(ids.admin)
  const bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  assert.equal(bill.archived,true); assert.equal(bill.paid_cents,12000)
  assert.equal(bill.agreements[0].receipts.length,1)
  directory=await scalar("select public.platform_subscribers('owner@example.com',0) as value")
  assert.ok(directory.subscribers[0].shops.some(s=>s.restaurant_id===id&&s.archived))
})
test('failed audit writes roll back both the cash receipt and access update',async()=>{
  const id=await shop(), quote=await preview(id,4000), request=crypto.randomUUID()
  await db.exec('reset role')
  await db.exec("create function private.test_failed_cash_audit() returns trigger language plpgsql as $$begin if new.action='billing.cash_received' then raise exception 'Simulated audit failure'; end if; return new; end$$; create trigger test_cash_audit before insert on private.platform_audit_log for each row execute function private.test_failed_cash_audit();")
  await asUser(ids.admin)
  await assert.rejects(receipt(id,4000,quote.collected_at,request,quote),/Simulated audit failure/)
  let bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  assert.equal(bill.agreement_id,null)
  assert.equal(bill.paid_cents,0)
  assert.equal(bill.paid_until,'2024-01-31T08:00:00+00:00')
  await db.exec('reset role; drop trigger test_cash_audit on private.platform_audit_log; drop function private.test_failed_cash_audit()')
  await asUser(ids.admin)
  bill=await receipt(id,4000,quote.collected_at,request,quote)
  assert.equal(bill.payment_count,1)
})
test('undated legacy review is explicit, audited and grants no invented cash receipt',async()=>{
  const id=await shop({end:null})
  await assert.rejects(preview(id,12000),/no expiry/)
  let bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  bill=await scalar('select public.platform_review_legacy_access($1,$2,$3) as value',[id,'2024-01-31T10:00:00+02:00',bill.version])
  assert.equal(bill.agreement_id,null)
  assert.equal(bill.legacy_access,true)
  assert.equal(bill.paid_cents,0)
  assert.equal((await receipt(id,12000)).remaining_cents,0)
})
test('public expiry/hidden/suspended rules remain enforced and owners cannot edit billing columns',async()=>{
  const expired=await shop()
  await receipt(expired,4000)
  const hidden=await shop({published:false})
  await receipt(hidden,4000,new Date(Date.now()-1000).toISOString())
  const suspended=await shop({status:'suspended'})
  await receipt(suspended,4000,new Date(Date.now()-1000).toISOString())
  await asUser(null,'anon')
  for(const id of [expired,hidden,suspended]) assert.equal(await scalar('select count(*) as value from public.restaurants where id=$1',[id]),0)
  await asUser(ids.owner)
  assert.equal(await scalar('select count(*) as value from public.restaurants where id=$1',[expired]),1)
  await assert.rejects(scalar("update public.restaurants set subscription_ends_at=now()+interval '1 year' where id=$1 returning id as value",[expired]),/billing operations/)
  const brand=await scalar('select brand_id as value from public.restaurants where id=$1',[expired])
  const forged=await scalar("insert into public.restaurants(owner_id,brand_id,slug,name_en,name_ar,subscription_status,subscription_ends_at,trial_ends_at) values($1,$2,$3,'New shop','متجر جديد','active',now()+interval '10 years',now()+interval '10 years') returning jsonb_build_object('status',subscription_status,'ends',subscription_ends_at,'trial_days',extract(epoch from trial_ends_at-now())/86400) as value",[ids.owner,brand,'forged-'+crypto.randomUUID()])
  assert.equal(forged.status,'trial'); assert.equal(forged.ends,null)
  assert.equal(Number(forged.trial_days),14)
})
test('collection totals exclude voids and directory pagination does not omit or duplicate owners',async()=>{
  await db.exec('reset role')
  for(let i=0;i<28;i++) await db.query('insert into auth.users(id,email) values($1,$2)',[crypto.randomUUID(),'page-'+i+'@example.com'])
  await asUser(ids.admin)
  const first=await scalar("select public.platform_subscribers('page-',0) as value")
  const second=await scalar("select public.platform_subscribers('page-',1) as value")
  assert.equal(first.total,28); assert.equal(first.subscribers.length,25); assert.equal(second.subscribers.length,3)
  assert.equal(new Set([...first.subscribers,...second.subscribers].map(o=>o.id)).size,28)
  const id=await shop(), request=crypto.randomUUID()
  let bill=await receipt(id,4000,undefined,request)
  const before=await scalar("select public.platform_cash_collections('2024-01-01','2024-01-31',0) as value")
  bill=await scalar('select public.platform_void_cash_receipt($1,$2,$3,$4) as value',[request,'Incorrect record',crypto.randomUUID(),bill.version])
  const after=await scalar("select public.platform_cash_collections('2024-01-01','2024-01-31',0) as value")
  assert.equal(before.collected_cents-after.collected_cents,4000)
  assert.equal(after.daily_totals.reduce((sum,day)=>sum+day.collected_cents,0),after.collected_cents)
  assert.equal(bill.payment_count,0)
})

test('platform storage usage attributes menu files by owner and protects the report',async()=>{
  const owned=await shop({owner:ids.owner}), other=await shop({owner:ids.other})
  await db.exec('reset role')
  await db.query('insert into storage.objects(bucket_id,name,metadata) values ($1,$2,$3),($1,$4,$5),($6,$7,$8),($9,$10,$11),($9,$12,$13)',[
    'menu-assets',`${owned}/logo.webp`,JSON.stringify({size:100}),`${owned}/item.webp`,JSON.stringify({size:300}),
    'menu-assets',`${other}/item.webp`,JSON.stringify({size:700}),
    'gallery-assets','folder/image.webp',JSON.stringify({size:500}),'folder/image-thumb.webp',JSON.stringify({size:200}),
  ])
  await db.query("insert into storage.objects(bucket_id,name,metadata) values ('menu-assets','deleted-place/old.webp','{\"size\":200}')")
  await asUser(ids.admin)
  const report=await scalar('select public.platform_storage_usage() as value')
  const owner=report.owners.find(entry=>entry.owner_id===ids.owner)
  const second=report.owners.find(entry=>entry.owner_id===ids.other)
  assert.equal(owner.bytes,400); assert.equal(owner.file_count,2)
  assert.equal(owner.restaurants.find(entry=>entry.restaurant_id===owned).bytes,400)
  assert.equal(second.bytes,700); assert.equal(report.shared_gallery_bytes,700)
  assert.equal(report.unattributed_menu_bytes,200)
  assert.equal(report.used_bytes,2000)
  await asUser(ids.support)
  assert.equal((await scalar('select public.platform_storage_usage() as value')).used_bytes,2000)
  await asUser(ids.owner)
  await assert.rejects(scalar('select public.platform_storage_usage() as value'),/Platform access/)
  await asUser(null,'anon')
  await assert.rejects(scalar('select public.platform_storage_usage() as value'),/permission denied/)
})

test('suspended trials preserve their underlying trial when the only receipt is voided',async()=>{
  const trialEnd=new Date(Date.now()+10*86400000).toISOString()
  const id=await shop({end:null,status:'suspended'})
  await db.exec('reset role')
  await db.query('update public.restaurants set trial_ends_at=$2 where id=$1',[id,trialEnd])
  await asUser(ids.admin)
  const request=crypto.randomUUID()
  let bill=await receipt(id,4000,new Date(Date.now()-1000).toISOString(),request)
  assert.equal(bill.subscription_status,'suspended')
  bill=await scalar('select public.platform_void_cash_receipt($1,$2,$3,$4) as value',[request,'Receipt entered in error',crypto.randomUUID(),bill.version])
  assert.equal(bill.subscription_status,'suspended')
  await scalar("select public.platform_set_subscription($1,'active',$2) as value",[id,bill.paid_until])
  bill=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  assert.equal(bill.subscription_status,'trial')
  assert.equal(new Date(bill.trial_ends_at).getTime(),new Date(trialEnd).getTime())
})

test('reapplying migration 028 preserves receipts, locked prices and access dates',async()=>{
  const id=await shop(), request=crypto.randomUUID()
  const before=await receipt(id,6000,undefined,request)
  await db.exec('reset role')
  await db.exec(readFileSync(new URL('../supabase/migrations/028_manual_cash_access_dates.sql',import.meta.url),'utf8'))
  await asUser(ids.admin)
  const after=await scalar('select public.platform_get_shop_billing($1) as value',[id])
  assert.deepEqual(after,before)
})
test('028 leaves pre-existing automatic receipts and shop access unchanged, then accepts manual dates',async()=>{
  await db.exec('reset role')
  const after=await scalar('select jsonb_build_object(\'shop\',to_jsonb(s),\'receipt\',to_jsonb(r)) as value from public.restaurants s cross join private.cash_receipts r where s.id=$1 and r.id=$2',[legacy.shop,legacy.receipt])
  assert.deepEqual(after,legacySnapshot)
  await asUser(ids.admin)
  const quote=await preview(legacy.shop,6000,undefined,{start:'2024-07-31T07:00:00Z',end:'2024-08-02T15:45:00Z'})
  const bill=await receipt(legacy.shop,6000,quote.collected_at,crypto.randomUUID(),quote)
  assert.equal(bill.paid_until,'2024-08-02T15:45:00+00:00')
  assert.equal(bill.agreements[0].receipts.find(r=>r.id===legacy.receipt).coverage_until,'2024-07-31T07:00:00+00:00')
})
