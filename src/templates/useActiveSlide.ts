import { useEffect, useRef, useState } from 'react'

/**
 * Tracks which slide is currently in view inside a scroller.
 *
 * Slides opt in with a `data-slide="<index>"` attribute. Templates use the
 * returned index for counters, dots and to drive the active slide's animation,
 * which keeps the work off scroll handlers and on the intersection observer.
 *
 * `viewportRoot` observes against the page instead of the container, for
 * templates whose sections scroll with the document (scrollytelling) rather
 * than inside their own snap scroller.
 */
export function useActiveSlide<T extends HTMLElement>(
  count: number,
  { viewportRoot = false }: { viewportRoot?: boolean } = {},
) {
  const containerRef = useRef<T>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const slides = Array.from(container.querySelectorAll<HTMLElement>('[data-slide]'))
    if (!slides.length) return

    const observer = new IntersectionObserver((entries) => {
      // Pick the most visible slide rather than the first to cross the line, so
      // a fast flick does not leave the counter on a slide already scrolled past.
      let best: { index: number; ratio: number } | null = null
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const index = Number((entry.target as HTMLElement).dataset.slide)
        if (Number.isNaN(index)) continue
        if (!best || entry.intersectionRatio > best.ratio) best = { index, ratio: entry.intersectionRatio }
      }
      if (best) setActive(best.index)
    }, {
      root: viewportRoot ? null : container,
      threshold: [0.25, 0.5, 0.75],
    })

    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [count, viewportRoot])

  return [containerRef, active, setActive] as const
}
