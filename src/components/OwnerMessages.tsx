import { RefreshCw } from 'lucide-react'
import { notificationText } from '../lib/notificationI18n'
import { cashDate } from '../lib/billing'
import type { Language, OwnerNotificationPage } from '../lib/types'
import { Loading, Notice } from './Status'

export function OwnerMessages({ language, data, loading, error, reading, onRead, onRefresh, onPage }: {
  language: Language; data: OwnerNotificationPage | null; loading: boolean; error: string; reading: string
  onRead: (id: string) => void; onRefresh: () => void; onPage: (page: number) => void
}) {
  const t = (text: string) => notificationText(language, text)
  return <section className="owner-messages" aria-label={t('Messages from Fluxiva')}>
    <header className="notification-section-heading"><h2>{t('Messages from Fluxiva')}</h2><button className="icon-button" type="button" disabled={loading} onClick={onRefresh} aria-label={t('Refresh')}><RefreshCw size={18} /></button></header>
    {error && <Notice tone="error">{t(error)}</Notice>}
    {loading && !data ? <Loading label={t('Loading notifications…')} /> : data && <>
      {data.messages.length ? <div className="notification-message-list">{data.messages.map(message => <article className={`notification-message ${message.read_at ? '' : 'notification-unread'}`} key={message.id}>
        <header><h3>{language === 'ar' ? message.title_ar : message.title_en}</h3><span>{t(message.read_at ? 'Read' : 'Unread')}</span></header>
        <time dateTime={message.created_at}>{cashDate(message.created_at, language, true)}</time>
        <p>{language === 'ar' ? message.body_ar : message.body_en}</p>
        {!message.read_at && <button type="button" className="button button-outline button-small" disabled={Boolean(reading)} onClick={() => onRead(message.id)}>{t('Mark as read')}</button>}
      </article>)}</div> : <p>{t('No messages yet.')}</p>}
      {data.total > data.page_size && <div className="notification-pagination"><button className="button button-outline button-small" disabled={!data.page} onClick={() => onPage(data.page - 1)}>{t('Previous')}</button><span>{t('Page')} {(data.page + 1).toLocaleString(language)} / {Math.ceil(data.total / data.page_size).toLocaleString(language)}</span><button className="button button-outline button-small" disabled={(data.page + 1) * data.page_size >= data.total} onClick={() => onPage(data.page + 1)}>{t('Next')}</button></div>}
    </>}
  </section>
}
