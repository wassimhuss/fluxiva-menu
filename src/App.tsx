import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PlatformPage } from './pages/PlatformPage'
import { PublicMenuPage } from './pages/PublicMenuPage'

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, demoMode } = useAuth()
  if (loading) return null
  if (!session && !demoMode) return <Navigate to="/login" replace />
  return children
}

/**
 * Gate for the operator console.
 *
 * The database already rejects the privileged calls, but the route itself was
 * only behind OwnerRoute, so any signed-in restaurant owner could open the
 * console shell. A non-operator is sent to their dashboard rather than shown a
 * refusal, so the console's existence is not advertised.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, demoMode, adminRole, adminLoading } = useAuth()
  if (loading || adminLoading) return null
  if (!session && !demoMode) return <Navigate to="/login" replace />
  if (!adminRole) return <Navigate to="/dashboard" replace />
  return children
}

function ScrollToTop() {
  const location = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  return null
}

export function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/onboarding" element={<OwnerRoute><OnboardingPage /></OwnerRoute>} />
        <Route path="/dashboard" element={<OwnerRoute><DashboardPage /></OwnerRoute>} />
        <Route path="/platform" element={<AdminRoute><PlatformPage /></AdminRoute>} />
        <Route path="/m/:slug" element={<PublicMenuPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
