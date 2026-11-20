import {demoMenus,demoPlatformAudit,demoPlatformRestaurants} from './demo'
import type {RegistrationFilter,ShopRegistration,ShopRegistrationPage} from './types'

const started=new Date().toISOString()
const reviews=new Map<string,{shopId:string;at:string}>()
export const demoRegistrationReview=(ownerId:string)=>({registration_status:reviews.has(ownerId)?'approved' as const:'pending' as const,registration_reviewed_at:reviews.get(ownerId)?.at??null})
export function demoShopRegistrations(search='',status:RegistrationFilter='pending',page=0):ShopRegistrationPage {
  const accounts=new Map<string,ShopRegistration>()
  const sources=[...demoPlatformRestaurants,...demoMenus.filter(menu=>!demoPlatformRestaurants.some(row=>row.id===menu.restaurant.id)).map(menu=>({...menu.restaurant,owner_email:'owner@hilaloven.com',created_at:started}))]
  for(const source of sources) {
    const email=source.owner_email??'owner@hilaloven.com',id='demo-'+email
    const existing=accounts.get(id)
    if(existing&&existing.registered_at<=source.created_at) continue
    const live=demoMenus.find(menu=>menu.restaurant.id===source.id)?.restaurant??source
    const review=reviews.get(id)
    accounts.set(id,{owner_id:id,owner_email:email,registered_at:source.created_at,email_confirmed_at:source.created_at,status:review?'approved':'pending',reviewed_at:review?.at??null,reviewer_email:review?'demo@fluxiva.com':null,
      shop:{id:source.id,name_en:live.name_en,name_ar:live.name_ar,slug:live.slug,whatsapp:'whatsapp' in live?live.whatsapp:undefined,created_at:source.created_at,
        subscription_status:live.subscription_status,trial_ends_at:live.trial_ends_at,subscription_ends_at:live.subscription_ends_at,is_published:'is_published' in live?live.is_published:true}})
  }
  accounts.set('demo-empty',{owner_id:'demo-empty',owner_email:'new.owner@example.com',registered_at:started,email_confirmed_at:null,status:'pending',reviewed_at:null,reviewer_email:null,shop:null})
  const term=search.trim().toLocaleLowerCase()
  const matching=[...accounts.values()].filter(row=>[row.owner_email,row.shop?.name_en,row.shop?.name_ar,row.shop?.slug,row.shop?.whatsapp].some(value=>value?.toLocaleLowerCase().includes(term)))
  const filtered=matching.filter(row=>status==='all'||row.status===status).sort((a,b)=>b.registered_at.localeCompare(a.registered_at)||a.owner_id.localeCompare(b.owner_id))
  const selectedPage=Math.max(0,page)
  return {requests:structuredClone(filtered.slice(selectedPage*25,selectedPage*25+25)),total:filtered.length,pending_count:matching.filter(row=>row.status==='pending').length,page:selectedPage,page_size:25}
}
export function demoApproveShopRegistration(ownerId:string,shopId:string) {
  const row=demoShopRegistrations('','all').requests.find(row=>row.owner_id===ownerId)
  if(!row) throw new Error('Registration no longer available')
  if(!row.shop) throw new Error('The owner must finish shop setup before approval')
  if(row.shop.id!==shopId) throw new Error('Registration changed. Refresh and try again.')
  if(reviews.has(ownerId)) return
  const at=new Date().toISOString()
  reviews.set(ownerId,{shopId,at})
  demoPlatformAudit.unshift({id:crypto.randomUUID(),actor_email:'demo@fluxiva.com',action:'registration.approved',restaurant_slug:row.shop.slug,details:{owner_id:ownerId,owner_email:row.owner_email},created_at:at})
}
