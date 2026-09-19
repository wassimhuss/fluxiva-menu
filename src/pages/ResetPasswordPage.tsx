import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Loading, Notice } from '../components/Status'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/**
 * Where the emailed reset link lands.
 *
 * Supabase signs the visitor in from the token in the URL fragment, so by the
 * time this renders there is normally a session and `updateUser` can set the
 * new password. No session means the link was already used, has expired, or
 * someone reached this page directly.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, loading, demoMode } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // An expired or reused link comes back with the reason in the URL fragment
  // rather than as a failed request.
  const linkError = useMemo(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const description = fragment.get('error_description')
    if (description) return description.replace(/\+/g, ' ')
    return fragment.get('error') ? 'This reset link is no longer valid.' : ''
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) { setError('Both passwords need to match.'); return }
    if (!supabase) { navigate('/dashboard'); return }

    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) { setError(updateError.message); return }
    // The recovery link already signed them in, so they go straight through.
    navigate('/dashboard', { replace: true })
  }

  const ready = demoMode || Boolean(session)

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <Brand light />
        <div><span className="eyebrow light"><span /> Fluxiva Menu</span><h1>A better first look at your restaurant.</h1><p>One menu, two languages, always up to date.</p></div>
        <small>Designed for restaurants in Lebanon.</small>
      </section>
      <section className="auth-main">
        <Link className="back-link" to="/login"><ArrowLeft size={17} /> Back to sign in</Link>

        {loading ? <div className="auth-card"><Loading label="Checking your link…" /></div> : (
          <form className="auth-card" onSubmit={submit}>
            <span className="eyebrow"><span /> Password help</span>
            <h2>Choose a new password</h2>
            <p>{ready ? 'Pick something you’ll remember. You’ll be signed in straight after.' : 'This link can’t be used to reset a password.'}</p>

            {linkError && <Notice tone="error">{linkError}</Notice>}
            {!ready && !linkError && (
              <Notice tone="error">This reset link has expired or has already been used.</Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}

            {ready ? <>
              <label>New password
                <span className="password-field">
                  <input required aria-label="New password" minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button>
                </span>
              </label>
              <label>Confirm new password
                <input required aria-label="Confirm new password" minLength={8} type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Type it once more" />
              </label>
              <button className="button button-primary full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
            </> : (
              <Link className="button button-primary full" to="/forgot-password">Request a new link</Link>
            )}

            <p className="auth-switch">Remembered it? <Link to="/login">Sign in</Link></p>
          </form>
        )}
      </section>
    </main>
  )
}
