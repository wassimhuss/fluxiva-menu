import {Clock3, Languages, LockKeyhole, LogOut, RefreshCw} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import type {Language, Restaurant} from '../lib/types'
import {cashDate} from '../lib/billing'

export function OwnerSubscriptionGate({shop,places,language,open,onBilling,onSwitch,onRefresh,onSignOut,onLanguage}: {
  shop:Restaurant; places:Restaurant[]; language:Language; open:boolean;
  onBilling:()=>void; onSwitch:(id:string)=>Promise<void>; onRefresh:()=>Promise<void>; onSignOut:()=>Promise<void>; onLanguage:()=>void
}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [busy,setBusy]=useState(false), [failed,setFailed]=useState(false)
  const ar=language==='ar', suspended=shop.subscription_status==='suspended'
  const text=(en:string,arabic:string)=>ar?arabic:en
  useEffect(()=>{
    const element=dialog.current
    if(!element) return
    if(!open) {element.close();return}
    const preventDismiss=(event:Event)=>event.preventDefault()
    const keepOpen=()=>{if(!element.open) element.showModal()}
    element.addEventListener('cancel',preventDismiss)
    element.addEventListener('close',keepOpen)
    if(!element.open) element.showModal()
    return()=>{element.removeEventListener('cancel',preventDismiss);element.removeEventListener('close',keepOpen)}
  },[open])
  async function act(fn:()=>Promise<void>) {setBusy(true);setFailed(false);try{await fn()}catch{setFailed(true)}finally{setBusy(false)}}
  const support=import.meta.env.VITE_SUPPORT_WHATSAPP as string|undefined
  return <dialog ref={dialog} className="subscription-gate" dir={ar?'rtl':'ltr'} lang={language} aria-labelledby="owner-expiry-title" aria-describedby="owner-expiry-description" onCancel={event=>event.preventDefault()}>
    <div className="subscription-gate-header"><span className="subscription-gate-symbol"><LockKeyhole aria-hidden="true" /></span><button type="button" className="cash-icon-button" aria-label={ar?'Switch to English':'التبديل إلى العربية'} onClick={onLanguage}><Languages aria-hidden="true" /></button></div>
    <h2 id="owner-expiry-title">{text(suspended?'This shop is suspended':'Editing is paused for this shop',suspended?'هذا المطعم موقوف':'تم إيقاف التعديل لهذا المطعم')}</h2>
    <p className="subscription-gate-shop">{ar?shop.name_ar:shop.name_en}</p>
    <p id="owner-expiry-description">{text(suspended?'Contact Fluxiva to review access. Cash payments do not automatically remove a suspension.':'Your seven-day editing window after expiry has ended. Your menu and photos are saved. Arrange a cash payment with Fluxiva to restore editing.',suspended?'تواصل مع فلوكسيفا لمراجعة حالة الوصول. تسجيل دفعة نقدية لا يلغي الإيقاف تلقائياً.':'انتهت مهلة التعديل المحدّدة بسبعة أيام بعد انتهاء الاشتراك. قائمتك وصورك محفوظة. نسّق دفعة نقدية مع فلوكسيفا لإعادة تفعيل التعديل.')}</p>
    {(shop.subscription_ends_at||shop.trial_ends_at) && <p className="subscription-gate-date">{text('Access ended:','انتهت مدة الوصول في:')} {cashDate(shop.subscription_status==='trial'?shop.trial_ends_at:shop.subscription_ends_at,language,true)}</p>}
    {failed && <p role="alert" className="notice notice-error">{text('Could not refresh access. Check your connection and try again.','تعذّر تحديث حالة الوصول. تحقق من الاتصال وحاول مجدداً.')}</p>}
    <button type="button" className="button button-primary full" onClick={onBilling}><Clock3 aria-hidden="true" />{text('Subscription & payments','الاشتراك والدفعات')}</button>
    {support && <a className="button button-outline full" target="_blank" rel="noreferrer" href={'https://wa.me/'+support.replace(/\D/g,'')}>{text('Arrange cash collection','تنسيق التحصيل النقدي')}</a>}
    {places.length>1 && <label className="subscription-gate-switch">{text('Switch to another shop','الانتقال إلى مطعم آخر')}<select value={shop.id} disabled={busy} onChange={e=>void act(()=>onSwitch(e.target.value))}>{places.map(place=><option value={place.id} key={place.id}>{ar?place.name_ar:place.name_en}</option>)}</select></label>}
    <div className="subscription-gate-actions"><button className="button button-outline" disabled={busy} onClick={()=>void act(onRefresh)}><RefreshCw aria-hidden="true" />{text(busy?'Checking…':'Check access',busy?'جارٍ التحقق…':'التحقق من الوصول')}</button><button className="button button-ghost" disabled={busy} onClick={()=>void act(onSignOut)}><LogOut aria-hidden="true" />{text('Sign out','تسجيل الخروج')}</button></div>
  </dialog>
}
