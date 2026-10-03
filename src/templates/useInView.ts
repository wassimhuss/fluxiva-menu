import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Marks an element once it has scrolled properly into view.
 *
 * This exists to replace hover. These menus are opened by scanning a QR code,
 * so the pointer effects the designs were written with — a dish photograph
 * easing larger as you point at it — simply never fire. Reaching the dish by
 * scrolling is the gesture a phone actually has, so it drives the same effect.
 *
 * Distinct from `useReveal`, which gates whether a whole list is visible at
 * all and therefore reveals anything near the fold immediately. Here the point
 * *is* the transition, so nothing is short-circuited: an item on screen at load
 * still eases in rather than starting already finished.
 *
 * One-shot by default. Templates that want a reversible scroll response can
 * opt out, so their image settles back when the card leaves the viewport.
 */
export function useInView<T extends HTMLElement>(
  rootMargin = '0px 0px -12% 0px',
  { once = true }: { once?: boolean } = {},
) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Asked for less motion: hand over the settled state with no transition.
    if (window.matchMedia(REDUCED_MOTION).matches) { setInView(true); return }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return
      setInView(entry.isIntersecting)
      if (once && entry.isIntersecting) observer.disconnect()
    }, { rootMargin, threshold: 0.2 })

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin, once])

  return [ref, inView] as const
}
