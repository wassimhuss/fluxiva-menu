import {RotateCcw,Search,SlidersHorizontal,X} from 'lucide-react'
import {useEffect,useState} from 'react'
import {billingText,type BillingCopyKey} from '../lib/billingI18n'
import {DEFAULT_SUBSCRIBER_FILTERS,subscriberFilterCount} from '../lib/subscriberFilters'
import type {Language,SubscriberFilters} from '../lib/types'
import {BillingIconButton} from './BillingIconButton'

type SelectKey='status'|'visibility'|'payments'|'account'|'shops'|'sort'
const fields:Array<{key:SelectKey;label:BillingCopyKey;options:Array<[string,BillingCopyKey]>}>=[
  {key:'status',label:'Subscription status',options:[['any','All subscription states'],['trial','Trial'],['active','Active'],['expired','Expired'],['suspended','Suspended'],['expiring','Expires within 7 days']]},
  {key:'payments',label:'Payment records',options:[['any','Any payment record'],['balance','Remaining agreement balance'],['settled','Agreement settled'],['none','No recorded payments']]},
  {key:'visibility',label:'Publication visibility',options:[['any','Any visibility'],['listed','Listed'],['hidden','Hidden']]},
  {key:'account',label:'Account state',options:[['any','All accounts'],['current','Current accounts'],['archived','Archived accounts']]},
  {key:'shops',label:'Shop setup',options:[['any','Any shop setup'],['with','With current shops'],['none','No current shops']]},
  {key:'sort',label:'Sort results',options:[['newest','Newest registrations'],['oldest','Oldest registrations'],['email_asc','Email A–Z'],['email_desc','Email Z–A'],['expiry','Earliest shop expiry']]},
]
export function SubscriberSearch({search,filters,language,loading,onApply}: {
  search:string;filters:SubscriberFilters;language:Language;loading:boolean;onApply:(search:string,filters:SubscriberFilters)=>void
}) {
  const t=(key:BillingCopyKey)=>billingText(language,key)
  const [term,setTerm]=useState(search),[draft,setDraft]=useState<SubscriberFilters>({...filters}),[expanded,setExpanded]=useState(subscriberFilterCount(filters)>0||filters.sort!=='newest'),[invalid,setInvalid]=useState(false)
  useEffect(()=>{setTerm(search);setDraft({...filters});setInvalid(false)},[search,filters])
  const count=subscriberFilterCount(filters)
  const active=Boolean(search||count||filters.sort!=='newest')
  const clear=()=>{setTerm('');setDraft({...DEFAULT_SUBSCRIBER_FILTERS});setInvalid(false);onApply('',{...DEFAULT_SUBSCRIBER_FILTERS})}
  const chips:Array<{key:keyof SubscriberFilters|'search';label:string}>=[]
  if(search)chips.push({key:'search',label:search})
  for(const field of fields)if(filters[field.key]!==DEFAULT_SUBSCRIBER_FILTERS[field.key])chips.push({key:field.key,label:t(field.label)+': '+t(field.options.find(option=>option[0]===filters[field.key])![1])})
  if(filters.registered_from)chips.push({key:'registered_from',label:t('Registered from')+': '+filters.registered_from})
  if(filters.registered_to)chips.push({key:'registered_to',label:t('Registered through')+': '+filters.registered_to})
  return <form className="subscriber-search" noValidate onSubmit={event=>{
    event.preventDefault()
    if(draft.registered_from&&draft.registered_to&&draft.registered_from>draft.registered_to){setInvalid(true);setExpanded(true);return}
    setInvalid(false);onApply(term.trim(),{...draft})
  }}>
    <div className="cash-search"><label><span className="sr-only">{t('Search accounts, brands, shops or phone numbers')}</span><Search size={18} aria-hidden="true"/><input value={term} maxLength={200} onChange={event=>setTerm(event.target.value)} placeholder={t('Search accounts, brands, shops or phone numbers')}/></label>
      <BillingIconButton icon={Search} type="submit" label={t('Search')} disabled={loading}/>
      <div className="subscriber-filter-toggle"><BillingIconButton icon={SlidersHorizontal} label={t('Filters')+(count?' · '+count.toLocaleString(language==='ar'?'ar-LB':'en-US'):'')} aria-expanded={expanded} aria-controls="subscriber-advanced-filters" onClick={()=>setExpanded(value=>!value)}/>{count>0&&<span aria-hidden="true">{count.toLocaleString(language==='ar'?'ar-LB':'en-US')}</span>}</div>
      <BillingIconButton icon={RotateCcw} label={t('Clear search and filters')} disabled={!active&&!term&&JSON.stringify(draft)===JSON.stringify(DEFAULT_SUBSCRIBER_FILTERS)} onClick={clear}/>
    </div>
    <div id="subscriber-advanced-filters" className="subscriber-filter-panel" hidden={!expanded}>
      <div className="subscriber-filter-grid">{fields.map(field=><label key={field.key}>{t(field.label)}<select value={draft[field.key]} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value}))}>{field.options.map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>)}
        <label>{t('Registered from')}<input type="date" value={draft.registered_from} onChange={event=>{setInvalid(false);setDraft(current=>({...current,registered_from:event.target.value}))}}/></label>
        <label>{t('Registered through')}<input type="date" min={draft.registered_from||undefined} value={draft.registered_to} onChange={event=>{setInvalid(false);setDraft(current=>({...current,registered_to:event.target.value}))}}/></label>
        <button type="submit" className="button button-primary" disabled={loading}>{t('Apply filters')}</button>
      </div>
      {invalid&&<p className="notice notice-error" role="alert">{t('Enter a valid registration date range')}</p>}
      <p>{t('Shop filters match the same current shop. All shops remain listed for matching subscribers.')} {t('Registration dates exclude deleted accounts.')}</p>
    </div>
    {chips.length>0&&<div className="subscriber-filter-chips" aria-label={t('Filters')}>{chips.map(chip=><button key={chip.key} type="button" aria-label={t('Remove filter')+' · '+chip.label} onClick={()=>onApply(chip.key==='search'?'':search,chip.key==='search'?{...filters}:{...filters,[chip.key]:DEFAULT_SUBSCRIBER_FILTERS[chip.key]})}><span><bdi>{chip.label}</bdi></span><X size={15} aria-hidden="true"/></button>)}</div>}
  </form>
}
