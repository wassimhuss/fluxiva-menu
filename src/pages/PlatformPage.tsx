import { ArrowLeft, ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, Eye, LogOut, ReceiptText, RefreshCw, Search, ShieldCheck, ShieldOff, ShieldPlus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { BillingIconButton } from '../components/BillingIconButton'
import { PlatformGallery } from '../components/PlatformGallery'
import { ShopBillingPanel } from '../components/ShopBillingPanel'
import { StorageUsagePanel } from '../components/StorageUsagePanel'
import { SubscriberDetails } from '../components/SubscriberDetails'
import { Loading, Notice } from '../components/Status'
import { deleteSubscriber, getCashCollections, getPlatformAudit, getPlatformStorageUsage, getShopBilling, listSubscribers, setSubscriberStatus, setSubscription } from '../lib/api'
import { useAuth } from '../lib/auth'
import { beirutInput, billingStatus, cashDate, cashMoney, parseBeirutInput } from '../lib/billing'
import { billingError, billingText } from '../lib/billingI18n'
import type { BillingCopyKey } from '../lib/billingI18n'
import type { CashCollections, Language, PlatformAuditEntry, PlatformStorageUsage, ShopBilling, SubscriberPage } from '../lib/types'

type View = 'Subscribers' | 'Collections' | 'Activity' | 'Gallery' | 'Storage'
export function PlatformPage() {
  const { adminRole, session, demoMode, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams,setSearchParams]=useSearchParams()
  const subscriberId=searchParams.get('subscriber')
  const closeSubscriber=()=>{setSelected(null);setSearchParams(current=>{const next=new URLSearchParams(current);next.delete('subscriber');return next})}
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('fluxiva-landing-language') === 'ar' ? 'ar' : 'en' } catch { return 'en' }
  })
  const t = (key: BillingCopyKey) => billingText(language, key)
  const [view, setView] = useState<View>('Subscribers')
  const [directory, setDirectory] = useState<SubscriberPage | null>(null)
  const [collections, setCollections] = useState<CashCollections | null>(null)
  const [activity, setActivity] = useState<PlatformAuditEntry[]>([])
  const [storage, setStorage] = useState<PlatformStorageUsage | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<ShopBilling | null>(null)
  const selectedId = selected?.restaurant_id
  const [billingRefresh, setBillingRefresh] = useState(0)
  const [suspending, setSuspending] = useState(false)
  const [accountAction, setAccountAction] = useState<{ owner: SubscriberPage['subscribers'][number]; kind: 'suspend' | 'restore' | 'delete' } | null>(null)
  const [accountConfirmation, setAccountConfirmation] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const today = beirutInput().slice(0, 10)
  const [fromDraft, setFromDraft] = useState(today.slice(0, 8) + '01')
  const [untilDraft, setUntilDraft] = useState(today)
  const [dates, setDates] = useState({ from: fromDraft, until: untilDraft })
  const dialog = useRef<HTMLDialogElement>(null)
  const accountDialog = useRef<HTMLDialogElement>(null)
  const canManage = adminRole === 'super_admin'
  const money = (value: number | null) => cashMoney(value, language)
  const date = (value: string | null, time = false) => cashDate(value, language, time)
  const number = (value: number) => language === 'ar' ? '\u200e' + value.toLocaleString('ar-LB') + '\u200e' : value.toLocaleString('en-US')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    const request = view === 'Subscribers'
      ? listSubscribers(search, page, controller.signal).then(data => { if (!controller.signal.aborted) setDirectory(data) })
      : view === 'Collections'
        ? getCashCollections(dates.from, dates.until, page, controller.signal).then(data => { if (!controller.signal.aborted) setCollections(data) })
          : view === 'Activity'
            ? getPlatformAudit(50).then(data => { if (!controller.signal.aborted) setActivity(data) })
            : view === 'Storage'
              ? getPlatformStorageUsage(controller.signal).then(data => { if (!controller.signal.aborted) setStorage(data) })
          : Promise.resolve()
    request.catch(caught => { if (!controller.signal.aborted) setError(caught) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [view, search, page, dates, reload])
  useEffect(() => { if (suspending) dialog.current?.showModal() }, [suspending])
  useEffect(() => {
    if (accountAction) accountDialog.current?.showModal()
    else accountDialog.current?.close()
  }, [accountAction])
  useEffect(() => { window.scrollTo(0, 0) }, [selectedId])
  useEffect(()=>{setSelected(null);window.scrollTo(0,0)},[subscriberId])
  function changeLanguage() {
    const next = language === 'en' ? 'ar' : 'en'
    setLanguage(next)
    try { localStorage.setItem('fluxiva-landing-language', next) } catch { /* blocked storage */ }
  }
  async function changeSuspension(suspend: boolean) {
    if (!selected) return
    setBusy(true); setError(null)
    try {
      await setSubscription(selected.restaurant_id, suspend ? 'suspended' : 'active', suspend ? null : selected.paid_until)
      setSelected(await getShopBilling(selected.restaurant_id, true))
      setBillingRefresh(n => n + 1); setReload(n => n + 1)
      setSuspending(false); dialog.current?.close()
    } catch (caught) { setError(caught) }
    finally { setBusy(false) }
  }
  async function changeAccount() {
    if (!accountAction) return
    setAccountBusy(true); setError(null)
    try {
      if (accountAction.kind === 'delete') {await deleteSubscriber(accountAction.owner.id, accountConfirmation);if(subscriberId===accountAction.owner.id)closeSubscriber()}
      else await setSubscriberStatus(accountAction.owner.id, accountAction.kind === 'suspend' ? 'suspended' : 'active')
      setAccountAction(null); setAccountConfirmation(''); setReload(n => n + 1)
    } catch (caught) { setError(caught) }
    finally { setAccountBusy(false) }
  }
  function requestAccountAction(owner: SubscriberPage['subscribers'][number], kind: 'suspend' | 'restore' | 'delete') {
    setAccountConfirmation(''); setError(null); setAccountAction({ owner, kind })
  }
  function shopRow(shop: ShopBilling) {
    return <div className="cash-shop-row" key={shop.restaurant_id}>
      <div><strong>{language === 'ar' ? shop.name_ar : shop.name_en}</strong><p><bdi>/m/{shop.slug}</bdi></p><div className="cash-tags"><span className="cash-tag">{t(billingStatus(shop))}</span><span>{t(shop.is_published ? 'Listed' : 'Hidden')}</span></div></div>
      <div><span className="cash-label">{t('Annual price')}</span><bdi>{money(shop.annual_cents)}</bdi><span className="cash-label">{shop.agreement_id ? t('Remaining annual balance') : t('Cash received')}</span><bdi>{money(shop.agreement_id ? shop.remaining_cents : null)}</bdi></div>
      <div><span className="cash-label">{t(shop.subscription_status === 'trial' ? 'Trial ends' : 'Paid through')}</span>{date(shop.paid_until)}{shop.whatsapp && <p><bdi>{shop.whatsapp}</bdi></p>}{(language === 'ar' ? shop.address_ar : shop.address_en) && <p>{language === 'ar' ? shop.address_ar : shop.address_en}</p>}</div>
      <BillingIconButton icon={ReceiptText} label={t('Open billing') + ' · ' + (language === 'ar' ? shop.name_ar : shop.name_en)} onClick={() => { setSelected(shop); setError(null) }} />
    </div>
  }
  const totalPages = view === 'Subscribers' ? Math.ceil((directory?.total ?? 0) / 25) : Math.ceil(Math.max(collections?.due_total ?? 0, collections?.receipts_total ?? 0) / 25)
  return (
    <main className="cash-console" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <header className="cash-topbar">
        <Brand light homeLabel={t('Home')} />
        <nav aria-label={t('Operator console')}>{(['Subscribers', 'Collections', 'Activity', 'Storage', 'Gallery'] as View[]).filter(v => v !== 'Gallery' || canManage).map(item => <button className={view === item && !selected ? 'selected' : ''} aria-current={view === item && !selected ? 'page' : undefined} key={item} onClick={() => { setView(item);closeSubscriber();setPage(0) }}>{t(item)}</button>)}</nav>
        <div className="cash-account"><span><bdi>{demoMode ? 'Fluxiva demo' : session?.user.email}</bdi><small><ShieldCheck size={12} /> {t(canManage ? 'Super admin' : 'Support')}</small></span><button onClick={changeLanguage} lang={language === 'en' ? 'ar' : 'en'}>{language === 'en' ? 'العربية' : 'English'}</button><BillingIconButton icon={LogOut} label={t('Sign out')} onClick={async () => { await signOut(); navigate('/login', { replace: true }) }} /></div>
      </header>
      <div className="cash-console-shell">
        <div className="cash-page-heading"><div><h1>{t(selected ? 'Subscription & payments' : subscriberId ? 'Subscriber details' : view)}</h1><p>{t(subscriberId&&!selected?'Account, shops and subscription history.':!selected && view === 'Storage' ? 'Monitor Supabase file usage by owner.' : 'Cash subscriptions, clearly recorded.')}</p></div><BillingIconButton icon={RefreshCw} label={t('Refresh')} disabled={loading || busy} onClick={() => { setReload(n => n + 1); if (selected) setBillingRefresh(n => n + 1) }} /></div>
        {demoMode && <Notice>{t('Sample data. Cash changes stay in this browser session.')}</Notice>}
        {!canManage && <Notice>{t('Read-only access')}</Notice>}
        {Boolean(error) && <Notice tone="error">{billingError(language, error)}<BillingIconButton icon={RefreshCw} label={t('Try again')} onClick={() => setReload(n => n + 1)} /></Notice>}
        {subscriberId&&<div hidden={Boolean(selected)}><SubscriberDetails key={subscriberId} ownerId={subscriberId} language={language} refreshToken={reload} onBack={closeSubscriber} onBilling={shop=>{setSelected(shop);setError(null)}} onAccountAction={requestAccountAction}/></div>}
        {selected ? <>
          <div className="cash-detail-heading"><BillingIconButton icon={language === 'ar' ? ArrowRight : ArrowLeft} label={t(subscriberId?'Back to subscriber':'Close billing')} onClick={() => setSelected(null)} /><div className="cash-actions"><span className="cash-tag">{t(billingStatus(selected))}</span>{canManage && !selected.archived && <BillingIconButton icon={selected.subscription_status === 'suspended' ? ShieldPlus : ShieldOff} danger={selected.subscription_status !== 'suspended'} label={t(selected.subscription_status === 'suspended' ? 'Restore access' : 'Suspend menu')} disabled={busy} onClick={() => selected.subscription_status === 'suspended' ? void changeSuspension(false) : setSuspending(true)} />}</div></div>
          <ShopBillingPanel key={selected.restaurant_id} shopId={selected.restaurant_id} language={language} admin refreshToken={billingRefresh} onChanged={data => { setSelected(data); setReload(n => n + 1) }} />
        </> : subscriberId ? null : view === 'Gallery' ? <PlatformGallery language={language} /> : <>
          {view === 'Subscribers' && <form className="cash-search" onSubmit={event => { event.preventDefault(); setSearch(searchDraft.trim()); setPage(0); setReload(n => n + 1) }}><label><span className="sr-only">{t('Search owners, shops or contact numbers')}</span><Search size={18} /><input value={searchDraft} onChange={e => setSearchDraft(e.target.value)} placeholder={t('Search owners, shops or contact numbers')} /></label><BillingIconButton icon={Search} type="submit" label={t('Search')} /></form>}
          {view === 'Collections' && <form className="cash-date-filter" onSubmit={event => { event.preventDefault(); setDates({ from: fromDraft, until: untilDraft }); setPage(0) }}><label>{t('From')}<input type="date" value={fromDraft} onChange={e => setFromDraft(e.target.value)} required /></label><label>{t('Until')}<input type="date" value={untilDraft} min={fromDraft} onChange={e => setUntilDraft(e.target.value)} required /></label><BillingIconButton icon={CalendarCheck} type="submit" label={t('Apply dates')} /></form>}
          {loading ? <Loading label={t(view === 'Subscribers' ? 'Loading subscribers…' : view === 'Collections' ? 'Loading collections…' : view === 'Storage' ? 'Loading storage…' : 'Loading activity…')} /> : <>
            {view === 'Subscribers' && <section className="cash-directory" aria-label={t('Subscribers')}>
              <p className="cash-result-count">{number(directory?.total ?? 0)} {t('subscribers')}</p>
              {directory?.subscribers.length ? directory.subscribers.map(owner => <article className="cash-subscriber" key={owner.id}><header><h2><Link className="subscriber-link" to={{search:'?subscriber='+encodeURIComponent(owner.id)}} aria-label={t('Open subscriber')+' · '+owner.email}><bdi>{owner.email}</bdi></Link></h2><BillingIconButton icon={Eye} label={t('Open subscriber')+' · '+owner.email} onClick={()=>setSearchParams({subscriber:owner.id})}/><span>{t('Registered')} {date(owner.created_at)}</span>{owner.archived && <span className="cash-tag">{t('Archived')}</span>}{canManage && !owner.archived && <div className="cash-account-actions">{owner.shops.length > 0 && <BillingIconButton icon={owner.shops.every(shop => shop.subscription_status === 'suspended') ? ShieldPlus : ShieldOff} danger={!owner.shops.every(shop => shop.subscription_status === 'suspended')} label={t(owner.shops.every(shop => shop.subscription_status === 'suspended') ? 'Restore account access' : 'Suspend account') + ' · ' + owner.email} onClick={() => requestAccountAction(owner, owner.shops.every(shop => shop.subscription_status === 'suspended') ? 'restore' : 'suspend')} />}<BillingIconButton icon={Trash2} danger label={t('Delete account') + ' · ' + owner.email} onClick={() => requestAccountAction(owner, 'delete')} /></div>}</header>{owner.shops.length ? owner.shops.map(shopRow) : <p className="cash-empty">{t('No shop created yet')}</p>}</article>) : <p className="cash-empty">{t('No subscribers match this search.')}</p>}
            </section>}
            {view === 'Collections' && collections && <>
              <div className="cash-total"><span>{t('Net cash recorded')}</span><strong><bdi>{money(collections.collected_cents)}</bdi></strong><p>{t('Voided receipts are excluded from the total.')}</p></div>
              {collections.daily_totals.length > 0 && <section className="cash-collection-list"><h2>{t('Cash by collection date')}</h2><ol className="cash-daily-totals">{collections.daily_totals.map(day => <li key={day.date}><time>{date(parseBeirutInput(day.date + 'T12:00'))}</time><span>{t('Receipt count')}: {number(day.receipt_count)}</span><strong><bdi>{money(day.collected_cents)}</bdi></strong></li>)}</ol></section>}
              <section className="cash-collection-list"><h2>{t('Upcoming and overdue collections')}</h2><p>{t('Paid periods ending within 30 days, earliest first.')}</p>{collections.due_shops.length ? collections.due_shops.map(shopRow) : <p className="cash-empty">{t('No collections due in this view.')}</p>}</section>
              <section className="cash-collection-list"><h2>{t('Receipt history')}</h2>{collections.receipts.length ? <ol>{collections.receipts.map(receipt => <li className="cash-collection-receipt" key={receipt.id}><div><strong>{language === 'ar' ? receipt.name_ar : receipt.name_en}</strong><p><bdi>{receipt.owner_email}</bdi></p></div><div>{date(receipt.collected_at, true)}<p><bdi>{receipt.reference}</bdi></p></div><bdi>{money(receipt.amount_cents)}</bdi>{receipt.voided ? <span className="cash-tag">{t('Voided')}</span> : <BillingIconButton icon={ReceiptText} label={t('Open billing') + ' · ' + (language === 'ar' ? receipt.name_ar : receipt.name_en)} onClick={async () => { try { setSelected(await getShopBilling(receipt.shop_id, true)) } catch (caught) { setError(caught) } }} />}</li>)}</ol> : <p className="cash-empty">{t('No receipts in this date range.')}</p>}</section>
            </>}
            {view === 'Activity' && <section className="cash-collection-list"><h2>{t('Recent activity')}</h2>{activity.length ? <ol>{activity.map(entry => <li className="cash-collection-receipt" key={entry.id}><strong>{t(entry.action === 'billing.cash_received' ? 'Cash recorded' : entry.action === 'billing.receipt_voided' ? 'Receipt corrected' : entry.action === 'billing.price' ? 'Price updated' : 'Access updated')}</strong><div><bdi>/m/{entry.restaurant_slug}</bdi><p><bdi>{entry.actor_email}</bdi></p></div><div>{entry.details.amount_cents != null && <bdi>{money(entry.details.amount_cents)}</bdi>}{entry.details.reference && <p><bdi>{entry.details.reference}</bdi></p>}<time>{date(entry.created_at, true)}</time></div></li>)}</ol> : <p className="cash-empty">{t('No activity recorded yet.')}</p>}</section>}
            {view === 'Storage' && storage && <StorageUsagePanel usage={storage} language={language} />}
            {(view === 'Subscribers' || view === 'Collections') && <div className="cash-pagination"><BillingIconButton icon={language === 'ar' ? ChevronRight : ChevronLeft} label={t('Previous')} disabled={page === 0} onClick={() => setPage(p => p - 1)} /><span>{t('Page')} <bdi dir="ltr">{number(page + 1)} / {number(Math.max(1, totalPages))}</bdi></span><BillingIconButton icon={language === 'ar' ? ChevronLeft : ChevronRight} label={t('Next')} disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} /></div>}
          </>}
        </>}
        <p className="cash-time-note">{t('All dates are in Beirut time.')}</p>
      </div>
      <dialog ref={dialog} className="cash-confirm-dialog" aria-labelledby="cash-suspend-title" onCancel={event => { if (busy) event.preventDefault(); else setSuspending(false) }} onClose={() => setSuspending(false)}>
        <div className="cash-section-heading"><h2 id="cash-suspend-title">{t('Suspend this shop’s public menu?')}</h2><button className="cash-icon-button" aria-label={t('Cancel')} disabled={busy} onClick={() => dialog.current?.close()}><X /></button></div>
        <p>{selected && (language === 'ar' ? selected.name_ar : selected.name_en)}</p><p>{t('Suspension preserves paid time and payment history.')}</p>{Boolean(error) && <Notice tone="error">{billingError(language, error)}</Notice>}
        <div className="cash-actions"><button className="button button-primary" disabled={busy} onClick={() => void changeSuspension(true)}>{busy ? t('Saving…') : t('Suspend menu')}</button><button className="button button-outline" disabled={busy} onClick={() => dialog.current?.close()}>{t('Cancel')}</button></div>
      </dialog>
      <dialog ref={accountDialog} className="cash-confirm-dialog" aria-labelledby="account-action-title" onCancel={event => { if (accountBusy) event.preventDefault(); else setAccountAction(null) }} onClose={() => { if (!accountBusy) setAccountAction(null) }}>
        <div className="cash-section-heading"><h2 id="account-action-title">{t(accountAction?.kind === 'delete' ? 'Delete subscriber account?' : accountAction?.kind === 'restore' ? 'Restore subscriber account?' : 'Suspend subscriber account?')}</h2><button className="cash-icon-button" aria-label={t('Cancel')} disabled={accountBusy} onClick={() => accountDialog.current?.close()}><X /></button></div>
        <p><bdi>{accountAction?.owner.email}</bdi></p>
        <p>{t(accountAction?.kind === 'delete' ? 'This permanently deletes the account and its menus. Billing history is retained.' : accountAction?.kind === 'restore' ? 'This restores access for all shops owned by this subscriber.' : 'This suspends every shop owned by this subscriber and hides its public menus.')}</p>
        {accountAction?.kind === 'delete' && <label>{t('Type the subscriber email to confirm')}<input autoFocus dir="ltr" type="email" value={accountConfirmation} onChange={event => setAccountConfirmation(event.target.value)} disabled={accountBusy} placeholder={accountAction.owner.email} /></label>}
        {Boolean(error) && <Notice tone="error">{billingError(language, error)}</Notice>}
        <div className="cash-actions"><button className={`button ${accountAction?.kind === 'delete' ? 'button-danger' : 'button-primary'}`} disabled={accountBusy || (accountAction?.kind === 'delete' && accountConfirmation.trim() !== accountAction.owner.email)} onClick={() => void changeAccount()}>{accountBusy ? t('Saving…') : t(accountAction?.kind === 'delete' ? 'Delete account' : accountAction?.kind === 'restore' ? 'Restore access' : 'Suspend account')}</button><button className="button button-outline" disabled={accountBusy} onClick={() => accountDialog.current?.close()}>{t('Cancel')}</button></div>
      </dialog>
    </main>
  )
}
