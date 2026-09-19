import { MessageCircle, Phone, Utensils } from 'lucide-react'
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
export function MenuUnavailable({ contact }: { contact: MenuContactCard | null }) {
  const theme = deriveTheme(contact?.primary_color ?? '#173f35')
  const arabicFirst = contact?.default_language === 'ar'
  const name = contact ? (arabicFirst ? contact.name_ar || contact.name_en : contact.name_en) : ''

  const english = 'This menu isn’t available right now.'
  const arabic = 'القائمة غير متاحة حالياً.'
  const englishHint = 'Please ask a member of staff for today’s menu.'
  const arabicHint = 'يرجى طلب قائمة اليوم من أحد الموظفين.'

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
      <div className={styles.card}>
        {contact?.logo_url
          ? <img className={styles.logo} src={contact.logo_url} alt="" />
          : <div className={styles.monogram}>{name ? name.slice(0, 2).toUpperCase() : <Utensils size={26} />}</div>}

        {name && <h1 className={styles.name}>{name}</h1>}

        {/* Both languages, because there is no way to know which the guest reads. */}
        <p className={styles.primary}>{arabicFirst ? arabic : english}</p>
        <p className={styles.secondary}>{arabicFirst ? englishHint : arabicHint}</p>

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

        <span className={styles.mark}>Menu by <b>fluxiva</b></span>
      </div>
    </main>
  )
}
