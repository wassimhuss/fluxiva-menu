import { useEffect, useRef, useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { listBranchRequests, reviewBranchRequest } from '../lib/api'
import { branchRequestText } from '../lib/branchRequestI18n'
import { cashDate } from '../lib/billing'
import { useAuth } from '../lib/auth'
import type { BranchRequest, BranchRequestPage, Language } from '../lib/types'
import { Loading, Notice } from './Status'

export function BranchRequestsPanel({ language, admin = false, canManage = false, refreshToken = 0, onCreate }: {
  language: Language; admin?: boolean; canManage?: boolean; refreshToken?: number; onCreate?: (request: BranchRequest) => void
}) {
  const { session } = useAuth()
  const t = (text: string) => branchRequestText(language, text)
  const [data, setData] = useState<BranchRequestPage | null>(null)
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [decision, setDecision] = useState<{ request: BranchRequest; approve: boolean } | null>(null)
  const [note, setNote] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null)
    listBranchRequests(admin, page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load branch requests.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [admin, page, attempt, refreshToken, session?.user.id])
  useEffect(() => { if (decision) dialog.current?.showModal(); else dialog.current?.close() }, [decision])
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  async function confirm() {
    if (!decision) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await reviewBranchRequest(decision.request.id, decision.approve, note)
      setSuccess(decision.approve ? 'Request approved.' : 'Request rejected.')
      setDecision(null); setAttempt(value => value + 1)
    } catch { setError('Could not review this request.') }
    finally { setBusy(false) }
  }
  return <section className="branch-requests" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="branch-request-heading"><h3>{t(admin ? 'Branch requests' : 'Your branch requests')}</h3><button type="button" className="button button-outline button-small" disabled={loading || busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} />{t('Refresh')}</button></div>
    {error && <Notice tone="error">{t(error)}</Notice>}{success && <Notice tone="success">{t(success)}</Notice>}
    {loading ? <Loading label={t('Loading requests…')} /> : data && <>
      <p className="branch-request-count">{data.pending_count.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')} {t('pending')}</p>
      {data.requests.length ? <div className="branch-request-list">{data.requests.map(request => <article className="branch-request-card" key={request.id}>
        <div className="branch-request-heading"><strong>{language === 'ar' ? request.name_ar : request.name_en}</strong><span className="cash-tag">{t({ pending: 'Pending', approved: 'Approved', rejected: 'Rejected', created: 'Created' }[request.status])}</span></div>
        <p dir={language === 'ar' ? 'ltr' : 'rtl'}>{language === 'ar' ? request.name_en : request.name_ar}</p>
        {admin && <p><bdi>{request.owner_email}</bdi></p>}
        <p><bdi>/m/{request.slug}</bdi></p><p>{language === 'ar' ? request.address_ar : request.address_en}</p>
        {request.whatsapp && <p><bdi>{request.whatsapp}</bdi></p>}
        <time dateTime={request.created_at}>{cashDate(request.created_at, language, true)}</time>
        {request.decision_note && <p className="branch-request-note">{request.decision_note}</p>}
        {admin && canManage && request.status === 'pending' && <div className="cash-actions"><button type="button" className="button button-primary button-small" disabled={busy} onClick={() => { setNote(''); setError(''); setDecision({ request, approve: true }) }}><Check size={16} />{t('Approve')}</button><button type="button" className="button button-outline button-small" disabled={busy} onClick={() => { setNote(''); setError(''); setDecision({ request, approve: false }) }}><X size={16} />{t('Reject')}</button></div>}
        {!admin && request.status === 'approved' && onCreate && <button type="button" className="button button-primary button-small" onClick={() => onCreate(request)}>{t('Create approved branch')}</button>}
      </article>)}</div> : <p>{t('No branch requests yet.')}</p>}
      {data.total > 25 && <div className="cash-pagination"><button type="button" className="button button-outline button-small" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{t('Previous')}</button><span>{t('Page')} {page + 1} / {Math.ceil(data.total / 25)}</span><button type="button" className="button button-outline button-small" disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(value => value + 1)}>{t('Next')}</button></div>}
    </>}
    <dialog ref={dialog} className="cash-confirm-dialog" aria-labelledby="branch-decision-title" onCancel={event => { if (busy) event.preventDefault(); else setDecision(null) }} onClose={() => { if (!busy) setDecision(null) }}>
      <h2 id="branch-decision-title">{t(decision?.approve ? 'Approve this branch request?' : 'Reject this branch request?')}</h2>
      <p>{decision && (language === 'ar' ? decision.request.name_ar : decision.request.name_en)}</p>
      <p>{t(decision?.approve ? 'The owner can create this branch after approval.' : 'The owner will see your decision and note.')}</p>
      <label>{t('Note to owner (optional)')}<textarea maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      {error && <Notice tone="error">{t(error)}</Notice>}
      <div className="cash-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void confirm()}>{t(busy ? 'Saving…' : decision?.approve ? 'Approve' : 'Reject')}</button><button type="button" className="button button-outline" disabled={busy} onClick={() => setDecision(null)}>{t('Cancel')}</button></div>
    </dialog>
  </section>
}
