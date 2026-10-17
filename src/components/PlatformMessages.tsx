import { useEffect, useRef, useState } from 'react'
import { listAnnouncements, sendAnnouncement } from '../lib/api'
import { notificationError, notificationText } from '../lib/notificationI18n'
import { cashDate } from '../lib/billing'
import type { AnnouncementInput, AnnouncementPage, Language } from '../lib/types'
import { Loading, Notice } from './Status'

const empty = (): AnnouncementInput => ({ title_en: '', title_ar: '', body_en: '', body_ar: '' })
export function PlatformMessages({ language, canManage, refreshToken = 0 }: { language: Language; canManage: boolean; refreshToken?: number }) {
  const t = (text: string) => notificationText(language, text)
  const [draft, setDraft] = useState(empty), [review, setReview] = useState<AnnouncementInput | null>(null)
  const [data, setData] = useState<AnnouncementPage | null>(null), [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState<number | null>(null)
  const requestId = useRef(crypto.randomUUID()), sending = useRef(false), dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    listAnnouncements(page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load sent messages.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, attempt, refreshToken])
  useEffect(() => { if (review) dialog.current?.showModal(); else dialog.current?.close() }, [review])
  async function send() {
    if (!review || !canManage || sending.current) return
    sending.current = true; setBusy(true); setError(''); setSent(null)
    try {
      const receipt = await sendAnnouncement(requestId.current, review)
      setSent(receipt.recipient_count); setDraft(empty()); setReview(null)
      requestId.current = crypto.randomUUID(); setPage(0); setAttempt(value => value + 1)
    } catch (cause) { setError(notificationError(cause, 'Could not confirm sending. Retry with the same message to avoid duplicates.')) }
    finally { sending.current = false; setBusy(false) }
  }
  return <div className="platform-messages">
    {sent !== null && <Notice tone="success">{t('Message sent.')} {t('Owner accounts notified')}: {sent.toLocaleString(language)}</Notice>}
    {error && !review && <Notice tone="error">{t(error)}</Notice>}
    {canManage && <form className="notification-compose" onSubmit={event => { event.preventDefault(); setError(''); setSent(null); setReview({ ...draft }) }}>
      <h2>{t('Send a message to all owners')}</h2><p>{t('Messages appear in the dashboard of current owner accounts. No email or WhatsApp is sent.')}</p>
      <div className="notification-compose-grid">{(['title_en', 'title_ar', 'body_en', 'body_ar'] as const).map(field => <label key={field}>{t({ title_en: 'English title', title_ar: 'Arabic title', body_en: 'English message', body_ar: 'Arabic message' }[field])}
        {field.startsWith('title') ? <input required maxLength={200} dir={field.endsWith('_ar') ? 'rtl' : 'ltr'} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} /> : <textarea required maxLength={5000} dir={field.endsWith('_ar') ? 'rtl' : 'ltr'} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />}
      </label>)}</div>
      <button className="button button-primary" disabled={busy}>{t('Review message')}</button>
    </form>}
    <section aria-label={t('Sent messages')}><header className="notification-section-heading"><h2>{t('Sent messages')}</h2><button className="button button-outline button-small" disabled={loading} onClick={() => { setError(''); setAttempt(value => value + 1) }}>{t('Refresh')}</button></header>
      {loading ? <Loading label={t('Loading messages…')} /> : data && <>
        {data.messages.length ? <div className="notification-message-list">{data.messages.map(message => <article className="notification-message" key={message.id}>
          <h3>{language === 'ar' ? message.title_ar : message.title_en}</h3><time dateTime={message.created_at}>{cashDate(message.created_at, language, true)}</time><p>{language === 'ar' ? message.body_ar : message.body_en}</p>
          <small>{t('Recipients')}: {message.recipient_count.toLocaleString(language)} · {t('Read by')}: {message.read_count.toLocaleString(language)}</small>
        </article>)}</div> : <p>{t('No sent messages yet.')}</p>}
        {data.total > data.page_size && <div className="notification-pagination"><button className="button button-outline button-small" disabled={!page} onClick={() => setPage(value => value - 1)}>{t('Previous')}</button><span>{t('Page')} {(page + 1).toLocaleString(language)} / {Math.ceil(data.total / data.page_size).toLocaleString(language)}</span><button className="button button-outline button-small" disabled={(page + 1) * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>{t('Next')}</button></div>}
      </>}
    </section>
    {canManage && <dialog ref={dialog} className="cash-confirm-dialog notification-review" aria-labelledby="announcement-review-title" onCancel={event => { if (busy) event.preventDefault(); else setReview(null) }} onClose={() => { if (!busy) setReview(null) }}>
      <h2 id="announcement-review-title">{t('Send to all owners?')}</h2><p>{t('Messages appear in the dashboard of current owner accounts. No email or WhatsApp is sent.')}</p>
      {review && <><div dir="ltr"><h3>{review.title_en}</h3><p>{review.body_en}</p></div><div dir="rtl"><h3>{review.title_ar}</h3><p>{review.body_ar}</p></div></>}
      {error && <Notice tone="error">{t(error)}</Notice>}
      <div className="cash-actions"><button className="button button-primary" disabled={busy} onClick={() => void send()}>{t(busy ? 'Sending…' : 'Send message')}</button><button className="button button-outline" disabled={busy} onClick={() => setReview(null)}>{t('Cancel')}</button></div>
    </dialog>}
  </div>
}
