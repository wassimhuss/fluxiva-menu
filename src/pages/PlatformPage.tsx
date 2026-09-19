import { ArrowLeft, Check, ExternalLink, History, Pause, Play, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading, Notice } from '../components/Status'
import { getPlatformAudit, listPlatformRestaurants, setSubscription } from '../lib/api'
import { useAuth } from '../lib/auth'
import { subscriptionState } from '../lib/subscription'
import type { PlatformAuditEntry, PlatformRestaurant, SubscriptionStatus } from '../lib/types'
import { TEMPLATES } from '../templates/registry'
import styles from './Platform.module.css'

type Bucket = 'expired' | 'expiring' | 'trial' | 'active' | 'suspended'
type Filter = 'all' | 'attention' | 'live' | 'trial' | 'suspended'

interface Lifecycle {
  bucket: Bucket
  tone: 'Live' | 'Trial' | 'Warn' | 'Danger' | 'Muted'
  status: string
  detail: string
  /** Lower sorts first, so whatever needs action is at the top. */
  rank: number
  /** Whether the public menu is actually being served right now. */
  serving: boolean
}

const formatDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function relative(days: number) {
  const absolute = Math.abs(days)
  if (absolute === 0) return 'today'
  if (absolute === 1) return days > 0 ? 'tomorrow' : 'yesterday'
  return days > 0 ? `in ${absolute} days` : `${absolute} days ago`
}

/** Presentation for the console, built on the shared liveness rule. */
function lifecycleOf(restaurant: PlatformRestaurant): Lifecycle {
  const state = subscriptionState(restaurant)
  const days = state.daysLeft ?? 0

  if (state.kind === 'suspended') {
    // The date shown is what they are still owed, not when they were suspended
    // — that is in the audit trail, and this is what matters when restoring.
    return {
      bucket: 'suspended', tone: 'Muted', status: 'Suspended',
      detail: state.endsAt ? `Paid until ${formatDate(state.endsAt)}` : 'No end date set',
      rank: 40, serving: false,
    }
  }

  if (state.kind === 'trial') {
    if (!state.serving) return { bucket: 'expired', tone: 'Danger', status: 'Trial ended', detail: relative(days), rank: 0, serving: false }
    return { bucket: 'trial', tone: 'Trial', status: 'In trial', detail: `Ends ${relative(days)}`, rank: days <= 3 ? 5 : 20, serving: true }
  }

  if (state.daysLeft === null) {
    return { bucket: 'active', tone: 'Live', status: 'Active', detail: 'No end date set', rank: 30, serving: true }
  }

  if (!state.serving) return { bucket: 'expired', tone: 'Danger', status: 'Expired', detail: `Lapsed ${relative(days)}`, rank: 1, serving: false }
  if (days <= 30) return { bucket: 'expiring', tone: 'Warn', status: 'Renewal due', detail: `Renews ${relative(days)}`, rank: 10, serving: true }
  return { bucket: 'active', tone: 'Live', status: 'Active', detail: `Renews ${formatDate(state.endsAt)}`, rank: 30, serving: true }
}

const FILTERS: { id: Filter; label: string; matches: (l: Lifecycle) => boolean }[] = [
  { id: 'all', label: 'All', matches: () => true },
  { id: 'attention', label: 'Needs attention', matches: (l) => l.bucket === 'expired' || l.bucket === 'expiring' },
  { id: 'live', label: 'Live', matches: (l) => l.serving },
  { id: 'trial', label: 'Trial', matches: (l) => l.bucket === 'trial' },
  { id: 'suspended', label: 'Suspended', matches: (l) => l.bucket === 'suspended' },
]

export function PlatformPage() {
  const { adminRole, session, demoMode } = useAuth()
  const [restaurants, setRestaurants] = useState<PlatformRestaurant[]>([])
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState('')
  const [confirming, setConfirming] = useState<PlatformRestaurant | null>(null)

  // Only a super admin may change billing; the database enforces this too.
  const canManage = adminRole === 'super_admin'

  useEffect(() => {
    Promise.all([listPlatformRestaurants(), getPlatformAudit(20)])
      .then(([list, entries]) => { setRestaurants(list); setAudit(entries) })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the console'))
      .finally(() => setLoading(false))
  }, [])

  /**
   * `endsAt` is the renewal date to write, or null to let the database decide:
   * extending a year when activating, and leaving the existing date untouched
   * when suspending. Suspending must never overwrite it, or the restaurant
   * loses the time it has already paid for.
   */
  async function changeStatus(restaurant: PlatformRestaurant, status: SubscriptionStatus, endsAt: string | null = null) {
    setBusyId(restaurant.id); setError('')
    try {
      await setSubscription(restaurant.id, status, endsAt)
      const [list, entries] = await Promise.all([listPlatformRestaurants(), getPlatformAudit(20)])
      setRestaurants(list); setAudit(entries)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the subscription')
    } finally { setBusyId(''); setConfirming(null) }
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return restaurants
      .map((restaurant) => ({ restaurant, lifecycle: lifecycleOf(restaurant) }))
      .filter(({ restaurant, lifecycle }) => {
        if (!FILTERS.find((entry) => entry.id === filter)?.matches(lifecycle)) return false
        if (!term) return true
        return `${restaurant.name_en} ${restaurant.name_ar} ${restaurant.slug} ${restaurant.owner_email ?? ''}`.toLowerCase().includes(term)
      })
      // Attention first, then soonest date within each group.
      .sort((a, b) => a.lifecycle.rank - b.lifecycle.rank
        || new Date(a.restaurant.subscription_ends_at ?? a.restaurant.trial_ends_at ?? 0).getTime()
        - new Date(b.restaurant.subscription_ends_at ?? b.restaurant.trial_ends_at ?? 0).getTime())
  }, [restaurants, search, filter])

  const stats = useMemo(() => {
    const all = restaurants.map(lifecycleOf)
    return {
      total: all.length,
      serving: all.filter((l) => l.serving).length,
      attention: all.filter((l) => l.bucket === 'expired' || l.bucket === 'expiring').length,
      trial: all.filter((l) => l.bucket === 'trial').length,
      suspended: all.filter((l) => l.bucket === 'suspended').length,
    }
  }, [restaurants])

  const filterCounts = useMemo(() => {
    const all = restaurants.map(lifecycleOf)
    return Object.fromEntries(FILTERS.map((entry) => [entry.id, all.filter(entry.matches).length])) as Record<Filter, number>
  }, [restaurants])

  const templateName = (id?: string) => TEMPLATES.find((template) => template.id === id)?.name ?? 'Classic'

  return (
    <main className={styles.console}>
      <header className={styles.topbar}>
        <Link className={styles.back} to="/dashboard"><ArrowLeft /> Dashboard</Link>
        <span className={styles.topbarTitle}><ShieldCheck /> Fluxiva operator</span>
        <span className={styles.identity}>
          <span>{demoMode ? 'demo mode' : session?.user.email}</span>
          <span className={styles.roleBadge}>{adminRole === 'super_admin' ? 'Super admin' : 'Support'}</span>
        </span>
      </header>

      <div className={styles.shell}>
        <div className={styles.heading}>
          <h1>Operator console</h1>
          <p>Subscriptions and menu access for every restaurant on Fluxiva.</p>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {demoMode && <Notice>Sample data. Connect Supabase to manage real restaurants.</Notice>}
        {!canManage && <Notice>Your role has read-only access. Subscription changes are disabled.</Notice>}

        {loading ? <Loading label="Loading restaurants…" /> : <>
          <div className={styles.stats}>
            <article className={styles.stat}><span>Restaurants</span><strong>{stats.total}</strong><small>on the platform</small></article>
            <article className={`${styles.stat} ${styles.statLive}`}><span>Menus live</span><strong>{stats.serving}</strong><small>serving customers now</small></article>
            <article className={`${styles.stat} ${stats.attention ? styles.statAttention : ''}`}><span>Needs attention</span><strong>{stats.attention}</strong><small>expired or due within 30 days</small></article>
            <article className={styles.stat}><span>In trial</span><strong>{stats.trial}</strong><small>not yet paying</small></article>
            <article className={styles.stat}><span>Suspended</span><strong>{stats.suspended}</strong><small>menus offline</small></article>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.search}>
              <Search />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, link or owner email…" />
            </div>
            <div className={styles.filters}>
              {FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  className={`${styles.filter} ${filter === entry.id ? styles.filterActive : ''}`}
                  onClick={() => setFilter(entry.id)}
                >
                  {entry.label}<span className={styles.filterCount}>{filterCounts[entry.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <section className={styles.table}>
            <div className={styles.tableHead}>
              <span>Restaurant</span><span>Owner</span><span>Menu</span><span>Subscription</span><span />
            </div>

            {rows.map(({ restaurant, lifecycle }) => (
              <div key={restaurant.id} className={`${styles.row} ${busyId === restaurant.id ? styles.rowBusy : ''}`}>
                <div className={styles.venue}>
                  <span className={styles.swatch} style={{ backgroundColor: restaurant.primary_color }}>
                    {restaurant.name_en.slice(0, 2).toUpperCase()}
                  </span>
                  <span className={styles.venueText}>
                    <b>{restaurant.name_en}</b>
                    <Link className={styles.slug} to={`/m/${restaurant.slug}`} target="_blank">/m/{restaurant.slug} <ExternalLink /></Link>
                  </span>
                </div>

                <div>
                  <span className={styles.cellLabel}>Owner</span>
                  <span className={`${styles.owner} ${restaurant.owner_email ? '' : styles.ownerMissing}`}>
                    {restaurant.owner_email ?? 'no account'}
                  </span>
                </div>

                <div>
                  <span className={styles.cellLabel}>Menu</span>
                  <div className={styles.menuMeta}>
                    <b>{restaurant.item_count}</b> items<br />
                    <b>{(restaurant.views_30d ?? 0).toLocaleString()}</b> opens / 30d<br />
                    {templateName(restaurant.template_id)}
                    {restaurant.temporarily_closed && <span className={styles.closedTag}>Closed</span>}
                  </div>
                </div>

                <div className={styles.sub}>
                  <span className={styles.cellLabel}>Subscription</span>
                  <span className={`${styles.pill} ${styles[`tone${lifecycle.tone}`]}`}>{lifecycle.status}</span>
                  <span className={styles.subDetail}>{lifecycle.detail}</span>
                  {!lifecycle.serving && <span className={styles.offline}>Menu offline</span>}
                </div>

                <div className={styles.actions}>
                  {canManage ? <>
                    <button
                      className={`${styles.action} ${styles.actionPrimary}`}
                      // Reactivating hands back the date it was suspended with,
                      // so a restored account gets the time it was owed rather
                      // than a fresh year on top of it.
                      onClick={() => lifecycle.bucket === 'suspended'
                        ? changeStatus(restaurant, 'active', restaurant.subscription_ends_at ?? null)
                        : changeStatus(restaurant, 'active')}
                    >
                      {lifecycle.bucket === 'suspended' ? <><Play /> Reactivate</> : <><Check /> Extend 1 year</>}
                    </button>
                    {lifecycle.bucket !== 'suspended' && (
                      <button className={`${styles.action} ${styles.actionDanger}`} onClick={() => setConfirming(restaurant)}>
                        <Pause /> Suspend
                      </button>
                    )}
                  </> : <span className={styles.readOnly}>Read-only</span>}
                </div>
              </div>
            ))}

            {!rows.length && <p className={styles.empty}>No restaurants match this view.</p>}
          </section>

          <section className={styles.audit}>
            <div className={styles.auditHead}><History /><h2>Recent activity</h2></div>
            <p className={styles.auditNote}>Every subscription change, and who made it.</p>
            {audit.length ? (
              <div className={styles.auditList}>
                {audit.map((entry) => {
                  const suspended = entry.action.endsWith('suspended')
                  return (
                    <div key={entry.id} className={styles.auditRow}>
                      <span className={`${styles.auditAction} ${suspended ? styles.toneDanger : styles.toneLive}`}>
                        {suspended ? 'Suspended' : 'Activated'}
                      </span>
                      <b>/m/{entry.restaurant_slug}</b>
                      {entry.details?.ends_at && <span className={styles.auditActor}>until {formatDate(entry.details.ends_at)}</span>}
                      <span className={styles.auditActor}>by {entry.actor_email ?? 'unknown'}</span>
                      <span className={styles.auditTime}>{formatDate(entry.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            ) : <p className={styles.empty}>No changes recorded yet.</p>}
          </section>
        </>}
      </div>

      {confirming && (
        <div className="modal-backdrop">
          <div className={`modal-card ${styles.confirmCard}`}>
            <h2>Suspend this restaurant?</h2>
            <p>
              <strong>{confirming.name_en}</strong> will stop serving its public menu immediately.
              Anyone scanning the QR code at <strong>/m/{confirming.slug}</strong> will see an unavailable page until you reactivate it.
            </p>
            <div className={styles.confirmActions}>
              <button className="button button-outline button-small" onClick={() => setConfirming(null)}>Cancel</button>
              <button className="button button-primary button-small" onClick={() => changeStatus(confirming, 'suspended')}>
                <Pause /> Suspend menu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
