import { AlertTriangle, Clock, MessageCircle } from 'lucide-react'
import { needsWarning, subscriptionState } from '../lib/subscription'
import { dashboardText } from '../lib/dashboardI18n'
import type { Language, Restaurant } from '../lib/types'
import styles from './SubscriptionBanner.module.css'

/**
 * Optional. Without it the banner still explains the situation, it just has no
 * button to press — better than inventing a contact number.
 */
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined

function plural(days: number, language: Language) {
  if (language === 'ar') return days === 1 ? 'يوم واحد' : `${days} أيام`
  return days === 1 ? '1 day' : `${days} days`
}

/**
 * Tells an owner their menu is about to stop being served, or already has.
 *
 * Expiry is enforced in the database, so without this the first sign an owner
 * gets is a customer telling them the QR code is dead.
 */
export function SubscriptionBanner({ restaurant, language = 'en' }: { restaurant: Restaurant; language?: Language }) {
  const t = (english: string) => dashboardText(language, english)
  const state = subscriptionState(restaurant)
  if (!needsWarning(state)) return null

  const offline = !state.serving
  const days = state.daysLeft ?? 0

  let title: string
  let text: string

  if (state.kind === 'suspended') {
    title = t('Your menu is offline')
    text = t('This restaurant has been suspended, so its public menu and QR code are not serving customers. Contact Fluxiva to restore it.')
  } else if (offline && state.kind === 'trial') {
    title = t('Your free trial has ended')
    text = t('Your menu is no longer showing to customers, and your QR code now leads to an unavailable page. Your items are all still saved — subscribing brings the menu straight back.')
  } else if (offline) {
    title = t('Your subscription has ended')
    text = t('Your menu is no longer showing to customers, and your QR code now leads to an unavailable page. Your items are all still saved — renewing brings the menu straight back.')
  } else if (state.kind === 'trial') {
    title = `${plural(days, language)} ${t('left in your free trial')}`
    text = t('When the trial ends your menu stops showing to customers and your QR code will stop working. Subscribe before then to keep it live.')
  } else {
    title = `${t('Your subscription renews in')} ${plural(days, language)}`
    text = t('Renew before then to keep your menu and QR code working without interruption.')
  }

  return (
    <div className={`${styles.banner} ${offline ? styles.offline : styles.soon}`} role={offline ? 'alert' : 'status'}>
      <span className={styles.icon}>{offline ? <AlertTriangle /> : <Clock />}</span>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        <p className={styles.text}>{text}</p>
        {SUPPORT_WHATSAPP && (
          <div className={styles.actions}>
            <a
              className={styles.action}
              href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, I would like to renew the Fluxiva menu for ${restaurant.name_en}.`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> {offline ? t('Contact Fluxiva') : t('Renew now')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
