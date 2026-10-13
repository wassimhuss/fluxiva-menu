import { demoBrand, demoMenus, demoPlatformAudit, demoPlatformRestaurants, demoStorageUsage } from './demo'
import type { CashAgreement, CashCollections, CashPaymentPreview, CashPaymentRequest, ShopBilling, SubscriberDetails, SubscriberPage, SubscriptionStatus } from './types'

type DemoAgreement = CashAgreement & { baseline_until: string | null; baseline_status: SubscriptionStatus }
type DemoShop = ShopBilling & { agreements: DemoAgreement[]; revision: number; email: string; restore_status: SubscriptionStatus }
const shops = new Map<string, DemoShop>()
const requests = new Map<string, CashPaymentRequest>()
const voidRequests = new Map<string, { receipt: string; reason: string; shop: string }>()
const now = () => new Date().toISOString()
const demoSessionStarted=now()
function audit(shop: DemoShop, action: string, details: typeof demoPlatformAudit[number]['details']) {
  demoPlatformAudit.unshift({ id: crypto.randomUUID(), actor_email: 'demo@fluxiva.com', action,
    restaurant_slug: shop.slug, details, created_at: now() })
}
function fail(message: string): never { throw Object.assign(new Error(message), { code: 'P0001' }) }
function syncMenu(shop: DemoShop) {
  const restaurant = demoMenus.find(m => m.restaurant.id === shop.restaurant_id)?.restaurant
  if (restaurant) {
    restaurant.subscription_status = shop.subscription_status
    restaurant.subscription_ends_at = shop.paid_until ?? undefined
  }
}
function replay(agreement: DemoAgreement) {
  let total = 0, count = 0, until = agreement.baseline_until
  const payments = [...agreement.receipts].reverse().filter(r => !r.voided)
  for (const payment of payments) {
    total += payment.amount_cents; count++
    if (!until || new Date(payment.coverage_until) > new Date(until)) until = payment.coverage_until
  }
  return { total, count, until }
}
function refresh(shop: DemoShop) {
  const a = shop.agreements[0]
  if (a) {
    const state = replay(a)
    a.paid_cents = state.total
    shop.agreement_id = a.id; shop.annual_cents = a.annual_cents
    shop.paid_cents = state.total; shop.remaining_cents = a.annual_cents - state.total
    shop.payment_count = state.count; shop.paid_until = state.until
    shop.legacy_access = false
  } else shop.annual_cents = shop.next_annual_cents
  shop.version = String(shop.revision)
  syncMenu(shop)
}
function ensureShops() {
  const sources = [...demoPlatformRestaurants, ...demoMenus.filter(m => !demoPlatformRestaurants.some(r => r.id === m.restaurant.id)).map(m => ({
    ...m.restaurant, created_at: now(), owner_email: 'owner@hilaloven.com', item_count: m.items.length, views_30d: 0,
  }))]
  for (const source of sources) {
    if (shops.has(source.id)) continue
    const shop: DemoShop = {
      restaurant_id: source.id, owner_id: 'demo-' + source.owner_email, email: source.owner_email ?? 'owner@hilaloven.com',
      name_en: source.name_en, name_ar: source.name_ar, slug: source.slug,
      archived: false, subscription_status: source.subscription_status, is_published: true,
      trial_ends_at: source.trial_ends_at ?? null,
      paid_until: source.subscription_status === 'trial' ? source.trial_ends_at ?? null : source.subscription_ends_at ?? null,
      next_annual_cents: 12000, annual_cents: 12000, agreement_id: null, paid_cents: 0,
      remaining_cents: null, payment_count: 0, legacy_access: source.subscription_status !== 'trial',
      version: '1', revision: 1, agreements: [], restore_status: source.subscription_status === 'trial' || (source.subscription_status === 'suspended' && !source.subscription_ends_at) ? 'trial' : 'active',
    }
    // A labelled demo receipt demonstrates the operator/owner workflow.
    if (source.id === 'demo-restaurant') {
      const collected = new Date(Date.now() - 30 * 86400000).toISOString()
      const until = new Date(Date.now() + 45 * 86400000).toISOString()
      shop.agreements = [{
        id: 'demo-agreement', annual_cents: 12000, paid_cents: 4000, created_at: collected,
        baseline_until: null, baseline_status: 'active',
        receipts: [{ id: 'demo-receipt', amount_cents: 4000, collected_at: collected, reference: 'DEMO-001',
          coverage_from: collected, coverage_until: until, voided: false, can_void: true, actor_email: 'demo@fluxiva.com', note: 'Illustrative demo cash receipt' }],
      }]
    }
    shops.set(source.id, shop); refresh(shop)
  }
}
function get(id: string) {
  ensureShops()
  const shop = shops.get(id)
  if (!shop) fail('Shop not found')
  return shop
}
export function demoShopBilling(id: string, admin = false): ShopBilling {
  const shop = structuredClone(get(id))
  if (!admin) for (const a of shop.agreements) for (const r of a.receipts) {
    r.note = null; r.actor_email = null; r.void_reason = null; r.can_void = false
  }
  return shop
}
export function demoSubscribers(search = '', page = 0): SubscriberPage {
  ensureShops()
  const grouped = new Map<string, SubscriberPage['subscribers'][number]>()
  for (const shop of shops.values()) {
    const created=demoPlatformRestaurants.find(source=>source.id===shop.restaurant_id)?.created_at??now()
    const owner = grouped.get(shop.owner_id) ?? { id: shop.owner_id, email: shop.email, created_at: created, archived: false, shops: [] }
    if(created<owner.created_at) owner.created_at=created
    const summary = structuredClone(shop); delete (summary as Partial<DemoShop>).agreements
    owner.shops.push(summary); grouped.set(shop.owner_id, owner)
  }
  grouped.set('demo-empty', { id: 'demo-empty', email: 'new.owner@example.com', created_at: demoSessionStarted, archived: false, shops: [] })
  const term = search.toLocaleLowerCase()
  const all = [...grouped.values()].filter(o => (o.email + ' ' + o.shops.map(s => s.name_en + ' ' + s.name_ar + ' ' + s.slug).join(' ')).toLocaleLowerCase().includes(term))
  return { subscribers: all.slice(page * 25, page * 25 + 25), total: all.length, page, page_size: 25 }
}
export function demoSubscriberDetails(ownerId:string,activityPage=0):SubscriberDetails {
  const owner=demoSubscribers().subscribers.find(row=>row.id===ownerId)
  if(!owner) fail('Subscriber not found')
  const details=owner.shops.map(billing=>{
    const menu=demoMenus.find(entry=>entry.restaurant.id===billing.restaurant_id)
    const source=demoPlatformRestaurants.find(row=>row.id===billing.restaurant_id)
    const storage=demoStorageUsage.owners.flatMap(row=>row.restaurants).find(row=>row.restaurant_id===billing.restaurant_id)
    return {billing,restaurant:menu?.restaurant??(source?{...source,default_language:'en' as const}:null),
      created_at:source?.created_at??null,updated_at:source?.created_at??null,
      category_count:menu?.categories.length??null,item_count:menu?.items.length??source?.item_count??null,
      unavailable_count:menu?.items.filter(item=>!item.available).length??null,views_30d:source?.views_30d??0,
      storage_files:storage?.file_count??0,storage_bytes:storage?.bytes??0}
  })
  const created=details.map(shop=>shop.created_at).filter((value):value is string=>Boolean(value)).sort()[0]??owner.created_at
  const entries=demoPlatformAudit.filter(entry=>entry.details.owner_id===ownerId||owner.shops.some(shop=>shop.slug===entry.restaurant_slug))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))
  return {account:{id:owner.id,email:owner.email,archived:owner.archived,created_at:created,updated_at:created,last_sign_in_at:owner.shops.length?demoSessionStarted:null,
    email_confirmed_at:owner.shops.length?created:null,phone:null,phone_confirmed_at:null,banned_until:null},
    brand:details.some(shop=>shop.billing.restaurant_id==='demo-restaurant')?{...demoBrand,owner_id:ownerId}:null,
    shops:structuredClone(details),activity:{entries:structuredClone(entries.slice(activityPage*25,activityPage*25+25)),total:entries.length,page:activityPage,page_size:25}}
}
export function demoSetSubscriberStatus(ownerId: string, status: 'active' | 'suspended') {
  ensureShops()
  const owned = [...shops.values()].filter(shop => shop.owner_id === ownerId)
  if (!owned.length) fail('Subscriber account not found')
  for (const shop of owned) demoSuspension(shop.restaurant_id, status, status === 'suspended' ? null : shop.paid_until)
}
export function demoDeleteSubscriber(ownerId: string, emailConfirmation: string) {
  ensureShops()
  const owned = [...shops.values()].filter(shop => shop.owner_id === ownerId)
  if (!owned.length) fail('Subscriber account not found')
  if (owned[0].email !== emailConfirmation.trim()) fail('Enter the subscriber email to confirm deletion')
  for (const shop of owned) shops.delete(shop.restaurant_id)
}
export function demoSetPrice(id: string, price: number) {
  const shop = get(id)
  if (!Number.isInteger(price) || price < 1 || price > 100000000) fail('Enter a valid annual USD price')
  shop.next_annual_cents = price; shop.revision++; refresh(shop)
  audit(shop, 'billing.price', { annual_cents: price })
  return demoShopBilling(id, true)
}
export function demoPreview(id: string, amount: number, collected: string, starts: string, ends: string): CashPaymentPreview {
  const shop = get(id), a = shop.agreements[0]
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) fail('Enter a positive cash amount')
  if (!Number.isFinite(new Date(collected).getTime()) || new Date(collected).getTime() > Date.now()) fail('Collection date cannot be in the future')
  if (a && a.receipts.some(r => new Date(r.collected_at) > new Date(collected))) fail('Collection date precedes the latest receipt')
  const newAgreement = !a || shop.remaining_cents === 0
  if (newAgreement && shop.subscription_status === 'active' && !shop.paid_until) fail('Existing access has no expiry; a carryover end date must be reviewed before billing')
  const price = newAgreement ? shop.next_annual_cents : a.annual_cents
  if (!price) fail('Set the annual shop price before recording cash')
  const paid = newAgreement ? 0 : shop.paid_cents, count = newAgreement ? 0 : shop.payment_count
  if (amount > price - paid) fail('Cash amount exceeds the remaining annual balance')
  if (count >= 3) fail('Maximum three payments per agreement')
  if (count === 2 && amount !== price - paid) fail('The third payment must settle the remaining balance')
  const baseline = shop.paid_until ?? (shop.subscription_status === 'suspended' ? shop.trial_ends_at : null)
  if (!Number.isFinite(Date.parse(starts)) || !Number.isFinite(Date.parse(ends))) fail('Enter access start and expiry dates manually')
  // Selecting the displayed current minute preserves its original precision.
  if (baseline && Date.parse(ends) < Date.parse(baseline) && Date.parse(ends) >= Math.floor(Date.parse(baseline) / 60000) * 60000) ends = baseline
  if (Date.parse(ends) <= Date.parse(starts) || Date.parse(ends) <= Date.parse(collected)) fail('Expiry must be after the access start and collection date')
  if (baseline && Date.parse(ends) < Date.parse(baseline)) fail('Expiry cannot shorten existing trial or paid access')
  if (Date.parse(starts) > Math.max(Date.parse(collected), Date.parse(baseline ?? collected))) fail('Access start cannot leave a future gap after current access')
  return { restaurant_id: id, annual_cents: price, amount_cents: amount, collected_at: collected,
    previous_paid_until: shop.paid_until, coverage_from: starts, paid_until: ends,
    remaining_cents: price - paid - amount, payment_count: count + 1, version: shop.version,
    suspended: shop.subscription_status === 'suspended', is_published: shop.is_published }
}
export function demoRecord(request: CashPaymentRequest) {
  const shop = get(request.shop_input)
  const saved = requests.get(request.request_input)
  if (saved) {
    if (JSON.stringify({ ...saved, version_input: '' }) !== JSON.stringify({ ...request, version_input: '' })) fail('Receipt request ID already used for different information')
    return demoShopBilling(shop.restaurant_id, true)
  }
  if (shop.version !== request.version_input) fail('Billing changed; refresh the payment preview')
  if (!request.reference_input.trim() || request.reference_input.trim().length > 120 || request.note_input.length > 2000) fail('Enter a receipt reference and a note under 2000 characters')
  const quote = demoPreview(shop.restaurant_id, request.amount_input, request.collected_input, request.starts_input, request.ends_input)
  if (!shop.agreements.length || shop.remaining_cents === 0) shop.agreements.unshift({
    id: crypto.randomUUID(), annual_cents: quote.annual_cents, paid_cents: 0, created_at: now(),
    baseline_until: shop.paid_until ?? (shop.subscription_status === 'suspended' ? shop.trial_ends_at : null),
    baseline_status: shop.subscription_status === 'suspended' ? shop.restore_status : shop.subscription_status, receipts: [],
  })
  const agreement = shop.agreements[0]
  agreement.receipts.unshift({
    id: request.request_input, amount_cents: request.amount_input, collected_at: request.collected_input,
    reference: request.reference_input.trim(), note: request.note_input.trim(), actor_email: 'demo@fluxiva.com',
    coverage_from: quote.coverage_from, coverage_until: quote.paid_until, voided: false, can_void: true,
  })
  for (const old of shop.agreements.slice(1)) for (const r of old.receipts) r.can_void = false
  if (shop.subscription_status !== 'suspended') shop.subscription_status = 'active'
  shop.restore_status = 'active'
  requests.set(request.request_input, structuredClone(request)); shop.revision++; refresh(shop)
  audit(shop, 'billing.cash_received', { receipt_id: request.request_input, amount_cents: request.amount_input,
    reference: request.reference_input.trim(), ends_at: shop.paid_until })
  return demoShopBilling(shop.restaurant_id, true)
}
export function demoVoid(receiptId: string, reason: string, requestId: string, version: string) {
  ensureShops()
  const saved = voidRequests.get(requestId)
  if (saved) {
    if (saved.receipt !== receiptId || saved.reason !== reason.trim()) fail('Correction request ID already used')
    return demoShopBilling(saved.shop, true)
  }
  const shop = [...shops.values()].find(s => s.agreements.some(a => a.receipts.some(r => r.id === receiptId)))
  if (!shop) fail('Shop not found')
  const receipt = shop.agreements[0]?.receipts.find(r => r.id === receiptId)
  if (!receipt) fail('Only the latest agreement can be corrected')
  if (reason.trim().length < 3 || reason.trim().length > 2000) fail('A correction reason of 3 to 2000 characters is required')
  if (shop.version !== version) fail('Billing changed; refresh before correcting the receipt')
  if (receipt.voided) fail('Receipt already voided')
  receipt.voided = true; receipt.can_void = false; receipt.void_reason = reason.trim()
  voidRequests.set(requestId, { receipt: receiptId, reason: reason.trim(), shop: shop.restaurant_id })
  shop.revision++; refresh(shop)
  if (!shop.payment_count) {
    shop.restore_status = shop.agreements[0].baseline_status
    if (shop.subscription_status !== 'suspended') shop.subscription_status = shop.restore_status
  }
  syncMenu(shop)
  audit(shop, 'billing.receipt_voided', { receipt_id: receiptId, reason: reason.trim(), ends_at: shop.paid_until })
  return demoShopBilling(shop.restaurant_id, true)
}
export function demoSuspension(id: string, status: SubscriptionStatus, ends: string | null) {
  const shop = get(id)
  if (status === 'active' && (shop.subscription_status !== 'suspended' || ends !== shop.paid_until)) fail('Record a cash payment to extend access')
  shop.subscription_status = status === 'active' ? shop.restore_status : status
  shop.revision++; refresh(shop)
  audit(shop, 'subscription.' + shop.subscription_status, { ends_at: shop.paid_until })
}
export function demoReviewLegacy(id: string, endsAt: string, version: string) {
  const shop = get(id)
  if (version !== shop.version) fail('Billing changed; refresh the payment preview')
  if (!endsAt || shop.paid_until || shop.agreements.length || shop.subscription_status === 'trial') fail('Only undated legacy access can be reviewed')
  shop.paid_until = endsAt; shop.revision++; refresh(shop)
  audit(shop, 'billing.legacy_review', { ends_at: endsAt })
  return demoShopBilling(id, true)
}
export function demoCollections(from: string, until: string, page = 0): CashCollections {
  ensureShops()
  const all = [...shops.values()].flatMap(s => s.agreements.flatMap(a => a.receipts.map(r => ({
    ...r, shop_id: s.restaurant_id, name_en: s.name_en, name_ar: s.name_ar, slug: s.slug, owner_email: s.email,
  })))).filter(r => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.collected_at))
    return day >= from && day <= until
  }).sort((a, b) => b.collected_at.localeCompare(a.collected_at))
  const due = [...shops.values()].filter(s => s.paid_until && new Date(s.paid_until).getTime() < Date.now() + 30 * 86400000)
    .sort((a, b) => (a.paid_until ?? '').localeCompare(b.paid_until ?? ''))
  const daily = new Map<string, CashCollections['daily_totals'][number]>()
  for (const receipt of all.filter(r => !r.voided)) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(receipt.collected_at))
    const row = daily.get(day) ?? { date: day, collected_cents: 0, receipt_count: 0 }
    row.collected_cents += receipt.amount_cents; row.receipt_count++; daily.set(day, row)
  }
  return { collected_cents: all.filter(r => !r.voided).reduce((sum, r) => sum + r.amount_cents, 0),
    daily_totals: [...daily.values()].sort((a, b) => b.date.localeCompare(a.date)),
    receipts_total: all.length, receipts: all.slice(page * 25, page * 25 + 25),
    due_total: due.length, due_shops: due.slice(page * 25, page * 25 + 25).map(s => demoShopBilling(s.restaurant_id, true)) }
}
