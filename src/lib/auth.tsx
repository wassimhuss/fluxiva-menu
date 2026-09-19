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
  const [adminLoading, setAdminLoading] = useState(true)
  const demoMode = !isSupabaseConfigured

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  // Resolved per session: signing out must drop the role, and signing in as a
  // different account must not inherit the previous one.
  useEffect(() => {
    if (demoMode) { setAdminRole('super_admin'); setAdminLoading(false); return }
    if (!session) { setAdminRole(null); setAdminLoading(false); return }

    let cancelled = false
    setAdminLoading(true)
    getAdminRole()
      .then((role) => { if (!cancelled) setAdminRole(role) })
      .catch(() => { if (!cancelled) setAdminRole(null) })
      .finally(() => { if (!cancelled) setAdminLoading(false) })
    return () => { cancelled = true }
  }, [session, demoMode])

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
