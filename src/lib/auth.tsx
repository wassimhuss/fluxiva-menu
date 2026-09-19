import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getAdminRole } from './api'
import { isSupabaseConfigured, supabase } from './supabase'
import type { AdminRole } from './types'

interface AuthValue {
  session: Session | null
  loading: boolean
  demoMode: boolean
  /** Operator console role, or null when the user is not an operator. */
  adminRole: AdminRole | null
  /** True until the operator role has been resolved for the current session. */
  adminLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  session: null, loading: true, demoMode: false, adminRole: null, adminLoading: true, signOut: async () => undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  /** Which auth state the role above was resolved for. */
  const [resolvedFor, setResolvedFor] = useState<string | null>(null)
  const demoMode = !isSupabaseConfigured

  const authKey = demoMode ? 'demo' : session?.user.id ?? 'anonymous'

  /**
   * Derived rather than a separate flag, because a flag lags by one render:
   * it was set false while the session was still loading, so the instant the
   * session arrived there was a frame where nothing was "loading" and the role
   * was still null — long enough for the admin guard to bounce a real operator
   * to the dashboard before the lookup had even started.
   */
  const adminLoading = loading || resolvedFor !== authKey

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      // A rejection here — a network blip, or a browser that throws on blocked
      // site data — must still end the loading state. Otherwise every guard
      // that waits on it renders nothing and the dashboard is a blank page
      // with no error and no way back.
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  // Resolved per session: signing out must drop the role, and signing in as a
  // different account must not inherit the previous one.
  useEffect(() => {
    if (demoMode) { setAdminRole('super_admin'); setResolvedFor('demo'); return }
    // Wait for the session to settle, so "no session yet" is never mistaken
    // for "signed out".
    if (loading) return
    if (!session) { setAdminRole(null); setResolvedFor('anonymous'); return }

    let cancelled = false
    const settle = (role: AdminRole | null) => {
      if (cancelled) return
      setAdminRole(role)
      setResolvedFor(session.user.id)
    }
    getAdminRole().then(settle, () => settle(null))
    return () => { cancelled = true }
  }, [session, demoMode, loading])

  const value = useMemo(() => ({
    session,
    loading,
    demoMode,
    adminRole,
    adminLoading,
    signOut: async () => { if (supabase) await supabase.auth.signOut() },
  }), [session, loading, demoMode, adminRole, adminLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
