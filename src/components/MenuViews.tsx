import { QrCode, TrendingDown, TrendingUp } from 'lucide-react'
import type { MenuViewStats } from '../lib/types'
import styles from './MenuViews.module.css'

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * Menu opens over the last 30 days, against the 30 before.
 *
 * Deliberately the plainest possible framing — a count, a direction and a
 * busiest day. An owner deciding whether to renew wants one number they can
 * believe, not a dashboard.
 */
export function MenuViews({ stats }: { stats: MenuViewStats }) {
  if (!stats.total) {
    return (
      <article className={styles.card}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2>Menu opens</h2>
            <p>How often customers opened your menu.</p>
          </div>
        </div>
        <div className={styles.empty}>
          <QrCode />
          <h3>No opens counted yet</h3>
          <p>Once customers start scanning your QR code, you’ll see how often your menu gets opened here.</p>
        </div>
      </article>
    )
  }

  const { total, previousTotal, days, busiestDay } = stats
  const change = previousTotal ? Math.round(((total - previousTotal) / previousTotal) * 100) : null
  const peak = Math.max(...days.map((day) => day.views), 1)

  const deltaTone = change === null || change === 0 ? styles.deltaFlat : change > 0 ? styles.deltaUp : styles.deltaDown
  const deltaLabel = change === null
    ? 'first full period'
    : change === 0 ? 'no change' : `${change > 0 ? '+' : ''}${change}% vs previous 30 days`

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2>Menu opens</h2>
          <p>Last 30 days, not counting your own visits.</p>
        </div>
        <div className={styles.total}>
          <span className={styles.totalValue}>{total.toLocaleString()}</span>
          <span className={`${styles.delta} ${deltaTone}`}>
            {change !== null && change !== 0 && (change > 0 ? <TrendingUp /> : <TrendingDown />)}
            {deltaLabel}
          </span>
        </div>
      </div>

      <div className={styles.chart}>
        {days.map((day) => (
          <span
            key={day.viewed_on}
            className={`${styles.bar} ${busiestDay?.viewed_on === day.viewed_on ? styles.barBusiest : ''}`}
            style={{ height: `${Math.max(2, (day.views / peak) * 100)}%` }}
            title={`${shortDate(day.viewed_on)} — ${day.views} opens`}
          />
        ))}
      </div>
      <div className={styles.axis}>
        <span>{days[0] && shortDate(days[0].viewed_on)}</span>
        <span>{days.at(-1) && shortDate(days.at(-1)!.viewed_on)}</span>
      </div>

      {busiestDay && (
        <p className={styles.footnote}>
          Busiest day was <b>{shortDate(busiestDay.viewed_on)}</b> with <b>{busiestDay.views.toLocaleString()}</b> opens.
        </p>
      )}
    </article>
  )
}
