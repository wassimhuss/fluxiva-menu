import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { timeoutManager } from '@tanstack/react-query'

// Cache expiry should not keep a completed Node test process alive.
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
  clearTimeout,
  setInterval: (callback, delay) => setInterval(callback, delay).unref(),
  clearInterval,
})

// Execute the real TS API with a controlled Supabase client; no live writes.
const uri = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const compile = (name) => ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
async function loadApi(t) {
  const nonce = `// ${crypto.randomUUID()}\n`
  const clientUri = uri(nonce + 'export let supabase=null;export function setClient(client){supabase=client}')
  const cacheUri = uri(nonce + compile('queryClient').replace("'@tanstack/react-query'", JSON.stringify(import.meta.resolve('@tanstack/react-query'))))
  const stateUri = uri(compile('menuState'))
  const filtersUri=uri(compile('subscriberFilters').replace("'./subscription'",JSON.stringify(uri(compile('subscription')))))
  const code = compile('api').replace("'./demo'", JSON.stringify(uri(nonce + compile('demo'))))
    .replace("'./supabase'", JSON.stringify(clientUri)).replace("'./subscription'", JSON.stringify(uri(compile('subscription'))))
    .replace("'./queryClient'", JSON.stringify(cacheUri)).replace("'./menuState'", JSON.stringify(stateUri))
    .replace("'./subscriberFilters'",JSON.stringify(filtersUri))
  const api = await import(uri(code))
  const client = await import(clientUri)
  const cache = await import(cacheUri)
  const queryClient = await cache.getOwnerQueryClient()
  t.after(async () => { await queryClient.cancelQueries(); cache.clearOwnerCache() })
  return { api, ...client, ...cache, queryClient }
}
const session = (id = 'owner') => ({ user: { id } })
test('branch link edits and decisions forward the reviewed slug to protected RPCs and propagate failures',async(t)=>{
  const {api,setClient}=await loadApi(t),calls=[]
  let error=null
  setClient({rpc:async(name,params)=>{calls.push({name,params});return {error}}})
  await api.updateBranchRequestLink('request','new-link','old-link')
  await api.reviewBranchRequest('request',true,'Approved','new-link')
  assert.deepEqual(calls,[
    {name:'platform_update_branch_request_link',params:{request_input:'request',slug_input:'new-link',previous_slug_input:'old-link'}},
    {name:'platform_review_branch_request_with_link',params:{request_input:'request',approve_input:true,note_input:'Approved',expected_slug_input:'new-link'}},
  ])
  error=new Error('The request link changed. Refresh and try again.')
  await assert.rejects(api.updateBranchRequestLink('request','another','old-link'),/link changed/)
  await assert.rejects(api.reviewBranchRequest('request',false,'','old-link'),/link changed/)
})
test('subscriber search forwards combined filters and sort with cancellation through the operator RPC',async(t)=>{
  const {api,setClient}=await loadApi(t),controller=new AbortController(),calls=[]
  setClient({rpc:(name,params)=>({abortSignal:signal=>{calls.push({name,params,signal});return Promise.resolve({data:{total:0,subscribers:[]},error:null})}})})
  const filters={status:'expired',visibility:'hidden',payments:'balance',account:'current',shops:'with',registered_from:'2024-01-01',registered_to:'2024-02-01',sort:'email_asc'}
  await api.listSubscribers('Literal %_',2,controller.signal,filters)
  assert.equal(calls[0].name,'platform_search_subscribers')
  assert.deepEqual(calls[0].params,{search_input:'Literal %_',filters_input:filters,page_input:2})
  controller.abort();assert.equal(calls[0].signal.aborted,true)
})
test('subscriber detail requests use only the protected RPC with cancellation and propagate failures',async(t)=>{
  const {api,setClient}=await loadApi(t),calls=[],controller=new AbortController()
  let error=null
  setClient({rpc:(name,params)=>({abortSignal:signal=>{calls.push({name,params,signal});return Promise.resolve({data:{account:{id:'owner'}},error})}})})
  assert.equal((await api.getSubscriberDetails('owner',2,controller.signal)).account.id,'owner')
  assert.equal(calls[0].name,'platform_subscriber_details')
  assert.deepEqual(calls[0].params,{owner_input:'owner',activity_page_input:2})
  controller.abort();assert.equal(calls[0].signal.aborted,true)
  error=new Error('Denied');await assert.rejects(api.getSubscriberDetails('owner'),/Denied/)
})
test('cash API forwards exact admin-entered dates to protected manual RPCs', async (t) => {
  const {api,setClient}=await loadApi(t), calls=[]
  setClient({rpc:(name,params)=>{
    calls.push({name,params})
    const result=Promise.resolve({data:{version:'reviewed'},error:null})
    result.abortSignal=()=>result
    return result
  }})
  const request={shop_input:'shop',amount_input:8000,collected_input:'2026-10-12T09:00:00Z',starts_input:'2026-10-12T09:00:00Z',ends_input:'2026-11-20T14:30:00Z',reference_input:'CASH-80',note_input:'Agreed dates',request_input:crypto.randomUUID(),version_input:'reviewed'}
  await api.previewCashPayment(request.shop_input,request.amount_input,request.collected_input,request.starts_input,request.ends_input)
  await api.recordCashPayment(request)
  assert.equal(calls[0].name,'platform_preview_manual_cash_payment')
  assert.deepEqual(calls[0].params,{shop_input:request.shop_input,amount_input:8000,collected_input:request.collected_input,starts_input:request.starts_input,ends_input:request.ends_input})
  assert.deepEqual(calls[1],{name:'platform_record_manual_cash_payment',params:request})
  const {starts_input,ends_input,...oldRequest}=request
  assert.ok(starts_input && ends_input)
  await api.recordCashPayment(oldRequest)
  assert.deepEqual(calls[2],{name:'platform_record_cash_payment',params:oldRequest})
})
test('role lookup distinguishes owners from failed requests and can recover on retry', async (t) => {
  const { api, setClient } = await loadApi(t)
  let result = { data: null, error: null }
  setClient({ rpc: () => ({ abortSignal: () => Promise.resolve(result) }) })
  assert.equal(await api.getAdminRole(), null)
  result = { data: null, error: new Error('Connection lost') }
  await assert.rejects(api.getAdminRole(), /Connection lost/)
  result = { data: 'super_admin', error: null }
  assert.equal(await api.getAdminRole(), 'super_admin')
})
const fixture = (id = 'place') => ({
  id, owner_id: 'owner', slug: id, name_en: id, name_ar: 'مطعم', default_language: 'en',
  primary_color: '#173f35', is_published: true, subscription_status: 'active',
  categories: [{ id: 'cat-b', restaurant_id: id, name_en: 'B', name_ar: 'ب', sort_order: 2 }, { id: 'cat-a', restaurant_id: id, name_en: 'A', name_ar: 'أ', sort_order: 1 }],
  items: [{ id: `${id}-dish`, restaurant_id: id, category_id: 'cat-a', name_en: 'Dish', name_ar: 'صنف', price: 100, available: true, highlighted: false, sort_order: 1, variants: [], extras: [] }],
})
function fakeClient(handler) {
  const calls = []
  class Query {
    filters = []; signal = null; patch = null; columns = null
    constructor(table) { this.table = table }
    select(columns) { this.columns = columns; return this }
    eq(key, value) { this.filters.push([key, value]); return this }
    in(key, value) { this.filters.push([key, value]); return this }
    order() { return this } limit() { return this } maybeSingle() { return this } single() { return this }
    abortSignal(signal) { this.signal = signal; return this }
    update(patch) { this.patch = patch; return this }
    then(resolve, reject) {
      calls.push(this)
      return Promise.resolve().then(() => handler(this)).then(resolve, reject)
    }
  }
  return { calls, from: (table) => new Query(table) }
}

test('public menu uses one request, retains bilingual sold-out items, and sorts tied ranks', async (t) => {
  const { api, setClient } = await loadApi(t)
  const data = fixture()
  data.items[0].available = false
  data.categories.forEach((category) => { category.sort_order = 1 })
  const client = fakeClient(() => ({ data, error: null }))
  setClient(client)
  const menu = await api.getPublicMenu('place')
  assert.equal(client.calls.length, 1)
  assert.match(client.calls[0].columns, /categories:menu_categories/)
  assert.match(client.calls[0].columns, /items:menu_items/)
  assert.deepEqual(client.calls[0].filters, [['slug', 'place'], ['is_published', true], ['subscription_status', ['trial', 'active']]])
  assert.deepEqual(menu.categories.map((category) => category.id), ['cat-a', 'cat-b'])
  assert.equal(menu.items[0].name_ar, 'صنف')
  assert.equal(menu.items[0].available, false)
  assert.ok(client.calls[0].signal instanceof AbortSignal)
  assert.equal('categories' in menu.restaurant, false)
})

test('public opens recheck eligibility instead of serving a cached hidden/suspended menu', async (t) => {
  const { api, setClient } = await loadApi(t)
  let data = fixture()
  const client = fakeClient(() => ({ data, error: null }))
  setClient(client)
  assert.ok(await api.getPublicMenu('place'))
  data = { ...data, is_published: false }
  assert.equal(await api.getPublicMenu('place'), null)
  data = { ...data, is_published: true, subscription_status: 'suspended' }
  assert.equal(await api.getPublicMenu('place'), null)
  data = { ...data, subscription_status: 'trial', trial_ends_at: '2000-01-01' }
  assert.equal(await api.getPublicMenu('place'), null)
  assert.equal(client.calls.length, 4)
})

test('brand and eligible branches arrive together in one request', async (t) => {
  const { api, setClient } = await loadApi(t)
  const client = fakeClient(() => ({ data: { id: 'brand', name_en: 'Brand', name_ar: 'علامة', restaurants: [fixture('b'), { ...fixture('hidden'), is_published: false }, fixture('a')] }, error: null }))
  setClient(client)
  const result = await api.getPublicBrand('brand')
  assert.equal(client.calls.length, 1)
  assert.deepEqual(result.restaurants.map((restaurant) => restaurant.id), ['a', 'b'])
})

test('owner loads deduplicate, cache clones, separate accounts/branches and clear on logout', async (t) => {
  const { api, setClient, clearOwnerCache } = await loadApi(t)
  const client = fakeClient((query) => ({ data: fixture(query.filters.find(([key]) => key === 'id')[1]), error: null }))
  setClient(client)
  const [first, second] = await Promise.all([api.getOwnerMenu(session(), 'place'), api.getOwnerMenu(session(), 'place')])
  assert.equal(client.calls.length, 1)
  first.items[0].price = 999
  assert.equal(second.items[0].price, 100)
  assert.equal((await api.getOwnerMenu(session(), 'place')).items[0].price, 100)
  assert.equal(client.calls.length, 1)
  await api.getOwnerMenu(session(), 'other-place')
  await api.getOwnerMenu(session('other-account'), 'place')
  assert.equal(client.calls.length, 3)
  clearOwnerCache()
  assert.equal(api.getCachedOwnerMenu(session(), 'place'), null)
  await api.getOwnerMenu(session(), 'place')
  assert.equal(client.calls.length, 4)
})

test('saved changes update only their cached fields; failed/zero-row saves retain cache', async (t) => {
  const { api, setClient } = await loadApi(t)
  let failed = false
  const client = fakeClient((query) => query.patch
    ? { data: { ...fixture().items[0], ...query.patch }, error: failed ? new Error('No matching row') : null }
    : { data: fixture(), error: null })
  setClient(client)
  await api.getOwnerMenu(session(), 'place')
  await api.updateItem('place-dish', { highlighted: true })
  await api.updateItem('place-dish', { available: false })
  const cached = api.getCachedOwnerMenu(session(), 'place')
  assert.equal(cached.items[0].highlighted, true)
  assert.equal(cached.items[0].available, false)
  failed = true
  await assert.rejects(api.updateItem('place-dish', { price: 900 }), /No matching row/)
  assert.deepEqual(api.getCachedOwnerMenu(session(), 'place'), cached)
})

test('a confirmed save cancels an older background read before it can overwrite cache', async (t) => {
  const { api, setClient, queryClient } = await loadApi(t)
  let waiting = false
  let started
  const began = new Promise((resolve) => { started = resolve })
  const client = fakeClient((query) => {
    if (query.patch) return { data: { ...fixture().items[0], ...query.patch }, error: null }
    if (!waiting) return { data: fixture(), error: null }
    started()
    return new Promise((resolve) => query.signal.addEventListener('abort', () => resolve({ data: null, error: new Error('aborted') }), { once: true }))
  })
  setClient(client)
  await api.getOwnerMenu(session(), 'place')
  await queryClient.invalidateQueries({ queryKey: ['owner-menu'] })
  waiting = true
  const refresh = api.getOwnerMenu(session(), 'place').catch(() => null)
  await began
  await api.updateItem('place-dish', { price: 200 })
  await refresh
  assert.equal(api.getCachedOwnerMenu(session(), 'place').items[0].price, 200)
})

test('clearing an account cancels pending reads and cannot repopulate private data', async (t) => {
  const { api, setClient, clearOwnerCache } = await loadApi(t)
  let started
  const began = new Promise((resolve) => { started = resolve })
  const client = fakeClient((query) => {
    started()
    return new Promise((resolve) => query.signal.addEventListener('abort', () => resolve({ data: fixture(), error: null }), { once: true }))
  })
  setClient(client)
  const pending = api.getOwnerMenu(session(), 'place').catch(() => null)
  await began
  clearOwnerCache()
  await pending
  assert.equal(api.getCachedOwnerMenu(session(), 'place'), null)
})

test('an account change while awaiting the cache prevents a new old-account request', async (t) => {
  const { api, setClient, clearOwnerCache } = await loadApi(t)
  const client = fakeClient(() => ({ data: fixture(), error: null }))
  setClient(client)
  const pending = api.getOwnerMenu(session(), 'place')
  clearOwnerCache()
  await assert.rejects(pending, /Account changed/)
  assert.equal(client.calls.length, 0)
})

test('availability rollback preserves a newer recommendation, rank, and other branch', async () => {
  const { patchMenuItem } = await import(uri(compile('menuState')))
  const restaurant = fixture()
  const menu = { restaurant, categories: restaurant.categories, items: [{ ...restaurant.items[0], available: false, highlighted: true, sort_order: 3 }] }
  const restored = patchMenuItem(menu, 'place', 'place-dish', { available: true })
  assert.equal(restored.items[0].available, true)
  assert.equal(restored.items[0].highlighted, true)
  assert.equal(restored.items[0].sort_order, 3)
  assert.equal(patchMenuItem(menu, 'other-place', 'place-dish', { available: true }), menu)
})

test('demo saved cache is isolated from drafts and retains reorder/highlight edits across branches', async (t) => {
  const { api } = await loadApi(t)
  const menu = await api.getOwnerMenu(null)
  const id = menu.restaurant.id
  await api.getOwnerMenu(null, id)
  const other = await api.getOwnerMenu(null, 'demo-restaurant-beirut')
  menu.restaurant.name_en = 'Unsaved draft'
  assert.notEqual(api.getCachedOwnerMenu(null, id).restaurant.name_en, 'Unsaved draft')
  const item = menu.items[1]
  await api.setItemHighlighted(id, item.id, true)
  await api.moveItemByOne(id, item.category_id, item.id, 'up')
  const saved = await api.getOwnerMenu(null, id)
  assert.equal(saved.items.find((entry) => entry.id === item.id).highlighted, true)
  assert.deepEqual(await api.getOwnerMenu(null, 'demo-restaurant-beirut'), other)
})
