import { Check, Eye, Pencil, RefreshCw, Save, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getShopBilling, previewCashPayment, recordCashPayment, reviewLegacyAccess, setShopPrice, voidCashReceipt } from '../lib/api'
import { useAuth } from '../lib/auth'
import { beirutInput, cashDate, cashMoney, parseBeirutInput, usdCents } from '../lib/billing'
import { billingError, billingText } from '../lib/billingI18n'
import type { BillingCopyKey } from '../lib/billingI18n'
import type { CashPaymentPreview, CashPaymentRequest, CashReceipt, Language, ShopBilling } from '../lib/types'
import { Loading, Notice } from './Status'
import { BillingIconButton } from './BillingIconButton'
import { OwnerBillingSummary } from './OwnerBillingSummary'

interface PreparedReceipt { request: CashPaymentRequest; preview: CashPaymentPreview }
function restoredReceipt(key: string): PreparedReceipt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as PreparedReceipt | null
    // Keep pre-manual-date requests locked until their original ID is reconciled.
    return value?.request?.request_input && value.preview?.version ? value : null
  } catch { return null }
}
export function ShopBillingPanel({ shopId, language, admin = false, onChanged, refreshToken = 0 }: {
  shopId: string; language: Language; admin?: boolean; onChanged?: (billing: ShopBilling) => void; refreshToken?: number
}) {
  const { adminRole, session } = useAuth()
  const canManage = admin && adminRole === 'super_admin'
  const t = (key: BillingCopyKey) => billingText(language, key)
  const pendingKey = 'fluxiva-cash-pending:' + (session?.user.id ?? 'demo') + ':' + shopId
  const initial = useRef(restoredReceipt(pendingKey))
  const [pending, setPending] = useState(initial.current)
  const [preview, setPreview] = useState<CashPaymentPreview | null>(initial.current?.preview ?? null)
  const [billing, setBilling] = useState<ShopBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [success, setSuccess] = useState<BillingCopyKey | null>(null)
  const [price, setPrice] = useState('')
  const [legacyEnd, setLegacyEnd] = useState('')
  const [amount, setAmount] = useState(initial.current ? (initial.current.request.amount_input / 100).toFixed(2) : '')
  const [collected, setCollected] = useState(initial.current ? beirutInput(new Date(initial.current.request.collected_input)) : beirutInput())
  const [starts, setStarts] = useState(initial.current?.request.starts_input ? beirutInput(new Date(initial.current.request.starts_input)) : '')
  const [ends, setEnds] = useState(initial.current?.request.ends_input ? beirutInput(new Date(initial.current.request.ends_input)) : '')
  const [reference, setReference] = useState(initial.current?.request.reference_input ?? 'FV-' + crypto.randomUUID().slice(0, 8).toUpperCase())
  const [note, setNote] = useState(initial.current?.request.note_input ?? '')
  const [voidTarget, setVoidTarget] = useState<CashReceipt | null>(null)
  const [reason, setReason] = useState('')
  const [voidRequest, setVoidRequest] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const alive = useRef(true)
  const readRequest = useRef(0)
  const changed = useRef(onChanged)
  changed.current = onChanged
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const previewRef = useRef(preview)
  previewRef.current = preview
  const savePending = useCallback((value: PreparedReceipt | null) => {
    setPending(value); pendingRef.current = value
    try {
      if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value))
      else sessionStorage.removeItem(pendingKey)
    } catch { /* Same-request retries still work if storage is unavailable. */ }
  }, [pendingKey])
  const accept = useCallback((data: ShopBilling) => {
    if (!alive.current) return
    setBilling(data)
    setPrice(data.next_annual_cents == null ? '' : (data.next_annual_cents / 100).toFixed(2))
    changed.current?.(data)
    if (!pendingRef.current && previewRef.current && previewRef.current.version !== data.version) setPreview(null)
    if (pendingRef.current && data.agreements?.some(a => a.receipts.some(r => r.id === pendingRef.current?.request.request_input))) {
      savePending(null); setPreview(null); setAmount(''); setNote('')
      setCollected(beirutInput())
      setStarts(''); setEnds('')
      setReference('FV-' + crypto.randomUUID().slice(0, 8).toUpperCase())
      setSuccess('Cash receipt recorded.')
    }
  }, [savePending])
  const acceptRef = useRef(accept)
  acceptRef.current = accept
  const refresh = async () => {
    const request = ++readRequest.current
    setLoading(true); setError(null)
    try { const data = await getShopBilling(shopId, admin); if (request === readRequest.current) acceptRef.current(data) }
    catch (caught) { if (alive.current && request === readRequest.current) setError(caught) }
    finally { if (alive.current && request === readRequest.current) setLoading(false) }
  }
  useEffect(() => {
    alive.current = true
    const requests = readRequest
    const request = ++readRequest.current
    const controller = new AbortController()
    getShopBilling(shopId, admin, controller.signal)
      .then(data => { if (!controller.signal.aborted && request === readRequest.current) acceptRef.current(data) })
      .catch(caught => { if (!controller.signal.aborted && request === readRequest.current) setError(caught) })
      .finally(() => { if (!controller.signal.aborted && request === readRequest.current) setLoading(false) })
    return () => { alive.current = false; requests.current++; controller.abort() }
    // Language changes translate existing values rather than refetching private data.
  }, [shopId, admin, refreshToken])
  useEffect(() => { if (voidTarget) dialog.current?.showModal() }, [voidTarget])
  async function act(operation: () => Promise<ShopBilling>, message: BillingCopyKey) {
    readRequest.current++
    setLoading(false)
    setBusy(true); setError(null); setSuccess(null)
    try {
      accept(await operation())
      if (alive.current) setSuccess(message)
    } catch (caught) { if (alive.current) setError(caught) }
    finally { if (alive.current) setBusy(false) }
  }
  async function quotePayment(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setSuccess(null)
    try {
      if (!reference.trim()) throw new Error('Enter a receipt reference and a note under 2000 characters')
      if (!starts || !ends) throw new Error('Enter access start and expiry dates manually')
      const quote = await previewCashPayment(shopId, usdCents(amount), parseBeirutInput(collected), parseBeirutInput(starts), parseBeirutInput(ends))
      if (alive.current) setPreview(quote)
    } catch (caught) { if (alive.current) setError(caught) }
    finally { if (alive.current) setBusy(false) }
  }
  async function confirmPayment() {
    if (!preview) return
    readRequest.current++
    setLoading(false)
    const prepared = pending ?? { preview, request: {
      shop_input: shopId, amount_input: preview.amount_cents, collected_input: preview.collected_at,
      starts_input: preview.coverage_from, ends_input: preview.paid_until,
      reference_input: reference.trim(), note_input: note.trim(),
      request_input: crypto.randomUUID(), version_input: preview.version,
    } }
    savePending(prepared); setBusy(true); setError(null); setSuccess(null)
    try { accept(await recordCashPayment(prepared.request)) }
    catch (caught) {
      if (!alive.current) return
      // A PostgreSQL rejection is definitive; a lost response may have committed.
      // Retain the request ID and lock edits on an uncertain response.
      const code = typeof caught === 'object' && caught && 'code' in caught ? String(caught.code) : ''
      if (/^(P0001|22|23|42)/.test(code)) { savePending(null); setPreview(null) }
      setError(caught)
    } finally { if (alive.current) setBusy(false) }
  }
  async function correctReceipt() {
    if (!voidTarget || !billing) return
    readRequest.current++
    setLoading(false)
    setBusy(true); setError(null)
    try {
      const next = await voidCashReceipt(voidTarget.id, reason, voidRequest, billing.version)
      accept(next)
      if (alive.current) {
        setVoidTarget(null); dialog.current?.close(); setPreview(null)
        setSuccess('Receipt voided. Its original record remains in the history.')
      }
    } catch (caught) { if (alive.current) setError(caught) }
    finally { if (alive.current) setBusy(false) }
  }
  if (!billing && loading) return <Loading label={t('Loading billing…')} />
  if (!billing) return <div><Notice tone="error">{billingError(language, error)}</Notice><button className="button button-outline" onClick={refresh}>{t('Try again')}</button></div>
  if (!admin) return <OwnerBillingSummary billing={billing} language={language} loading={loading} onRefresh={refresh} supportContact={import.meta.env.VITE_SUPPORT_WHATSAPP}>
    {Boolean(error)&&<Notice tone="error">{billingError(language,error)}</Notice>}
  </OwnerBillingSummary>
  const money = (cents: number | null) => cashMoney(cents, language)
  const date = (iso: string | null, time = false) => cashDate(iso, language, time)
  const latest = billing.agreements?.[0]
  const number = (value: number) => language === 'ar' ? '\u200e' + value.toLocaleString('ar-LB') + '\u200e' : value.toLocaleString('en-US')
  const Heading = admin ? 'h2' : 'h1'
  return (
    <section className="cash-billing" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <div className="cash-section-heading"><div><Heading>{t('Subscription & payments')}</Heading><p>{language === 'ar' ? billing.name_ar : billing.name_en}</p></div><BillingIconButton icon={RefreshCw} label={t('Refresh')} disabled={busy || loading} onClick={refresh} /></div>
      {Boolean(error) && !voidTarget && <Notice tone="error">{billingError(language, error)}</Notice>}
      {success && <Notice tone="success">{t(success)}</Notice>}
      {pending && <Notice>{t('Unconfirmed receipt. Retry the same receipt or refresh its history before entering another payment.')}</Notice>}
      <p className="cash-explanation">{t('Each shop has its own subscription. Payments are collected in USD cash.')}</p>
      {billing.legacy_access && <div className="cash-carryover"><strong>{t('Existing subscription—payment history unavailable')}</strong><p>{t('Existing access is preserved. Historical cash payments have not been assumed.')}</p></div>}
      <dl className="cash-summary">
        {([
          ['Annual price', money(billing.annual_cents)],
          ['Cash received', money(billing.agreement_id ? billing.paid_cents : null)],
          ['Remaining annual balance', money(billing.remaining_cents)],
          ['Payments recorded', number(billing.payment_count) + ' / ' + number(3)],
          [billing.subscription_status === 'trial' ? 'Trial ends' : 'Paid through', date(billing.paid_until, true)],
          ['Next collection date', date(billing.paid_until)],
        ] as [BillingCopyKey, string][]).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd><bdi dir={label === 'Payments recorded' ? 'ltr' : 'auto'}>{value}</bdi></dd></div>)}
      </dl>
      <p className="cash-explanation">{t('At most three payments per annual agreement. The third must settle the balance.')}</p>
      {canManage && !billing.archived && <div className="cash-management">
        <div><form className="cash-price-form" onSubmit={event => {
          event.preventDefault()
          try { const cents = usdCents(price); void act(() => setShopPrice(shopId, cents), 'Price saved.'); setPreview(null) }
          catch (caught) { setError(caught) }
        }}>
          <label>{t('Annual price for new agreements')}<input inputMode="decimal" dir="ltr" required value={price} onChange={e => setPrice(e.target.value)} placeholder="60.00" disabled={busy || Boolean(pending)} /></label>
          <BillingIconButton icon={Save} type="submit" label={t('Save price')} disabled={busy || Boolean(pending)} />
          <p>{t('Price changes apply to new agreements. The current agreement keeps its agreed price.')}</p>
        </form>
        {billing.legacy_access && !billing.paid_until && <form className="cash-price-form cash-legacy-review" onSubmit={event => {
          event.preventDefault()
          try { const ends = parseBeirutInput(legacyEnd); void act(() => reviewLegacyAccess(shopId, ends, billing.version), 'Existing access date reviewed.') }
          catch (caught) { setError(caught) }
        }}><label>{t('Existing paid-through date (Beirut time)')}<input type="datetime-local" value={legacyEnd} required onChange={event => setLegacyEnd(event.target.value)} disabled={busy || Boolean(pending)} /></label><p>{t('Enter the actual agreed expiry. This review changes access and creates no payment receipt.')}</p><button className="button button-outline" disabled={busy || Boolean(pending)}>{t('Confirm existing access end date')}</button></form>}</div>
        <form className="cash-payment-form" onSubmit={quotePayment}>
          <h3>{t('Record cash payment')}</h3>
          <p className="cash-date-guidance">{t('Choose the agreed access dates. The cash amount does not calculate expiry.')}</p>
          {!preview ? <div className="cash-form-grid">
            <label>{t('Cash amount (USD)')}<input dir="ltr" inputMode="decimal" value={amount} required onChange={e => setAmount(e.target.value)} placeholder="40.00" disabled={busy} /></label>
            <label>{t('Collected at (Beirut time)')}<input dir="ltr" type="datetime-local" value={collected} max={beirutInput()} required onChange={e => setCollected(e.target.value)} disabled={busy} /></label>
            <label>{t('Access starts at (Beirut time)')}<input dir="ltr" type="datetime-local" value={starts} required onChange={e => setStarts(e.target.value)} disabled={busy} /></label>
            <label>{t('Access expires at (Beirut time)')}<input dir="ltr" type="datetime-local" value={ends} min={starts || undefined} required onChange={e => setEnds(e.target.value)} disabled={busy} /></label>
            <label>{t('Receipt reference')}<input dir="ltr" value={reference} required maxLength={120} onChange={e => setReference(e.target.value)} disabled={busy} /></label>
            <label>{t('Internal note (optional)')}<textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)} disabled={busy} /></label>
            <BillingIconButton icon={Eye} type="submit" label={busy ? t('Saving…') : t('Preview payment')} disabled={busy || billing.next_annual_cents == null} />
            {billing.next_annual_cents == null && <p>{t('Set the annual shop price before recording cash')}</p>}
          </div> : <div className="cash-review" aria-live="polite">
            <h4>{t('Payment preview')}</h4>
            <dl>
              <div><dt>{t('Annual price')}</dt><dd><bdi>{money(preview.annual_cents)}</bdi></dd></div>
              <div><dt>{t('Cash amount (USD)')}</dt><dd><bdi>{money(preview.amount_cents)}</bdi></dd></div>
              <div><dt>{t('Collected')}</dt><dd>{date(preview.collected_at, true)}</dd></div>
              <div><dt>{t('Receipt reference')}</dt><dd><bdi>{reference}</bdi></dd></div>
              <div><dt>{t('Access starts')}</dt><dd>{date(preview.coverage_from, true)}</dd></div>
              <div><dt>{t('Agreed expiry')}</dt><dd>{date(preview.paid_until, true)}</dd></div>
              <div><dt>{t('Balance after this payment')}</dt><dd><bdi>{money(preview.remaining_cents)}</bdi></dd></div>
              <div><dt>{t('Payment number')}</dt><dd><bdi dir="ltr">{number(preview.payment_count)} / {number(3)}</bdi></dd></div>
            </dl>
            <p>{t('Recording this receipt updates access. No money is charged online.')}</p>
            {preview.suspended && <Notice>{t('This shop stays suspended until an admin restores access.')}</Notice>}
            {!preview.is_published && <Notice>{t('This shop remains hidden from guests.')}</Notice>}
            <div className="cash-actions"><button className="button button-primary" type="button" disabled={busy} onClick={confirmPayment}><Check size={17} /> {busy ? t('Saving…') : t('Confirm cash received')}</button><BillingIconButton icon={Pencil} label={t('Edit payment')} disabled={busy || Boolean(pending)} onClick={() => setPreview(null)} /></div>
          </div>}
        </form>
      </div>}
      <div className="cash-history"><h3>{t('Receipt history')}</h3>
        {billing.agreements?.length ? billing.agreements.map(agreement => <section className="cash-agreement" key={agreement.id}>
          <h4>{t('Agreement')} · {date(agreement.created_at)} · <bdi>{money(agreement.annual_cents)}</bdi></h4>
          <ol>{agreement.receipts.map(receipt => <li className={receipt.voided ? 'cash-receipt cash-voided' : 'cash-receipt'} key={receipt.id}>
            <div className="cash-receipt-top"><strong><bdi>{money(receipt.amount_cents)}</bdi></strong><bdi>{receipt.reference}</bdi>{receipt.voided && <span className="cash-tag">{t('Voided')}</span>}{canManage && !billing.archived && receipt.can_void && latest?.id === agreement.id && <BillingIconButton className="cash-receipt-action" icon={Undo2} danger label={t('Void receipt') + ' · ' + receipt.reference} disabled={busy || Boolean(pending)} onClick={() => { setReason(''); setError(null); setVoidRequest(crypto.randomUUID()); setVoidTarget(receipt) }} />}</div>
            <p>{t('Collected')}: {date(receipt.collected_at, true)}</p>
            <p>{t('Coverage')}: {date(receipt.coverage_from)} — {date(receipt.coverage_until)}</p>
            {admin && receipt.actor_email && <p>{t('Recorded by')}: <bdi>{receipt.actor_email}</bdi></p>}
            {admin && receipt.note && <p>{receipt.note}</p>}
            {admin && receipt.void_reason && <p>{t('Reason for correction')}: {receipt.void_reason}</p>}
          </li>)}</ol>
        </section>) : <p className="cash-empty">{t('No cash receipts recorded yet.')}</p>}
      </div>
      <dialog ref={dialog} className="cash-confirm-dialog" aria-labelledby={'cash-void-title-' + shopId} onCancel={event => { if (busy) event.preventDefault(); else setVoidTarget(null) }} onClose={() => setVoidTarget(null)}>
        <form onSubmit={event => { event.preventDefault(); void correctReceipt() }}>
          <div className="cash-section-heading"><h2 id={'cash-void-title-' + shopId}>{t('Correct an incorrect receipt')}</h2><button type="button" className="cash-icon-button" aria-label={t('Cancel')} disabled={busy} onClick={() => dialog.current?.close()}><X /></button></div>
          <p><bdi>{voidTarget?.reference}</bdi> · <bdi>{money(voidTarget?.amount_cents ?? null)}</bdi></p>
          <p>{t('This removes this receipt’s cash credit. Other receipts keep their agreed expiry dates. No cash refund is issued.')}</p>
          {Boolean(error) && <Notice tone="error">{billingError(language, error)}</Notice>}
          <label>{t('Reason for correction')}<textarea autoFocus required minLength={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label>
          <div className="cash-actions"><button className="button button-primary" disabled={busy}>{busy ? t('Saving…') : t('Void receipt')}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => dialog.current?.close()}>{t('Cancel')}</button></div>
        </form>
      </dialog>
    </section>
  )
}
