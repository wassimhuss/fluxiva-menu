import {useState} from 'react'
import type {Language} from '../lib/types'
import {registrationText} from '../lib/registrationI18n'
import {BranchRequestsPanel} from './BranchRequestsPanel'
import {ShopRegistrationsPanel} from './ShopRegistrationsPanel'

export function PlatformRequests({language,canManage,refreshToken,onOpen,initialSearch=''}: {
  language:Language;canManage:boolean;refreshToken:number;onOpen:(ownerId:string)=>void;initialSearch?:string
}) {
  const [view,setView]=useState<'registrations'|'branches'>('registrations')
  const t=(key:Parameters<typeof registrationText>[1])=>registrationText(language,key)
  return <div className="platform-requests" dir={language==='ar'?'rtl':'ltr'} lang={language}>
    <nav className="request-type-nav" aria-label={t('Request type')}><button aria-pressed={view==='registrations'} onClick={()=>setView('registrations')}>{t('New shops')}</button><button aria-pressed={view==='branches'} onClick={()=>setView('branches')}>{t('Branches')}</button></nav>
    <div className="request-trial-explanation"><p>{t('The first shop starts a 14-day free trial when setup is completed. Payment and account approval are not required to start the trial.')}</p><p>{t('Reviewing an account does not restart the trial, extend access or record a payment. Additional branches still need approval before creation.')}</p></div>
    {view==='registrations'?<ShopRegistrationsPanel initialSearch={initialSearch} language={language} canManage={canManage} refreshToken={refreshToken} onOpen={onOpen}/>:<BranchRequestsPanel admin canManage={canManage} language={language} refreshToken={refreshToken}/>}
  </div>
}
