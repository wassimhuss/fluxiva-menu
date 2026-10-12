import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAdminRole } from './api'
import { isSupabaseConfigured, supabase } from './supabase'
import { clearOwnerCache } from './queryClient'
import type { AdminRole } from './types'

interface AuthValue {
  session: Session | null
  loading: boolean
  demoMode: boolean
  /** Operator console role, or null when the user is not an operator. */
  adminRole: AdminRole | null
  /** True until the operator role has been resolved for the current session. */
  adminLoading: boolean
  adminError: boolean
  retryAdminRole: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  session: null, loading: true, demoMode: false, adminRole: null, adminLoading: true, adminError: false, retryAdminRole: () => undefined, signOut: async () => undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [adminError, setAdminError] = useState(false)
  const [roleAttempt, setRoleAttempt] = useState(0)
  /** Which auth state the role above was resolved for. */
  const [resolvedFor, setResolvedFor] = useState<string | null>(null)
  const demoMode = !isSupabaseConfigured
  const accountRef = useRef<string | null>(null)

  const authKey = demoMode ? 'demo' : session?.user.id ?? 'anonymous'

  /**
   * Derived rather than a separate flag, because a flag lags by one render:
   * it was set false while the session was still loading, so the instant the
   * session arrived there was a frame where nothing was "loading" and the role
   * was still null — long enough for the admin guard to bounce a real operator
   * to the dashboard before the lookup had even started.
   */
  const adminLoading = loading || resolvedFor !== authKey
  const retryAdminRole = useCallback(() => {
    setResolvedFor(null); setAdminError(false); setRoleAttempt(n => n + 1)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    let authEventReceived = false
    const applySession = (nextSession: Session | null) => {
      if (cancelled) return
      const nextAccount = nextSession?.user.id ?? null
      if (accountRef.current !== nextAccount) clearOwnerCache()
      accountRef.current = nextAccount
      setSession(nextSession)
    }
    supabase.auth.getSession()
      .then(({ data }) => { if (!authEventReceived) applySession(data.session) })
      // A rejection here — a network blip, or a browser that throws on blocked
      // site data — must still end the loading state. Otherwise every guard
      // that waits on it renders nothing and the dashboard is a blank page
      // with no error and no way back.
      .catch(() => { if (!authEventReceived) applySession(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true
      applySession(nextSession)
    })
    return () => { cancelled = true; data.subscription.unsubscribe() }
  }, [])

  // Resolved per session: signing out must drop the role, and signing in as a
  // different account must not inherit the previous one.
  useEffect(() => {
    if (demoMode) { setAdminRole('super_admin'); setAdminError(false); setResolvedFor('demo'); return }
    // Wait for the session to settle, so "no session yet" is never mistaken
    // for "signed out".
    if (loading) return
    if (authKey === 'anonymous') { setAdminRole(null); setAdminError(false); setResolvedFor('anonymous'); return }

    let cancelled = false
    const settle = (role: AdminRole | null, failed = false) => {
      if (cancelled) return
      setAdminError(failed)
      setAdminRole(role)
      setResolvedFor(authKey)
    }
    getAdminRole().then(role => settle(role), () => settle(null, true))
    return () => { cancelled = true }
  }, [authKey, demoMode, loading, roleAttempt])

  const value = useMemo(() => ({
    session,
    loading,
    demoMode,
    adminRole,
    adminLoading,
    adminError,
    retryAdminRole,
    signOut: async () => { clearOwnerCache(); if (supabase) await supabase.auth.signOut() },
  }), [session, loading, demoMode, adminRole, adminLoading, adminError, retryAdminRole])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
