import { HardDrive, Image, Users } from 'lucide-react'
import type { Language, PlatformStorageUsage } from '../lib/types'
import { billingText } from '../lib/billingI18n'

function formatBytes(bytes: number, language: Language) {
  if (!bytes) return language === 'ar' ? '٠ بايت' : '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  // Supabase quotas are expressed in decimal GB, so keep the display aligned
  // with the plan rather than turning a 1 GB quota into 954 MB.
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1)
  const value = bytes / 1000 ** index
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  const number = new Intl.NumberFormat(language === 'ar' ? 'ar-LB' : 'en-US', { maximumFractionDigits: digits }).format(value)
  return `${number} ${units[index]}`
}

function percent(used: number, quota: number) {
  return quota > 0 ? Math.round((used / quota) * 1000) / 10 : 0
}

export function StorageUsagePanel({ usage, language }: { usage: PlatformStorageUsage; language: Language }) {
  const t = (key: Parameters<typeof billingText>[1]) => billingText(language, key)
  const remaining = Math.max(usage.quota_bytes - usage.used_bytes, 0)
  const usedPercent = percent(usage.used_bytes, usage.quota_bytes)
  const shownPercent = Math.min(usedPercent, 100)
  const usageClass = usedPercent >= 90 ? 'storage-usage-danger' : usedPercent >= 80 ? 'storage-usage-warning' : ''
  const generated = new Intl.DateTimeFormat(language === 'ar' ? 'ar-LB' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Beirut' }).format(new Date(usage.generated_at))

  return <section className="storage-usage" aria-label={t('Storage usage')}>
    <div className="storage-summary-grid">
      <article className={`storage-summary-card ${usageClass}`}>
        <div className="storage-summary-icon"><HardDrive size={20} /></div>
        <div><span>{t('Storage used')}</span><strong>{formatBytes(usage.used_bytes, language)}</strong><small>{usedPercent.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')}% {t('of configured quota')}</small></div>
      </article>
      <article className="storage-summary-card">
        <div className="storage-summary-icon"><HardDrive size={20} /></div>
        <div><span>{t('Storage remaining')}</span><strong>{formatBytes(remaining, language)}</strong><small>{t('Configured quota')}: {formatBytes(usage.quota_bytes, language)}</small></div>
      </article>
      <article className="storage-summary-card">
        <div className="storage-summary-icon"><Image size={20} /></div>
        <div><span>{t('Files stored')}</span><strong>{usage.total_files.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')}</strong><small>{t('Across all buckets')}</small></div>
      </article>
      <article className="storage-summary-card">
        <div className="storage-summary-icon"><Users size={20} /></div>
        <div><span>{t('Owners with files')}</span><strong>{usage.owners.filter(owner => owner.file_count > 0).length.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')}</strong><small>{t('Owner-attributed menu files')}</small></div>
      </article>
    </div>

    <article className={`storage-meter-card ${usageClass}`}>
      <div className="storage-meter-heading"><div><h2>{t('Storage capacity')}</h2><p>{t('Current file total compared with the configured Supabase plan quota.')}</p></div><strong>{formatBytes(usage.used_bytes, language)} / {formatBytes(usage.quota_bytes, language)}</strong></div>
      <div className="storage-meter" role="progressbar" aria-label={t('Storage used')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={shownPercent}><span style={{ width: `${shownPercent}%` }} /></div>
      {usedPercent >= 80 && <p className="storage-warning">{t(usedPercent >= 100 ? 'Storage quota exceeded. Upgrade or remove unused files.' : 'Storage is getting close to the configured quota.')}</p>}
      <p className="storage-note">{t('Last calculated')} <time dateTime={usage.generated_at}>{generated}</time>. {t('Quota is configured in the deployment environment.')}</p>
    </article>

    <div className="storage-detail-grid">
      <article className="storage-table-card">
        <div className="storage-card-heading"><div><h2>{t('Storage by bucket')}</h2><p>{t('Shared gallery files are shown separately from restaurant uploads.')}</p></div></div>
        <div className="storage-table-wrap"><table className="storage-table"><thead><tr><th>{t('Bucket')}</th><th>{t('Files')}</th><th>{t('Size')}</th></tr></thead><tbody>{usage.buckets.map(bucket => <tr key={bucket.bucket_id}><td><strong>{bucket.bucket_id === 'menu-assets' ? t('Menu assets') : bucket.bucket_id === 'gallery-assets' ? t('Shared gallery') : bucket.bucket_id}</strong>{bucket.bucket_id === 'gallery-assets' && <small>{t('Platform-owned')}</small>}</td><td>{bucket.file_count.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')}</td><td>{formatBytes(bucket.bytes, language)}</td></tr>)}</tbody></table></div>
        {usage.unattributed_menu_files > 0 && <p className="storage-warning">{t('Unattributed menu files')}: {usage.unattributed_menu_files.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')} ({formatBytes(usage.unattributed_menu_bytes, language)}). {t('These may be leftover files from deleted places.')}</p>}
      </article>

      <article className="storage-table-card">
        <div className="storage-card-heading"><div><h2>{t('Usage by owner')}</h2><p>{t('Menu assets are grouped by owner and restaurant.')}</p></div></div>
        {usage.owners.length ? <div className="storage-owner-list">{usage.owners.map(owner => <div className="storage-owner" key={owner.owner_id}><div className="storage-owner-heading"><div><strong><bdi>{owner.owner_email}</bdi></strong><small>{owner.file_count.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')} {t('files')}</small></div><strong>{formatBytes(owner.bytes, language)}</strong></div><ul>{owner.restaurants.map(restaurant => <li key={restaurant.restaurant_id}><span><b>{language === 'ar' ? restaurant.name_ar : restaurant.name_en}</b><small><bdi>/m/{restaurant.slug}</bdi> · {restaurant.file_count.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')} {t('files')}</small></span><strong>{formatBytes(restaurant.bytes, language)}</strong></li>)}</ul></div>)}</div> : <p className="cash-empty">{t('No owner files found.')}</p>}
      </article>
    </div>
  </section>
}
