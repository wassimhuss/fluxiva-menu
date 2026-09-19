import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Notice } from '../components/Status'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { IDLE_SIGNOUT_KEY } from '../lib/useIdleLogout'

type Mode = 'login' | 'signup' | 'forgot'

const COPY: Record<Mode, { eyebrow: string; title: string; blurb: string; submit: string }> = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to your menu',
    blurb: 'Manage your restaurant details and menu.',
    submit: 'Sign in',
  },
  signup: {
    eyebrow: 'Start free',
    title: 'Create your account',
    blurb: 'Your 14-day trial starts when you create your restaurant.',
    submit: 'Create account',
  },
  forgot: {
    eyebrow: 'Password help',
    title: 'Reset your password',
    blurb: 'Enter the email you signed up with and we’ll send you a link to set a new password.',
    submit: 'Send reset link',
  },
}

export function AuthPage({ mode }: { mode: Mode }) {
  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'
  const navigate = useNavigate()
  const { session, demoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [idleNotice, setIdleNotice] = useState(false)

  /**
   * Consumed in an effect, not a state initializer. Clearing the flag is a side
   * effect, and React deliberately runs initializers twice — the first call
   * cleared it and the second, seeing nothing, produced the value that stuck,
   * so the message never appeared. An effect that only ever sets true is safe
   * to run twice.
   */
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(IDLE_SIGNOUT_KEY)) return
      sessionStorage.removeItem(IDLE_SIGNOUT_KEY)
      setIdleNotice(true)
    } catch { /* storage may be blocked */ }
  }, [])

  if (session) return <Navigate to="/dashboard" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(''); setMessage('')
    if (!supabase) { navigate('/dashboard'); return }
    setBusy(true)

    if (isForgot) {
      // The origin the request was made from, so a reset started on the live
      // site returns to the live site. Each origin used must be listed under
      // Authentication → URL Configuration in Supabase.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setBusy(false)
      if (resetError) { setError(resetError.message); return }
      // Worded so it reveals nothing about whether that address has an account.
      setMessage('If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.')
      return
    }

    const result = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    if (isSignup && !result.data.session) setMessage('Check your email to confirm your account, then sign in.')
    else navigate(isSignup ? '/onboarding' : '/dashboard')
  }

  const copy = COPY[mode]

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <Brand light />
        <div><span className="eyebrow light"><span /> Fluxiva Menu</span><h1>A better first look at your restaurant.</h1><p>One menu, two languages, always up to date.</p></div>
        <small>Designed for restaurants in Lebanon.</small>
      </section>
      <section className="auth-main">
        <Link className="back-link" to={isForgot ? '/login' : '/'}>
          <ArrowLeft size={17} /> {isForgot ? 'Back to sign in' : 'Back home'}
        </Link>
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow"><span /> {copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.blurb}</p>
          {idleNotice && <Notice>You were signed out after two hours without activity. Sign in again to carry on.</Notice>}
          {demoMode && <Notice>Demo mode is active. Submit this form to preview the dashboard.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}

          <label>Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@restaurant.com" /></label>

          {!isForgot && (
            <label>
              <span className="label-row">
                Password
                {mode === 'login' && <Link className="label-link" to="/forgot-password">Forgot password?</Link>}
              </span>
              <span className="password-field">
                <input required aria-label="Password" minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button>
              </span>
            </label>
          )}

          <button className="button button-primary full" disabled={busy}>{busy ? 'Please wait…' : copy.submit}</button>

          <p className="auth-switch">
            {isForgot
              ? <>Remembered it? <Link to="/login">Sign in</Link></>
              : <>{isSignup ? 'Already have an account?' : 'New to Fluxiva Menu?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Start free'}</Link></>}
          </p>
          {!isSupabaseConfigured && <small className="demo-hint">Supabase credentials are not connected yet.</small>}
        </form>
      </section>
    </main>
  )
}
