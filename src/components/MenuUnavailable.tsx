import { Languages, MessageCircle, Phone, RefreshCw, Utensils } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deriveTheme } from '../lib/theme'
import type { MenuContactCard } from '../lib/types'
import styles from './MenuUnavailable.module.css'

/**
 * Shown when a slug resolves to no servable menu — a lapsed subscription, a
 * suspended restaurant, or a link that never existed.
 *
 * Says nothing about why. The customer is standing in the restaurant; whether
 * the owner has paid is not their business, and showing it would embarrass the
 * restaurant in front of its own guest. The job here is to reach a human.
 */
export function MenuUnavailable({ contact, onRetry }: { contact: MenuContactCard | null; onRetry?: () => void }) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [arabicFirst,setArabic]=useState(contact?.default_language==='ar')
  useEffect(()=>{
    const element=dialog.current
    if(!element) return
    const preventDismiss=(event:Event)=>event.preventDefault()
    const keepOpen=()=>{if(!element.open) element.showModal()}
    element.addEventListener('cancel',preventDismiss)
    element.addEventListener('close',keepOpen)
    if(!element.open) element.showModal()
    return()=>{element.removeEventListener('cancel',preventDismiss);element.removeEventListener('close',keepOpen)}
  },[])
  const theme = deriveTheme(contact?.primary_color ?? '#173f35')
  const name = contact ? (arabicFirst ? contact.name_ar || contact.name_en : contact.name_en) : ''

  const english = 'This menu isn’t available right now.'
  const arabic = 'المنيو مش متاح هلّق.'
  const englishHint = 'Please ask a member of staff for today’s menu.'
  const arabicHint = 'اسأل حدا من فريق المطعم عن منيو اليوم.'

  return (
    <main
      className={styles.screen}
      dir={arabicFirst ? 'rtl' : 'ltr'}
      style={{
        '--brand': theme.brand,
        '--brand-ink': theme.brandInk,
        '--tint': theme.brandTint,
      } as React.CSSProperties}
    >
      <dialog ref={dialog} className={styles.card} dir={arabicFirst ? 'rtl' : 'ltr'} lang={arabicFirst ? 'ar' : 'en'} aria-labelledby="public-menu-unavailable-title" aria-describedby="public-menu-unavailable-hint" onCancel={event=>event.preventDefault()}>
        <button className={styles.language} type="button" aria-label={arabicFirst ? 'Switch to English' : 'حوّل للعربي'} onClick={()=>setArabic(value=>!value)}><Languages aria-hidden="true" />{arabicFirst ? 'English' : 'العربية'}</button>
        {contact?.logo_url
          ? <img className={styles.logo} src={contact.logo_url} alt="" />
          : <div className={styles.monogram}>{name ? name.slice(0, 2).toUpperCase() : <Utensils size={26} />}</div>}

        {name && <p className={styles.name}>{name}</p>}

        <h1 id="public-menu-unavailable-title" className={styles.primary}>{arabicFirst ? arabic : english}</h1>
        <p id="public-menu-unavailable-hint" className={styles.secondary}>{arabicFirst ? arabicHint : englishHint}</p>

        {(contact?.whatsapp || contact?.phone) && (
          <div className={styles.actions}>
            {contact.whatsapp && (
              <a className={styles.action} href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle /> {arabicFirst ? 'راسلنا على واتساب' : 'Message on WhatsApp'}
              </a>
            )}
            {contact.phone && (
              <a className={`${styles.action} ${styles.actionQuiet}`} href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                <Phone /> {contact.phone}
              </a>
            )}
          </div>
        )}

        <div className={styles.actions}><button type="button" className={styles.action} onClick={()=>onRetry ? onRetry() : window.location.reload()}><RefreshCw aria-hidden="true" />{arabicFirst ? 'جرّب كمان مرّة' : 'Try again'}</button><Link className={`${styles.action} ${styles.actionQuiet}`} to="/login">{arabicFirst ? 'دخول صاحب المطعم' : 'Restaurant owner sign-in'}</Link></div>
        <span className={styles.mark}>Menu by <b>fluxiva</b></span>
      </dialog>
    </main>
  )
}
