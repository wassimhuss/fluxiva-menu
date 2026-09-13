import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Notice } from '../components/Status'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const { session, demoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(''); setMessage('')
    if (!supabase) { navigate('/dashboard'); return }
    setBusy(true)
    const result = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    if (isSignup && !result.data.session) setMessage('Check your email to confirm your account, then sign in.')
    else navigate(isSignup ? '/onboarding' : '/dashboard')
  }

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <Brand light />
        <div><span className="eyebrow light"><span /> Fluxiva Menu</span><h1>A better first look at your restaurant.</h1><p>One menu, two languages, always up to date.</p></div>
        <small>Designed for restaurants in Lebanon.</small>
      </section>
      <section className="auth-main">
        <Link className="back-link" to="/"><ArrowLeft size={17} /> Back home</Link>
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow"><span /> {isSignup ? 'Start free' : 'Welcome back'}</span>
          <h2>{isSignup ? 'Create your account' : 'Sign in to your menu'}</h2>
          <p>{isSignup ? 'Your 14-day trial starts when you create your restaurant.' : 'Manage your restaurant details and menu.'}</p>
          {demoMode && <Notice>Demo mode is active. Submit this form to preview the dashboard.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
          <label>Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@restaurant.com" /></label>
          <label>Password<span className="password-field"><input required aria-label="Password" minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
          <button className="button button-primary full" disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</button>
          <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to Fluxiva Menu?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Start free'}</Link></p>
          {!isSupabaseConfigured && <small className="demo-hint">Supabase credentials are not connected yet.</small>}
        </form>
      </section>
    </main>
  )
}
