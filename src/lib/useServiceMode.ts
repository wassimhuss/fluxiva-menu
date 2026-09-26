import { useCallback, useEffect, useState } from 'react'

/** How the diner intends to eat, chosen before the menu opens. */
export type ServiceMode = 'dine-in' | 'takeaway'

const storageKey = (slug: string) => `fluxiva-service:${slug}`

function readStored(slug: string): ServiceMode | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(slug))
    return raw === 'dine-in' || raw === 'takeaway' ? raw : null
  } catch { return null }
}

/**
 * Remembers the choice for the visit.
 *
 * Session storage, not local: someone who ate in on Monday may well be
 * ordering a takeaway on Friday, and asking again on a new visit costs one tap
 * while guessing wrong costs them the feature entirely.
 */
export function useServiceMode(slug: string, enabled: boolean) {
  const [mode, setMode] = useState<ServiceMode | null>(null)
  /* The menu has to load before we know whether this restaurant even offers
     takeaway, so `enabled` is false on the first render. Reading storage in a
     state initialiser would therefore always run too early and find nothing —
     the same trap the order hook fell into. */
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !slug || hydratedFor === slug) return
    setMode(readStored(slug))
    setHydratedFor(slug)
  }, [enabled, slug, hydratedFor])

  const choose = useCallback((next: ServiceMode) => {
    setMode(next)
    try { window.sessionStorage.setItem(storageKey(slug), next) } catch { /* storage blocked; the choice lasts this page only */ }
  }, [slug])

  const reset = useCallback(() => {
    setMode(null)
    try { window.sessionStorage.removeItem(storageKey(slug)) } catch { /* nothing to clear */ }
  }, [slug])

  return { mode, choose, reset, ready: !enabled || hydratedFor === slug }
}
