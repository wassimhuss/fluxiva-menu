import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * How far below the fold something can start and still be revealed straight
 * away. Roughly one more screenful: close enough that the visitor is about to
 * scroll to it, so leaving it blank would read as a broken menu rather than as
 * an effect.
 */
const IMMEDIATE_REVEAL_SCREENS = 1.25

/**
 * Reveals an element the first time it scrolls into view.
 *
 * Returns a ref to attach to the container and a flag templates map onto a
 * `data-shown` attribute. Children stagger themselves in CSS off a `--i` custom
 * property rather than JS timers, so the work stays on the compositor.
 *
 * Note this gates *visibility*, not just motion: an unrevealed child sits at
 * `opacity: 0` while still taking up layout space. So the bar for holding
 * something back has to be high — anything near the fold is revealed at once
 * (it still animates in, it just never sits there invisible), and only content
 * genuinely far down the page waits for a scroll.
 *
 * The margin expands the viewport's bottom edge rather than shrinking it, so a
 * grid begins appearing slightly before it arrives instead of after.
 */
export function useReveal<T extends HTMLElement>(rootMargin = '0px 0px 15% 0px') {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Users who asked for less motion get the final state with no transition.
    if (window.matchMedia(REDUCED_MOTION).matches) { setShown(true); return }

    if (element.getBoundingClientRect().top < window.innerHeight * IMMEDIATE_REVEAL_SCREENS) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        setShown(true)
        observer.disconnect()
      }
    }, {
      rootMargin,
      // Any sliver counts. A proportional threshold is meaningless here: these
      // containers are thousands of pixels tall, so even 8% of one is most of a
      // screen, and the grid would stay blank well after scrolling onto it.
      threshold: 0,
    })

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
