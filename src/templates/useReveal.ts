import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Reveals an element the first time it scrolls into view.
 *
 * Returns a ref to attach to the container and a flag templates map onto a
 * `data-shown` attribute. Children stagger themselves in CSS off a `--i` custom
 * property rather than JS timers, so the work stays on the compositor.
 */
export function useReveal<T extends HTMLElement>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Users who asked for less motion get the final state with no transition.
    if (window.matchMedia(REDUCED_MOTION).matches) { setShown(true); return }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        setShown(true)
        observer.disconnect()
      }
    }, { rootMargin, threshold: 0.08 })

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin])

  return [ref, shown] as const
}

/** True when the visitor has asked for reduced motion. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION)
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
