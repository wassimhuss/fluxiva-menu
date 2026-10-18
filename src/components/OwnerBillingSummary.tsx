import {ChevronDown,MessageCircle,RefreshCw} from 'lucide-react'
import {useEffect,useRef} from 'react'
import {cashDate,cashMoney} from '../lib/billing'
import {billingText,type BillingCopyKey} from '../lib/billingI18n'
import {subscriptionState} from '../lib/subscription'
import type {CashAgreement,Language,ShopBilling} from '../lib/types'
import {BillingIconButton} from './BillingIconButton'

/** Owner-facing explanation only; the shared panel still owns all billing reads. */
export function OwnerBillingSummary({billing,language,loading,onRefresh,children,supportContact}: {
  billing:ShopBilling;language:Language;loading:boolean;onRefresh:()=>void;children?:React.ReactNode;supportContact?:string
}) {
  const t=(key:BillingCopyKey)=>billingText(language,key)
  const money=(amount:number|null)=>cashMoney(amount,language)
  const date=(value:string|null)=>cashDate(value,language,true)
  const access=subscriptionState({subscription_status:billing.subscription_status,trial_ends_at:billing.trial_ends_at??undefined,subscription_ends_at:billing.paid_until??undefined})
  const state=billing.archived?'archived':access.kind==='suspended'?'suspended':!access.serving?'expired':access.kind
  const title:BillingCopyKey=state==='archived'?'Subscription archived':state==='suspended'?'Subscription paused':state==='expired'?'Subscription ended':state==='trial'?'Free trial':'Subscription active'
  const description:BillingCopyKey=state==='archived'?'This shop is archived. Its payment records are kept below.':state==='suspended'?'Customers cannot open your menu. Contact Fluxiva to restore access.':state==='expired'?'Customers cannot open your menu. Contact Fluxiva to renew.':state==='trial'?'Your trial is free. Arrange your subscription with Fluxiva before it ends.':'Your access dates are confirmed by Fluxiva when a payment is recorded.'
  const settled=Boolean(billing.agreement_id&&billing.payment_count>0&&billing.remaining_cents===0)
  const contact=(supportContact??'').replace(/\D/g,'')
  const canContact=/^[1-9]\d{6,14}$/.test(contact)
  const current=billing.agreements?.[0],previous=billing.agreements?.slice(1)??[]
  const history=useRef<HTMLDetailsElement>(null),help=useRef<HTMLDetailsElement>(null)
  // Native disclosures stay user-controlled between breakpoint changes.
  // Start closed to avoid a large first paint on phones; keep desktop expanded.
  useEffect(()=>{
    const wide=window.matchMedia('(min-width: 681px)')
    const sync=()=>{for(const element of [history.current,help.current])if(element)element.open=wide.matches}
    sync();wide.addEventListener('change',sync)
    return ()=>wide.removeEventListener('change',sync)
  },[])
  const receiptList=(agreement:CashAgreement)=><ul className="owner-payment-list">{agreement.receipts.map(receipt=><li key={receipt.id}>
    <details className="owner-payment">
      <summary><span><span className="owner-payment-date">{cashDate(receipt.collected_at,language)}</span><span>{t(receipt.voided?'Payment cancelled':'Cash payment')}</span></span><span className={receipt.voided?'owner-payment-amount is-cancelled':'owner-payment-amount'}><bdi>{money(receipt.amount_cents)}</bdi></span><ChevronDown size={18} aria-hidden="true"/></summary>
      <div className="owner-payment-details">
        {receipt.voided&&<p>{t('This payment was cancelled and is not included in your paid total.')}</p>}
        <dl><div><dt>{t('Receipt number')}</dt><dd><bdi>{receipt.reference}</bdi></dd></div><div><dt>{t('Payment date')}</dt><dd>{date(receipt.collected_at)}</dd></div><div><dt>{t('Access begins')}</dt><dd>{date(receipt.coverage_from)}</dd></div><div><dt>{t('Access ends')}</dt><dd>{date(receipt.coverage_until)}</dd></div></dl>
      </div>
    </details>
  </li>)}</ul>
  return <section className="owner-billing" dir={language==='ar'?'rtl':'ltr'} lang={language}>
    <header className="owner-billing-heading"><div><h1>{t('Subscription & payments')}</h1><p>{language==='ar'?billing.name_ar:billing.name_en}</p></div><BillingIconButton icon={RefreshCw} label={t('Refresh subscription')} disabled={loading} onClick={onRefresh}/></header>
    {children}
    <section className={'owner-access owner-access-'+state} aria-label={t('Subscription status')}>
      <h2>{t(title)}</h2>
      <p className="owner-access-description">{t(description)}</p>
      <div className="owner-access-date"><span>{t(access.kind==='trial'?'Trial ends':state==='suspended'?'Recorded access end':'Access ends')}</span><strong>{access.endsAt?<time dateTime={access.endsAt} title={date(access.endsAt)}><span className="owner-date-full">{date(access.endsAt)}</span><span className="owner-date-compact">{cashDate(access.endsAt,language)}</span></time>:t('End date not recorded')}</strong></div>
      {!access.endsAt&&<p>{t('Contact Fluxiva to confirm your access end date.')}</p>}
      {!billing.is_published&&state!=='archived'&&<p className="owner-visibility-note">{t('Your menu is hidden from customers.')}</p>}
    </section>
    <section className="owner-billing-section owner-billing-summary" aria-labelledby="owner-payment-summary">
      <h2 id="owner-payment-summary">{t('Your annual subscription')}</h2>
      <dl className="owner-billing-totals">
        <div><dt>{t('Annual price')}</dt><dd><bdi>{billing.annual_cents===null?t('To be confirmed'):money(billing.annual_cents)}</bdi></dd></div>
        <div><dt>{t('Paid so far')}</dt><dd><bdi>{billing.agreement_id?money(billing.paid_cents):t('Not recorded')}</bdi></dd></div>
        <div><dt>{t('Left to pay')}</dt><dd><bdi>{billing.agreement_id&&billing.remaining_cents!==null?money(billing.remaining_cents):t('To be confirmed')}</bdi></dd>{settled&&<span>{t('Fully paid')}</span>}</div>
      </dl>
      {billing.legacy_access&&<p className="owner-billing-note">{t('Earlier payments are not available here. This does not mean you have not paid.')}</p>}
    </section>
    <details ref={history} className="owner-billing-section owner-billing-history" aria-labelledby="owner-payment-history"><summary><h2 id="owner-payment-history">{t('Payment history')}</h2><ChevronDown size={18} aria-hidden="true"/></summary><div className="owner-billing-disclosure-content"><p className="owner-billing-note">{t('Cash payments recorded by Fluxiva. Open a payment for its receipt and access dates.')}</p>
      {current?.receipts.length?receiptList(current):<p className="owner-payment-empty">{t('No payments recorded here yet.')}</p>}
      {previous.length>0&&<details className="owner-previous-payments"><summary>{t('Previous subscriptions')}<ChevronDown size={18} aria-hidden="true"/></summary>{previous.map(agreement=><section key={agreement.id}><h3>{t('Annual subscription')} · {cashDate(agreement.created_at,language)} · <bdi>{money(agreement.annual_cents)}</bdi></h3>{receiptList(agreement)}</section>)}</details>}
    </div></details>
    <details ref={help} className="owner-payment-info owner-billing-help"><summary>{t('How payments work')}<ChevronDown size={18} aria-hidden="true"/></summary><div>
      {state==='active'&&<p className="owner-access-context">{t(description)}</p>}
      {access.endsAt&&<p className="owner-access-exact"><span>{t('Access ends')}</span>: <time dateTime={access.endsAt}>{date(access.endsAt)}</time></p>}
      <p>{t('Pay in USD cash, in up to three payments per annual subscription. The third payment clears the remaining balance.')}</p><p>{t('Your payment amount does not automatically set your access end date. Fluxiva confirms that date with you.')}</p><p>{t('The totals above are for your current annual subscription.')}</p>
      {state!=='archived'&&<section className="owner-billing-contact"><div><h2>{t(settled?'Planning your renewal?':'Need to arrange a payment?')}</h2><p>{t(state==='suspended'?'Payments do not automatically restore a paused subscription. Ask Fluxiva to review your access.':settled?'Your current annual subscription is fully paid. Contact Fluxiva before your access ends to renew.':'Fluxiva collects payments in person. Contact the team to agree on an amount and a collection time.')}</p></div>{canContact?<a className="button button-primary" href={'https://wa.me/'+contact} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true"/>{t('Contact Fluxiva')}</a>:<p className="owner-contact-fallback">{t('Contact your Fluxiva representative to arrange collection or ask about your subscription.')}</p>}</section>}
    </div></details>
    <p className="owner-billing-time">{t('All dates are in Beirut time.')}</p>
  </section>
}
