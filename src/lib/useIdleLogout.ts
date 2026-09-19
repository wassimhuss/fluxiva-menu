import { useEffect, useRef } from 'react'

/**
 * Signs an owner out after a stretch of no interaction.
 *
 * The case this exists for is a dashboard left open on a laptop or tablet at
 * the restaurant: without it, anyone who sits down has the account. It does
 * nothing about closing the browser and returning tomorrow — that needs a
 * session lifetime set on the Supabase project, which expires people on a
 * schedule whether they are working or not.
 */

/** Long enough to survive a dinner rush, short enough that overnight is not open. */
export const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000

/** Flag read by the sign-in page so it can say why the session ended. */
export const IDLE_SIGNOUT_KEY = 'fluxiva-idle-signout'

const CHECK_INTERVAL_MS = 30_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'focus'] as const

export function useIdleLogout(enabled: boolean, onIdle: () => void, limitMs = IDLE_LIMIT_MS) {
  const lastActive = useRef(Date.now())
  // Held in a ref so a new callback identity each render does not restart the
  // timer, which would otherwise keep the session alive forever.
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return

    lastActive.current = Date.now()
    const mark = () => { lastActive.current = Date.now() }
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, mark, { passive: true })

    const expired = () => Date.now() - lastActive.current >= limitMs

    /**
     * Polled rather than a single timer. A laptop closed for three hours does
     * not fire a pending setTimeout on schedule, so it would wake still signed
     * in — comparing timestamps catches the elapsed time either way.
     */
    const timer = window.setInterval(() => { if (expired()) onIdleRef.current() }, CHECK_INTERVAL_MS)

    // Returning to the tab is the moment it matters most, so check immediately
    // rather than waiting for the next poll.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && expired()) onIdleRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, mark)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, limitMs])
}
