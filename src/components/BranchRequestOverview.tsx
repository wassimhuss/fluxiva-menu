import { useId } from 'react'
import { CheckCircle2, Clock3, RefreshCw } from 'lucide-react'
import { branchRequestText } from '../lib/branchRequestI18n'
import type { BranchRequest, BranchRequestPage, Language } from '../lib/types'
import { Loading, Notice } from './Status'

/** Owner-level status card: requests belong to the account, not the selected shop. */
export function BranchRequestOverview({ language, data, loading, error, page, canCreate, onRefresh, onPage, onView, onCreate }: {
  language: Language; data: BranchRequestPage | null; loading: boolean; error: string; page: number; canCreate: boolean
  onRefresh: () => void; onPage: (page: number) => void; onView: () => void; onCreate: (request: BranchRequest) => void
}) {
  const titleId = useId()
  const t = (text: string) => branchRequestText(language, text)
  const number = (value: number) => value.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')
  return <section className="dashboard-card dashboard-branch-requests" dir={language === 'ar' ? 'rtl' : 'ltr'} aria-labelledby={titleId}>
    <header className="dashboard-branch-heading">
      <div><h2 id={titleId}>{t('Branch requests')}</h2><p>{t('Track requests and create approved branches here.')}</p></div>
      <button type="button" className="icon-button" aria-label={t('Refresh')} disabled={loading} onClick={onRefresh}><RefreshCw size={18} /></button>
    </header>
    {error && <Notice tone="error">{t(error)}</Notice>}
    {loading ? <Loading label={t('Loading requests…')} /> : data && <>
      <p className="dashboard-branch-count" role="status"><Clock3 size={15} aria-hidden="true" /><strong>{number(data.pending_count)} {t('pending')}</strong></p>
      {data.requests.length ? <div className="dashboard-branch-list">{data.requests.map(request => <article className={`dashboard-branch-row dashboard-branch-${request.status}`} key={request.id}>
        <div className="dashboard-branch-row-heading"><h3>{language === 'ar' ? request.name_ar : request.name_en}</h3><span className="dashboard-branch-status">{request.status === 'approved' && <CheckCircle2 size={15} aria-hidden="true" />}{t({ pending: 'Pending', approved: 'Branch approved', rejected: 'Rejected', created: 'Created' }[request.status])}</span></div>
        <p><bdi>/m/{request.slug}</bdi></p>
        {request.status === 'pending' && <p>{t('Your request is being reviewed. No need to send it again.')}</p>}
        {request.decision_note && <p className="dashboard-branch-note">{request.decision_note}</p>}
        {request.status === 'approved' && <><button type="button" className="button button-primary button-small" disabled={!canCreate} onClick={() => onCreate(request)}>{t('Create now')}</button>{!canCreate && <p>{t('Resolve expired or suspended shops before adding another place')}</p>}</>}
      </article>)}</div> : <p className="dashboard-branch-empty">{t('No branch requests yet.')}</p>}
      {data.total > data.page_size && <div className="dashboard-branch-pagination"><button type="button" className="button button-outline button-small" disabled={page === 0} onClick={() => onPage(page - 1)}>{t('Previous')}</button><span>{t('Page')} {number(page + 1)} / {number(Math.ceil(data.total / data.page_size))}</span><button type="button" className="button button-outline button-small" disabled={(page + 1) * data.page_size >= data.total} onClick={() => onPage(page + 1)}>{t('Next')}</button></div>}
    </>}
    <button type="button" className="button button-outline button-small dashboard-branch-view" onClick={onView}>{t(data?.total === 0 ? 'Request a new branch' : 'View requests')}</button>
  </section>
}
