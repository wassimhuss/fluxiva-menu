import { ArrowLeft, Check, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading, Notice } from '../components/Status'
import { listPlatformRestaurants, setSubscription } from '../lib/api'
import type { Restaurant, SubscriptionStatus } from '../lib/types'

export function PlatformPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { listPlatformRestaurants().then(setRestaurants).catch((caught) => setError(caught instanceof Error ? caught.message : 'Access denied')).finally(() => setLoading(false)) }, [])

  async function changeStatus(restaurant: Restaurant, status: SubscriptionStatus) {
    const endsAt = status === 'active' ? new Date(Date.now() + 365 * 86400000).toISOString() : null
    try {
      await setSubscription(restaurant.id, status, endsAt)
      setRestaurants((current) => current.map((entry) => entry.id === restaurant.id ? { ...entry, subscription_status: status, subscription_ends_at: endsAt ?? undefined } : entry))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update subscription') }
  }

  const filtered = restaurants.filter((restaurant) => `${restaurant.name_en} ${restaurant.name_ar} ${restaurant.slug}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <main className="platform-page">
      <header className="platform-header"><div><Link to="/dashboard"><ArrowLeft /> Dashboard</Link><h1><ShieldCheck /> Fluxiva control</h1><p>Activate restaurants and manage renewal dates.</p></div><div className="platform-stat"><strong>{restaurants.length}</strong><span>restaurants</span></div></header>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? <Loading /> : <section className="platform-card"><div className="platform-tools"><div className="menu-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search restaurants…" /></div></div><div className="restaurant-table"><div className="table-head"><span>Restaurant</span><span>Status</span><span>Renewal</span><span>Actions</span></div>{filtered.map((restaurant) => <div className="restaurant-row" key={restaurant.id}><span><b>{restaurant.name_en}</b><small>/m/{restaurant.slug}</small></span><span><i className={`status-dot ${restaurant.subscription_status}`} />{restaurant.subscription_status}</span><span>{restaurant.subscription_ends_at ? new Date(restaurant.subscription_ends_at).toLocaleDateString() : '—'}</span><span className="row-actions"><button onClick={() => changeStatus(restaurant, 'active')}><Check /> Activate 1 year</button><button onClick={() => changeStatus(restaurant, 'suspended')}>Suspend</button></span></div>)}</div></section>}
    </main>
  )
}
