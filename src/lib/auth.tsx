import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'

interface AuthValue {
  session: Session | null
  loading: boolean
  demoMode: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({ session: null, loading: true, demoMode: false, signOut: async () => undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
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

  const value = useMemo(() => ({
    session,
    loading,
    demoMode,
    signOut: async () => { if (supabase) await supabase.auth.signOut() },
  }), [session, loading, demoMode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
