import type { SubscriptionStatus } from './types'

const DAY = 86400000

export interface SubscriptionInput {
  subscription_status: SubscriptionStatus
  trial_ends_at?: string
  subscription_ends_at?: string
}

export interface SubscriptionState {
  kind: SubscriptionStatus
  /** Whether the public menu is being served right now. */
  serving: boolean
  /** Whole days until it lapses; null when nothing expires. Negative once lapsed. */
  daysLeft: number | null
  /** The moment it lapses, when there is one. */
  endsAt?: string
}

/** Whole days from now, rounded up. Negative once the date has passed. */
function daysUntil(iso?: string) {
  return iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / DAY) : null
}

/**
 * Compared against the raw timestamp rather than the rounded day count: a
 * subscription that lapsed an hour ago rounds to zero days, which would
 * otherwise read as still live.
 */
function isFuture(iso?: string) {
  return Boolean(iso && new Date(iso).getTime() > Date.now())
}

/**
 * Mirrors `public.subscription_is_live` in migration 005. Change both together —
 * a UI that disagrees with the database about whether a menu is live is worse
 * than no indicator at all.
 */
export function subscriptionState(input: SubscriptionInput): SubscriptionState {
  if (input.subscription_status === 'suspended') {
    return { kind: 'suspended', serving: false, daysLeft: null, endsAt: input.subscription_ends_at }
  }

  if (input.subscription_status === 'trial') {
    return {
      kind: 'trial',
      serving: isFuture(input.trial_ends_at),
      daysLeft: daysUntil(input.trial_ends_at),
      endsAt: input.trial_ends_at,
    }
  }

  // Active. A null end date means no expiry, matching the database.
  if (!input.subscription_ends_at) {
    return { kind: 'active', serving: true, daysLeft: null }
  }

  return {
    kind: 'active',
    serving: isFuture(input.subscription_ends_at),
    daysLeft: daysUntil(input.subscription_ends_at),
    endsAt: input.subscription_ends_at,
  }
}

/** Days before expiry at which the owner starts being warned. */
export const TRIAL_WARNING_DAYS = 7
export const RENEWAL_WARNING_DAYS = 14

/** True when the owner should be told their menu is about to stop being served. */
export function needsWarning(state: SubscriptionState) {
  if (!state.serving) return true
  if (state.daysLeft === null) return false
  return state.daysLeft <= (state.kind === 'trial' ? TRIAL_WARNING_DAYS : RENEWAL_WARNING_DAYS)
}
