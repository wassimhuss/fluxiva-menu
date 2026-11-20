import {Check,Eye,RefreshCw,Search,X} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import {approveShopRegistration,listShopRegistrations} from '../lib/api'
import {useAuth} from '../lib/auth'
import {cashDate} from '../lib/billing'
import {registrationError,registrationText} from '../lib/registrationI18n'
import {subscriptionState} from '../lib/subscription'
import type {Language,RegistrationFilter,ShopRegistration,ShopRegistrationPage} from '../lib/types'
import {BillingIconButton} from './BillingIconButton'
import {Loading,Notice} from './Status'
import {RegistrationBadge} from './RegistrationBadge'

export function ShopRegistrationsPanel({language,canManage,refreshToken,onOpen,initialSearch=''}: {
  language:Language;canManage:boolean;refreshToken:number;onOpen:(ownerId:string)=>void;initialSearch?:string
}) {
  const {session}=useAuth()
  const t=(key:Parameters<typeof registrationText>[1])=>registrationText(language,key)
  const [data,setData]=useState<ShopRegistrationPage|null>(null),[page,setPage]=useState(0)
  const [status,setStatus]=useState<RegistrationFilter>(initialSearch?'all':'pending'),[search,setSearch]=useState(initialSearch),[draft,setDraft]=useState(initialSearch)
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0)
  const [error,setError]=useState(''),[success,setSuccess]=useState(false),[decision,setDecision]=useState<ShopRegistration|null>(null)
  const dialog=useRef<HTMLDialogElement>(null),alive=useRef(true)
  const date=(value:string|null|undefined)=>cashDate(value,language,true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useEffect(()=>{
    const controller=new AbortController()
    setLoading(true);setError('');setData(null)
    listShopRegistrations(search,status,page,controller.signal).then(result=>{if(!controller.signal.aborted)setData(result)})
      .catch(()=>{if(!controller.signal.aborted)setError('Could not load registrations. Refresh and try again.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[search,status,page,attempt,refreshToken,session?.user.id])
  useEffect(()=>{if(decision)dialog.current?.showModal();else dialog.current?.close()},[decision])
  async function confirm() {
    if(!decision?.shop)return
    setBusy(true);setError('');setSuccess(false)
    try {
      await approveShopRegistration(decision.owner_id,decision.shop.id)
      if(alive.current){setDecision(null);setSuccess(true);setAttempt(value=>value+1)}
    } catch(cause) {if(alive.current)setError(cause instanceof Error?cause.message:typeof cause==='object'&&cause&&'message' in cause?String(cause.message):'Could not approve registration. Refresh and try again.')}
    finally {if(alive.current)setBusy(false)}
  }
  return <section className="shop-registrations" aria-label={t('New shop registrations')}>
    <div className="branch-request-heading"><h2>{t('New shop registrations')}</h2><BillingIconButton icon={RefreshCw} label={t('Refresh')} disabled={loading||busy} onClick={()=>setAttempt(value=>value+1)}/></div>
    <p>{t('New accounts appear here automatically, including owners who have not finished setting up their shop.')}</p>
    <form className="registration-filters" onSubmit={event=>{event.preventDefault();setLoading(true);setSearch(draft.trim());setPage(0);setAttempt(value=>value+1)}}>
      <label>{t('Search accounts or shops')}<input type="search" value={draft} maxLength={200} onChange={event=>setDraft(event.target.value)}/></label>
      <label>{t('Review status')}<select value={status} onChange={event=>{setLoading(true);setPage(0);setStatus(event.target.value as RegistrationFilter)}}><option value="pending">{t('Pending review')}</option><option value="approved">{t('Approved')}</option><option value="all">{t('All registrations')}</option></select></label>
      <BillingIconButton icon={Search} type="submit" label={t('Search')} disabled={loading||busy}/>
    </form>
    {error&&!decision&&<Notice tone="error">{error==='Could not load registrations. Refresh and try again.'?t(error):registrationError(language,{message:error})}</Notice>}
    {success&&<Notice tone="success">{t('Registration approved. Trial and payment dates are unchanged.')}</Notice>}
    {loading?<Loading label={t('Loading registrations…')}/>:data&&<>
      <p>{data.pending_count.toLocaleString(language==='ar'?'ar-LB':'en-US')} {t('pending review')}</p>
      {data.requests.length?<div className="branch-request-list">{data.requests.map(row=>{
        const access=row.shop?subscriptionState(row.shop):null
        const state=access?.kind==='suspended'?'Suspended':access&&!access.serving?'Expired':access?.kind==='trial'?'Trial':'Active'
        return <article className="branch-request-card registration-card" data-review-state={row.status==='pending'&&!row.shop?'setup':row.status} key={row.owner_id}>
          <header><div><h3>{row.shop?(language==='ar'?row.shop.name_ar:row.shop.name_en):row.owner_email}</h3>{row.shop&&<p><bdi>{row.owner_email}</bdi></p>}</div><RegistrationBadge status={row.status} hasShop={Boolean(row.shop)} language={language} reviewedAt={row.reviewed_at}/></header>
          <dl className="registration-dates"><div><dt>{t('Registered')}</dt><dd>{date(row.registered_at)}</dd></div>{row.shop&&<><div><dt>{t('Shop setup completed')}</dt><dd>{date(row.shop.created_at)}</dd></div><div><dt>{t('Trial ends')}</dt><dd>{date(row.shop.trial_ends_at)}</dd></div>{row.shop.subscription_status==='active'&&<div><dt>{t('Paid through')}</dt><dd>{date(row.shop.subscription_ends_at)}</dd></div>}</>}{row.reviewed_at&&<div><dt>{t('Reviewed')}</dt><dd>{date(row.reviewed_at)}</dd></div>}</dl>
          {row.shop?<div className="cash-tags"><span className="cash-tag">{t(state)}</span><bdi>/m/{row.shop.slug}</bdi>{row.shop.whatsapp&&<bdi>{row.shop.whatsapp}</bdi>}</div>:<><strong>{t('Shop setup not completed')}</strong><p>{t('The owner can finish setup and start the free trial without approval.')}</p></>}
          <div className="cash-actions registration-actions"><BillingIconButton icon={Eye} label={t('Open subscriber details')} onClick={()=>onOpen(row.owner_id)}/>{canManage&&row.status==='pending'&&row.shop&&<BillingIconButton icon={Check} label={t('Approve registration')} disabled={busy} onClick={()=>{setError('');setSuccess(false);setDecision(row)}}/>}</div>
        </article>
      })}</div>:<p className="cash-empty">{t('No registrations match this view.')}</p>}
      {data.total>25&&<div className="cash-pagination"><button className="button button-outline button-small" disabled={page===0} onClick={()=>setPage(value=>value-1)}>{t('Previous')}</button><span>{t('Page')} {page+1} / {Math.ceil(data.total/25)}</span><button className="button button-outline button-small" disabled={(page+1)*25>=data.total} onClick={()=>setPage(value=>value+1)}>{t('Next')}</button></div>}
    </>}
    <dialog ref={dialog} className="cash-confirm-dialog" aria-labelledby="registration-review-title" onCancel={event=>{if(busy)event.preventDefault();else setDecision(null)}} onClose={()=>{if(!busy)setDecision(null)}}>
      <div className="cash-section-heading"><h2 id="registration-review-title">{t('Approve this registration?')}</h2><BillingIconButton icon={X} label={t('Cancel')} disabled={busy} onClick={()=>setDecision(null)}/></div>
      <p><bdi>{decision?.owner_email}</bdi></p><p>{t('This only records your review. It grants no paid time and does not change the trial end date.')}</p>
      {error&&<Notice tone="error">{registrationError(language,{message:error})}</Notice>}
      <div className="cash-actions"><button className="button button-primary" disabled={busy} onClick={()=>void confirm()}>{t(busy?'Saving…':'Approve registration')}</button><button className="button button-outline" disabled={busy} onClick={()=>setDecision(null)}>{t('Cancel')}</button></div>
    </dialog>
  </section>
}
