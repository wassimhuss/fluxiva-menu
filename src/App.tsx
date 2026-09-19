import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/Status'
import { AuthProvider, useAuth } from './lib/auth'
import { PublicMenuPage } from './pages/PublicMenuPage'

/**
 * Only the public menu is bundled eagerly. It is the screen almost all traffic
 * arrives on — someone scanning a QR code at a table — so it must not pay for a
 * second round trip, and it must not carry the owner dashboard, the CSV
 * importer, the QR generator or the operator console along with it.
 */
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PlatformPage = lazy(() => import('./pages/PlatformPage').then((m) => ({ default: m.PlatformPage })))

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

function RouteFallback() {
  return <main className="dashboard-loading"><Loading /></main>
}

export function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </AuthProvider>
  )
}
