import { useAuth } from '../lib/auth'
import { AUTH_LANGUAGE_KEY, authText } from '../lib/authI18n'
import { Notice } from './Status'

export function AccountAccessError() {
  const { retryAdminRole, signOut } = useAuth()
  let language: 'en' | 'ar' = 'en'
  try { if (localStorage.getItem(AUTH_LANGUAGE_KEY) === 'ar') language = 'ar' } catch { /* blocked storage */ }
  return <main className="dashboard-loading" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
    <div className="auth-card"><Notice tone="error">{authText(language, 'Could not confirm account access. Please try again.')}</Notice>
      <button className="button button-primary" onClick={retryAdminRole}>{authText(language, 'Try again')}</button>{' '}
      <button className="button button-outline" onClick={() => void signOut()}>{authText(language, 'Sign out')}</button>
    </div>
  </main>
}
