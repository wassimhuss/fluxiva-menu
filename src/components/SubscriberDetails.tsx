import {ArrowLeft,ArrowRight,ChevronLeft,ChevronRight,ExternalLink,ReceiptText,RefreshCw,ShieldOff,ShieldPlus,Trash2} from 'lucide-react'
import {useEffect,useRef,useState,type ReactNode} from 'react'
import {Link} from 'react-router-dom'
import {getSubscriberDetails} from '../lib/api'
import {billingStatus,cashDate,cashMoney} from '../lib/billing'
import {billingError,billingText,type BillingCopyKey} from '../lib/billingI18n'
import {useAuth} from '../lib/auth'
import type {Language,PlatformSubscriber,ShopBilling,SubscriberDetails as Details} from '../lib/types'
import {TEMPLATES,resolveTemplateId} from '../templates/registry'
import {BillingIconButton} from './BillingIconButton'
import {Loading,Notice} from './Status'

type Tab='Account'|'Shops & payments'|'Activity'
type AccountAction='suspend'|'restore'|'delete'
function externalLink(value?:string) {
  if(!value) return null
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null} catch{return null}
}
export function SubscriberDetails({ownerId,language,refreshToken,onBack,onBilling,onAccountAction}: {
  ownerId:string;language:Language;refreshToken:number;onBack:()=>void;onBilling:(shop:ShopBilling)=>void;
  onAccountAction:(owner:PlatformSubscriber,kind:AccountAction)=>void
}) {
  const {adminRole,session}=useAuth()
  const [data,setData]=useState<Details|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<unknown>(null)
  const [tab,setTab]=useState<Tab>('Account'),[shopId,setShopId]=useState(''),[page,setPage]=useState(0),[attempt,setAttempt]=useState(0)
  const heading=useRef<HTMLHeadingElement>(null),focused=useRef(false)
  const t=(key:BillingCopyKey)=>billingText(language,key)
  const date=(value?:string|null,empty:BillingCopyKey='Not recorded')=>value?cashDate(value,language,true):t(empty)
  const number=(value:number|null)=>value===null?t('Not recorded'):value.toLocaleString(language==='ar'?'ar-LB':'en-US')
  useEffect(()=>{
    const controller=new AbortController()
    setLoading(true);setError(null)
    getSubscriberDetails(ownerId,page,controller.signal).then(result=>{
      if(controller.signal.aborted) return
      setData(result);setShopId(current=>result.shops.some(shop=>shop.billing.restaurant_id===current)?current:result.shops[0]?.billing.restaurant_id??'')
    }).catch(caught=>{if(!controller.signal.aborted)setError(caught)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[ownerId,page,refreshToken,attempt,session?.user.id])
  useEffect(()=>{if(data&&!focused.current){focused.current=true;heading.current?.focus()}},[data])
  function rows(values:Array<[BillingCopyKey,ReactNode]>) {
    return <dl className="subscriber-fields">{values.map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value??t('Not provided')}</dd></div>)}</dl>
  }
  const back=<BillingIconButton icon={language==='ar'?ArrowRight:ArrowLeft} label={t('Back to subscribers')} onClick={onBack}/>
  if(!data) return <div className="subscriber-profile">{back}{loading?<Loading label={t('Loading subscriber…')}/>:<Notice tone="error">{billingError(language,error)}<BillingIconButton icon={RefreshCw} label={t('Try again')} onClick={()=>setAttempt(n=>n+1)}/></Notice>}</div>
  const {account,brand,shops,activity}=data
  const selected=shops.find(shop=>shop.billing.restaurant_id===shopId),restaurant=selected?.restaurant
  const live=shops.filter(shop=>!shop.billing.archived)
  const suspended=live.length>0&&live.every(shop=>shop.billing.subscription_status==='suspended')
  const owner:PlatformSubscriber={id:account.id,email:account.email,created_at:account.created_at??'',archived:account.archived,shops:shops.map(shop=>shop.billing)}
  const text=(value?:string|null)=>value?<bdi>{value}</bdi>:t('Not provided')
  const flag=(value?:boolean)=>t(value?'Yes':'No')
  const link=(value?:string)=>{const href=externalLink(value);return href?<a href={href} target="_blank" rel="noreferrer"><bdi>{value}</bdi><ExternalLink size={14} aria-hidden="true"/></a>:text(value)}
  const actionName=(action:string):BillingCopyKey=>({
    'account.suspended':'Account suspended','account.active':'Account restored','account.deleted':'Account deleted',
    'billing.cash_received':'Cash recorded','billing.receipt_voided':'Receipt corrected','billing.price':'Price updated',
    'subscription.suspended':'Menu suspended','subscription.active':'Menu access restored','subscription.trial':'Trial access restored',
    'billing.legacy_review':'Existing access reviewed',
  } as Record<string,BillingCopyKey>)[action]??'Access updated'
  return <div className="subscriber-profile" aria-busy={loading}>
    <header className="subscriber-heading">{back}<div><h2 ref={heading} tabIndex={-1}><bdi>{account.email}</bdi></h2><p>{account.archived?t('Deleted account — retained financial history'):t('Registered')+' '+date(account.created_at)}</p></div>
      {adminRole==='super_admin'&&!account.archived&&<div className="cash-actions">{live.length>0&&<BillingIconButton icon={suspended?ShieldPlus:ShieldOff} danger={!suspended} label={t(suspended?'Restore account access':'Suspend account')} onClick={()=>onAccountAction(owner,suspended?'restore':'suspend')}/>}<BillingIconButton icon={Trash2} danger label={t('Delete account')} onClick={()=>onAccountAction(owner,'delete')}/></div>}
    </header>
    <nav className="subscriber-tabs" aria-label={t('Subscriber details')}>{(['Account','Shops & payments','Activity'] as Tab[]).map(item=><button key={item} type="button" aria-pressed={tab===item} onClick={()=>setTab(item)}>{t(item)}</button>)}</nav>
    {Boolean(error)&&<Notice tone="error">{billingError(language,error)}<BillingIconButton icon={RefreshCw} label={t('Try again')} onClick={()=>setAttempt(n=>n+1)}/></Notice>}
    {tab==='Account'&&<>
      <section className="subscriber-section"><h3>{t('Account details')}</h3>{account.archived&&<p className="subscriber-note">{t('Original account dates are unavailable after deletion. Receipt dates remain in the billing history.')}</p>}{rows([
        ['Email address',text(account.email)],['Registered',date(account.created_at)],['Last sign-in',date(account.last_sign_in_at,'No sign-in recorded')],
        ['Last account update',date(account.updated_at)],['Email confirmed',date(account.email_confirmed_at,'Not confirmed')],
        ['Phone number',text(account.phone)],['Phone confirmed',date(account.phone_confirmed_at,'Not confirmed')],
        ['Sign-in restricted until',account.banned_until&&Date.parse(account.banned_until)>Date.now()?date(account.banned_until):t('No restriction recorded')],['Account ID',text(account.id)],
      ])}</section>
      <section className="subscriber-section"><h3>{t('Brand')}</h3>{brand?rows([
        ['English name',<span dir="ltr">{brand.name_en}</span>],['Arabic name',<span dir="rtl">{brand.name_ar}</span>],
        ['Brand link',<Link to={'/b/'+encodeURIComponent(brand.slug)} target="_blank" rel="noreferrer"><bdi>/b/{brand.slug}</bdi><ExternalLink size={14} aria-hidden="true"/></Link>],
        ['Default language',t(brand.default_language==='ar'?'Arabic':'English')],['Brand color',text(brand.primary_color)],
      ]):<p className="subscriber-note">{t('No brand created yet')}</p>}</section>
    </>}
    {tab==='Shops & payments'&&<>
      {shops.length?<><label className="subscriber-shop-select">{t('Choose a shop')}<select value={shopId} onChange={event=>setShopId(event.target.value)}>{shops.map(shop=><option key={shop.billing.restaurant_id} value={shop.billing.restaurant_id}>{language==='ar'?shop.billing.name_ar:shop.billing.name_en} · {t(shop.billing.archived?'Archived':billingStatus(shop.billing))}</option>)}</select></label>
        {selected&&<><section className="subscriber-section"><div className="cash-section-heading"><h3>{language==='ar'?selected.billing.name_ar:selected.billing.name_en}</h3><BillingIconButton icon={ReceiptText} label={t('Open billing')} onClick={()=>onBilling(selected.billing)}/></div><div className="cash-tags"><span className="cash-tag">{t(selected.billing.archived?'Archived':billingStatus(selected.billing))}</span><span>{t(selected.billing.is_published?'Listed':'Hidden')}</span></div>
          {rows([['Shop created',date(selected.created_at)],['Last shop update',date(selected.updated_at)],['Trial ends',date(selected.billing.trial_ends_at)],
            ['Paid through',date(selected.billing.subscription_status==='trial'?null:selected.billing.paid_until,'No paid access recorded')],['Annual price',<bdi>{cashMoney(selected.billing.annual_cents,language)}</bdi>],
            ['Cash received',<bdi>{cashMoney(selected.billing.agreement_id?selected.billing.paid_cents:null,language)}</bdi>],['Remaining annual balance',<bdi>{cashMoney(selected.billing.remaining_cents,language)}</bdi>],['Shop ID',text(selected.billing.restaurant_id)]])}
          {selected.billing.legacy_access&&<p className="subscriber-note">{t('Existing subscription—payment history unavailable')}</p>}
          {!restaurant&&<p className="subscriber-note">{t('Shop records are unavailable after deletion. Open billing to see retained financial records.')}</p>}
        </section>
        {restaurant&&<>
          <section className="subscriber-section"><h3>{t('Shop details')}</h3>{rows([
            ['English name',<span dir="ltr">{restaurant.name_en}</span>],['Arabic name',<span dir="rtl">{restaurant.name_ar}</span>],
            ['Description in English',<span dir="ltr">{restaurant.description_en||t('Not provided')}</span>],['Description in Arabic',<span dir="rtl">{restaurant.description_ar||t('Not provided')}</span>],
            ['Address in English',<span dir="ltr">{restaurant.address_en||t('Not provided')}</span>],['Address in Arabic',<span dir="rtl">{restaurant.address_ar||t('Not provided')}</span>],
            ['Phone number',text(restaurant.phone)],['WhatsApp',text(restaurant.whatsapp)],['Instagram',link(restaurant.instagram)],['Map link',link(restaurant.maps_url)],
            ['Public menu',<Link to={'/m/'+encodeURIComponent(restaurant.slug)} target="_blank" rel="noreferrer"><bdi>/m/{restaurant.slug}</bdi><ExternalLink size={14} aria-hidden="true"/></Link>],
          ])}</section>
          <section className="subscriber-section"><h3>{t('Menu settings')}</h3>{rows([
            ['Menu currency',text(restaurant.currency??'LBP')],['Default language',t(restaurant.default_language==='ar'?'Arabic':'English')],
            ['Menu design',TEMPLATES.find(template=>template.id===resolveTemplateId(restaurant.template_id))?.name],['Brand color',text(restaurant.primary_color)],
            ['Food photos',t(restaurant.show_item_images!==false?'Enabled':'Disabled')],['Takeaway orders',t(restaurant.takeaway_enabled?'Enabled':'Disabled')],
            ['Temporarily closed',flag(restaurant.temporarily_closed)],['Menu copy pending',flag(restaurant.menu_copy_pending)],
          ])}</section>
          <section className="subscriber-section"><h3>{t('Menu statistics')}</h3>{rows([
            ['Categories',number(selected.category_count)],['Menu items',number(selected.item_count)],['Unavailable items',number(selected.unavailable_count)],
            ['Menu opens in 30 days',number(selected.views_30d)],['Uploaded files',number(selected.storage_files)],
            ['Uploaded file size',selected.storage_bytes===null?t('Not recorded'):<bdi>{(selected.storage_bytes/1000000).toLocaleString(language==='ar'?'ar-LB':'en-US',{maximumFractionDigits:2})} MB</bdi>],
          ])}</section>
        </>}
        </>}
      </>:<p className="subscriber-note">{t('No shop created yet')}</p>}
    </>}
    {tab==='Activity'&&<section className="subscriber-section"><h3>{t('Recent activity')}</h3><p className="subscriber-note">{t('Recorded admin activity for this subscriber. Sign-in history is not included.')}</p>{loading?<Loading label={t('Loading activity…')}/>:<>
      {activity.entries.length?<ol className="subscriber-activity">{activity.entries.map(entry=><li key={entry.id}><div><strong>{t(actionName(entry.action))}</strong><time dateTime={entry.created_at}>{date(entry.created_at)}</time></div>{rows([
        ['Recorded by',text(entry.actor_email)],...(entry.restaurant_slug?[['Shop',<bdi>/m/{entry.restaurant_slug}</bdi>] as [BillingCopyKey,ReactNode]]:[]),
        ...(entry.details.amount_cents!=null?[['Amount',<bdi>{cashMoney(entry.details.amount_cents,language)}</bdi>] as [BillingCopyKey,ReactNode]]:[]),
        ...(entry.details.annual_cents!=null?[['Annual price',<bdi>{cashMoney(entry.details.annual_cents,language)}</bdi>] as [BillingCopyKey,ReactNode]]:[]),
        ...(entry.details.reference?[['Receipt reference',text(entry.details.reference)] as [BillingCopyKey,ReactNode]]:[]),
        ...(entry.details.ends_at?[['Recorded expiry',date(entry.details.ends_at)] as [BillingCopyKey,ReactNode]]:[]),
        ...(entry.details.previous_ends_at?[['Previous access end',date(entry.details.previous_ends_at)] as [BillingCopyKey,ReactNode]]:[]),
        ...(entry.details.reason?[['Reason',entry.details.reason] as [BillingCopyKey,ReactNode]]:[]),
      ])}</li>)}</ol>:<p className="subscriber-note">{t('No activity recorded yet.')}</p>}
      <div className="cash-pagination"><BillingIconButton icon={language==='ar'?ChevronRight:ChevronLeft} label={t('Previous')} disabled={page===0} onClick={()=>setPage(n=>n-1)}/><span>{t('Page')} <bdi>{number(page+1)} / {number(Math.max(1,Math.ceil(activity.total/25)))}</bdi></span><BillingIconButton icon={language==='ar'?ChevronLeft:ChevronRight} label={t('Next')} disabled={(page+1)*25>=activity.total} onClick={()=>setPage(n=>n+1)}/></div>
    </>}</section>}
  </div>
}
