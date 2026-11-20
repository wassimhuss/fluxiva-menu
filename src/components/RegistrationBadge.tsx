import {AlertCircle,CheckCircle2,Clock3} from 'lucide-react'
import {cashDate} from '../lib/billing'
import {registrationText} from '../lib/registrationI18n'
import type {Language,PlatformSubscriber} from '../lib/types'

export function RegistrationBadge({status,hasShop,language,reviewedAt}: {
  status:PlatformSubscriber['registration_status'];hasShop:boolean;language:Language;reviewedAt?:string|null
}) {
  const state=status==='approved'?'approved':status==='pending'?(hasShop?'pending':'setup'):'unknown'
  const Icon=state==='approved'?CheckCircle2:state==='pending'?AlertCircle:Clock3
  const label=registrationText(language,state==='approved'?'Approved':state==='pending'?'Needs review':state==='setup'?'Setup incomplete':'Review status unavailable')
  return <span className={'registration-badge registration-badge-'+state} title={reviewedAt?registrationText(language,'Reviewed')+' · '+cashDate(reviewedAt,language,true):undefined}><Icon size={16} aria-hidden="true"/>{label}</span>
}
