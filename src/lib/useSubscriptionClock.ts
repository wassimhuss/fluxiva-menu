import {useEffect, useState} from 'react'
import type {SubscriptionInput} from './subscription'
import {OWNER_EDIT_WARNING_MS} from './subscription'

/** Also updates sleeping tabs on return, without refetching menu drafts. */
export function useSubscriptionClock(shop?: SubscriptionInput) {
  const [now,setNow]=useState(Date.now)
  const end=shop?.subscription_status==='trial' ? shop.trial_ends_at : shop?.subscription_ends_at
  useEffect(()=>{
    let timer: ReturnType<typeof setTimeout>
    const tick=()=>{
      const time=Date.now(); setNow(time)
      const expiry=end ? Date.parse(end) : NaN
      const boundary=[expiry,expiry+OWNER_EDIT_WARNING_MS].find(value=>value>time)
      clearTimeout(timer)
      timer=setTimeout(tick,Math.max(10,Math.min(30000,boundary ? boundary-time+5 : 30000)))
    }
    tick(); window.addEventListener('focus',tick); document.addEventListener('visibilitychange',tick)
    return ()=>{clearTimeout(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick)}
  },[end])
  return now
}
