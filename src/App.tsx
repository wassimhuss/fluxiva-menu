import { Suspense, lazy, useCallback, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/Status'
import { routeAccess } from './lib/routeAccess'
import { AuthProvider, useAuth } from './lib/auth'
import { IDLE_SIGNOUT_KEY, useIdleLogout } from './lib/useIdleLogout'
import { PublicMenuPage } from './pages/PublicMenuPage'
import { BranchSelectorPage } from './pages/BranchSelectorPage'

/**
 * The two public guest-entry screens are bundled eagerly. A QR scan must not
 * pay for a second round trip, and neither route should carry the owner
 * dashboard, workbook tools, QR generator or operator console along with it.
 */
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PlatformPage = lazy(() => import('./pages/PlatformPage').then((m) => ({ default: m.PlatformPage })))
const AccountAccessError = lazy(() => import('./components/AccountAccessError').then((m) => ({ default: m.AccountAccessError })))

/**
 * Ends an idle session on the signed-in pages. Not applied to the public menu:
 * diners have no session, and an owner reading their own menu is not the risk.
 */
function useIdleSignOut() {
  const { session, demoMode, signOut } = useAuth()
  useIdleLogout(Boolean(session) && !demoMode, useCallback(() => {
    // Recorded before signing out, because signing out re-renders the guard
    // and redirects immediately — there is no reliable moment afterwards to
    // pass the reason along.
    try { sessionStorage.setItem(IDLE_SIGNOUT_KEY, '1') } catch { /* storage may be blocked */ }
    void signOut()
  }, [signOut]))
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  useIdleSignOut()
  const access = routeAccess(auth, 'owner')
  if (access === 'loading') return <RouteFallback />
  if (access === 'error') return <AccountAccessError />
  if (access !== 'allow') return <Navigate to={access} replace />
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
  const auth = useAuth()
  useIdleSignOut()
  const access = routeAccess(auth, 'operator')
  if (access === 'loading') return <RouteFallback />
  if (access === 'error') return <AccountAccessError />
  if (access !== 'allow') return <Navigate to={access} replace />
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
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          {/* Public on purpose: the visitor arrives here from an email link. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding" element={<OwnerRoute><OnboardingPage /></OwnerRoute>} />
          <Route path="/dashboard" element={<OwnerRoute><DashboardPage /></OwnerRoute>} />
          <Route path="/platform" element={<AdminRoute><PlatformPage /></AdminRoute>} />
          <Route path="/b/:slug" element={<BranchSelectorPage />} />
          <Route path="/m/:slug" element={<PublicMenuPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
