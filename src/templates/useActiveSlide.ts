import { useEffect, useState } from 'react'

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
 *
 * Returns a callback ref to attach, the active index, and the element itself.
 * The element is handed back so sibling hooks can depend on it: templates
 * remount their scroller when the category changes, and anything keyed only on
 * the slide *count* silently keeps working against the old, detached nodes
 * whenever two categories happen to hold the same number of items.
 */
export function useActiveSlide<T extends HTMLElement>(
  count: number,
  { viewportRoot = false }: { viewportRoot?: boolean } = {},
) {
  const [container, setContainer] = useState<T | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!container) return

    const slides = Array.from(container.querySelectorAll<HTMLElement>('[data-slide]'))
    if (!slides.length) return

    // A fresh set of slides starts at the first one; the observer corrects this
    // immediately for whatever is actually on screen.
    setActive(0)

    /* Last known visibility of every slide, not just the ones in the current
       batch. A callback only carries slides whose intersection crossed a
       threshold, so the slide that is actually centred is frequently absent
       from it — choosing the best entry within one batch returned the slide
       you had just left, and the index trailed the deck by exactly one card.
       Holding the ratios here means the maximum is taken over all of them. */
    const ratios = new Map<number, number>()

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.slide)
        if (Number.isNaN(index)) continue
        ratios.set(index, entry.isIntersecting ? entry.intersectionRatio : 0)
      }

      // Most visible slide wins, so a fast flick does not leave the counter on
      // a slide already scrolled past.
      let bestIndex = -1
      let bestRatio = 0
      for (const [index, ratio] of ratios) {
        if (ratio > bestRatio) { bestIndex = index; bestRatio = ratio }
      }
      if (bestIndex >= 0) setActive(bestIndex)
    }, {
      root: viewportRoot ? null : container,
      // 0 and 1 included so a slide reports when it leaves entirely and when it
      // fills the frame, which keeps the stored ratios honest between batches.
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })

    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [container, count, viewportRoot])

  return [setContainer, active, container] as const
}
