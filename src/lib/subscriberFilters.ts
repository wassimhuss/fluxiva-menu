import type {ShopBilling,SubscriberFilters} from './types'
import {subscriptionState} from './subscription'

export const DEFAULT_SUBSCRIBER_FILTERS:Readonly<SubscriberFilters>={status:'any',visibility:'any',payments:'any',account:'any',shops:'any',registered_from:'',registered_to:'',sort:'newest'}
export const hasShopFilters=(f:SubscriberFilters)=>f.status!=='any'||f.visibility!=='any'||f.payments!=='any'
export const subscriberFilterCount=(f:SubscriberFilters)=>Object.entries(f).filter(([key,value])=>key!=='sort'&&value!==DEFAULT_SUBSCRIBER_FILTERS[key as keyof SubscriberFilters]).length
export function subscriberShopMatches(shop:ShopBilling,f:SubscriberFilters,now=Date.now()) {
  if(shop.archived) return !hasShopFilters(f)
  const state=subscriptionState({subscription_status:shop.subscription_status,trial_ends_at:shop.trial_ends_at??undefined,subscription_ends_at:shop.paid_until??undefined},now)
  const status=state.kind==='suspended'?'suspended':state.serving?state.kind:'expired'
  if(f.status!=='any'&&f.status!==status) {
    const end=state.endsAt?Date.parse(state.endsAt):NaN
    if(f.status!=='expiring'||!state.serving||!(end>now&&end<=now+7*86400000)) return false
  }
  if(f.visibility==='listed'&&!shop.is_published||f.visibility==='hidden'&&shop.is_published) return false
  if(f.payments==='balance'&&!(shop.agreement_id&&shop.remaining_cents!=null&&shop.remaining_cents>0)) return false
  if(f.payments==='settled'&&!(shop.agreement_id&&shop.payment_count>0&&shop.remaining_cents===0)) return false
  return f.payments!=='none'||shop.payment_count===0
}
export const subscriberPhoneDigits=(value:string)=>value.replace(/[٠-٩۰-۹]/g,d=>String(d.charCodeAt(0)>1775?d.charCodeAt(0)-1776:d.charCodeAt(0)-1632)).replace(/[^0-9]/g,'')
export function subscriberRegistrationDay(value:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Beirut',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value))
  const field=(type:string)=>parts.find(part=>part.type===type)?.value
  return `${field('year')}-${field('month')}-${field('day')}`
}
