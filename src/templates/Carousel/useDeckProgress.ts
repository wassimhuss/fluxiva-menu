import { useEffect, type RefObject } from 'react'

/**
 * Writes each card's distance from the centre of the deck onto the element as
 * `--p` (signed, in card widths) and `--pa` (its absolute value).
 *
 * CSS turns those into the cover-flow rotation, depth and fade, so the actual
 * animation stays on the compositor and this only ever sets two custom
 * properties per card, throttled to one animation frame.
 *
 * Because the values come from measured positions rather than scroll offsets,
 * this needs no special case for right-to-left.
 */
export function useDeckProgress<T extends HTMLElement>(ref: RefObject<T>, count: number) {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0

    const update = () => {
      frame = 0
      // Layout metrics, not getBoundingClientRect: the rect reflects the very
      // transform these values produce, so measuring it would feed back on
      // itself and settle on a distorted deck. offsetLeft/offsetWidth ignore
      // transforms, and the arithmetic holds in both directions because
      // scrollLeft simply goes negative in right-to-left.
      const centre = element.offsetLeft + element.scrollLeft + element.clientWidth / 2
      for (const card of element.querySelectorAll<HTMLElement>('[data-slide]')) {
        const width = Math.max(card.offsetWidth, 1)
        const offset = (card.offsetLeft + width / 2 - centre) / width
        // Far cards are clamped so the deck never folds in on itself.
        const clamped = Math.max(-2.4, Math.min(2.4, offset))
        card.style.setProperty('--p', clamped.toFixed(3))
        card.style.setProperty('--pa', Math.abs(clamped).toFixed(3))
      }
    }

    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }

    update()
    // Once more after layout settles, so the first paint is not mid-transition.
    const settle = requestAnimationFrame(update)

    element.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    return () => {
      element.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(settle)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, count])
}
