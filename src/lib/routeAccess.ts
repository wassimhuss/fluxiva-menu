import type { AdminRole } from './types'

export function routeAccess(state: {
  session: unknown; loading: boolean; demoMode: boolean; adminRole: AdminRole | null;
  adminLoading: boolean; adminError: boolean
}, kind: 'owner' | 'operator') {
  if (state.loading) return 'loading'
  if (!state.session && !state.demoMode) return '/login'
  if (state.adminLoading) return 'loading'
  if (state.adminError) return 'error'
  // Demo mode deliberately exposes both previews without a real account.
  if (state.demoMode) return 'allow'
  if (kind === 'owner' && state.adminRole) return '/platform'
  if (kind === 'operator' && !state.adminRole) return '/dashboard'
  return 'allow'
}
