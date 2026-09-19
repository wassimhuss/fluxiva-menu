import { useEffect, useRef } from 'react'
import { scrollOffset, scrollToSlide, slideScrollOffset } from './scrollToSlide'

/**
 * Guarantees one slide per gesture, the way a short-video feed behaves.
 *
 * CSS `scroll-snap-stop: always` is meant to do this on its own, but it only
 * holds for well-behaved input. A hard trackpad flick emits a burst of discrete
 * `wheel` events over roughly a second, and each one is technically its own
 * scroll, so the container can walk past several slides before settling.
 *
 * Two different strategies, because the two input types fail differently:
 *
 * - **Wheel** is taken over completely. The native scroll is cancelled and the
 *   container is glided to exactly one slide along. Every further event in the
 *   burst re-arms the lock instead of advancing, so inertia can never queue up
 *   a second jump.
 * - **Touch** keeps its native scrolling, because finger-follow and rubber-band
 *   are most of what makes a feed feel right, and browsers usually honour
 *   snap-stop here. It is only corrected after the scroll settles, and only if
 *   it actually overshot by more than one slide.
 *
 * Slides are found by the same `data-slide="<index>"` attribute `useActiveSlide`
 * uses, so both hooks read the same markup.
 */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
/** Roughly how long a smooth glide runs; input is ignored for at least this long. */
const GLIDE_MS = 430
/** How quiet the input must go before the lock lifts. */
const QUIET_MS = 170
/** Below this, a wheel event is trackpad jitter rather than intent. */
const WHEEL_THRESHOLD = 8
/** Minimum finger travel that counts as a deliberate swipe. */
const SWIPE_THRESHOLD = 40
/** Debounce before a native scroll is treated as finished. */
const SETTLE_MS = 140

interface SnapLockOptions<T extends HTMLElement> {
  /** The scroller itself, so the listeners re-bind when the template remounts it. */
  container: T | null
  axis: 'x' | 'y'
  count: number
  /** Latest index observed by `useActiveSlide`. */
  activeIndex: number
  /** Needed so the arrow keys still read correctly in Arabic. */
  rtl?: boolean
}

export function useSnapLock<T extends HTMLElement>({
  container,
  axis,
  count,
  activeIndex,
  rtl = false,
}: SnapLockOptions<T>) {
  const indexRef = useRef(activeIndex)
  const lockedRef = useRef(false)
  const lockUntilRef = useRef(0)
  const releaseTimer = useRef<number | undefined>(undefined)
  const settleTimer = useRef<number | undefined>(undefined)
  const alignTimer = useRef<number | undefined>(undefined)
  const touchOrigin = useRef<number | null>(null)
  const touchStartIndex = useRef(0)
  /** Overshoot correction applies to finger momentum only, never to our own glide. */
  const touchDriven = useRef(false)

  // Follow the observed index whenever no gesture is in flight, so a dot click
  // or a scrollbar drag does not leave this pointing at a stale slide.
  useEffect(() => {
    if (!lockedRef.current) indexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    const element = container
    if (!element || count <= 1) return

    const reduced = window.matchMedia(REDUCED_MOTION).matches
    const vertical = axis === 'y'

    const slides = () => Array.from(element.querySelectorAll<HTMLElement>('[data-slide]'))

    /**
     * Whichever slide the container is actually resting nearest, from layout
     * offsets. Transform-independent, so a cover-flow deck reports honestly,
     * and correct in both directions.
     */
    const currentIndex = () => {
      const current = scrollOffset(element, axis)
      let best = indexRef.current
      let bestDistance = Infinity
      for (const slide of slides()) {
        const index = Number(slide.dataset.slide)
        const expected = slideScrollOffset(element, index, axis)
        if (expected === null) continue
        const distance = Math.abs(expected - current)
        if (distance < bestDistance) {
          bestDistance = distance
          best = index
        }
      }
      return best
    }

    const goTo = (index: number) => {
      const next = Math.min(Math.max(index, 0), count - 1)
      if (!scrollToSlide(element, next, axis, reduced ? 'auto' : 'smooth')) return
      indexRef.current = next
      // Move the correction baseline with us, so a settled glide is never
      // mistaken for momentum that overshot.
      touchStartIndex.current = next
      lockUntilRef.current = Date.now() + (reduced ? 0 : GLIDE_MS)
    }

    /**
     * A smooth glide cut short by the next gesture can stop between snap
     * positions, and a mandatory snap container does not reliably pull it back
     * once the scroll has ended. Settle it exactly onto the slide we chose.
     */
    const offBy = () => {
      const expected = slideScrollOffset(element, indexRef.current, axis)
      return expected === null ? 0 : scrollOffset(element, axis) - expected
    }

    const alignExactly = () => {
      if (Math.abs(offBy()) <= 2) return
      scrollToSlide(element, indexRef.current, axis, reduced ? 'auto' : 'smooth')
      // The glide itself can come to rest a few pixels out, so check once it
      // should have finished and place it exactly. By then the movement is
      // small enough that setting it outright is not visible.
      window.clearTimeout(alignTimer.current)
      alignTimer.current = window.setTimeout(() => {
        if (lockedRef.current || Math.abs(offBy()) <= 2) return
        scrollToSlide(element, indexRef.current, axis, 'auto')
      }, 520)
    }

    /** Re-armed by every event in a burst, so momentum never queues a second jump. */
    const holdLock = () => {
      lockedRef.current = true
      window.clearTimeout(releaseTimer.current)
      const wait = Math.max(QUIET_MS, lockUntilRef.current - Date.now())
      releaseTimer.current = window.setTimeout(() => {
        lockedRef.current = false
        alignExactly()
      }, wait)
    }

    const onWheel = (event: WheelEvent) => {
      // Most mice have no horizontal wheel, so a sideways deck also accepts
      // vertical intent; its page does not scroll behind it anyway.
      const along = vertical
        ? event.deltaY
        : Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      // A mostly-sideways gesture over the vertical reel is not meant for it.
      if (vertical && Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      event.preventDefault()
      if (lockedRef.current) { holdLock(); return }
      if (Math.abs(along) < WHEEL_THRESHOLD) return
      // In Arabic the deck runs right to left, so the next card sits the other
      // way and the same physical gesture has to mean the opposite step.
      const forward = !vertical && rtl ? along < 0 : along > 0
      // Step from where the deck actually is, not from a remembered index: the
      // observed one can lag or report a transient value while the layout
      // changes, such as when the menu flips to Arabic.
      goTo(currentIndex() + (forward ? 1 : -1))
      holdLock()
    }

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      touchOrigin.current = vertical ? touch.clientY : touch.clientX
      touchStartIndex.current = currentIndex()
      touchDriven.current = true
    }

    const onTouchEnd = (event: TouchEvent) => {
      const origin = touchOrigin.current
      touchOrigin.current = null
      if (origin === null || lockedRef.current) return
      const touch = event.changedTouches[0]
      if (!touch) return
      const travel = (vertical ? touch.clientY : touch.clientX) - origin
      // Native scrolling handles the move itself; this only catches a flick
      // that was too small to scroll but clearly meant to advance.
      if (Math.abs(travel) < SWIPE_THRESHOLD) return
      if (currentIndex() !== touchStartIndex.current) return
      const forward = !vertical && rtl ? travel > 0 : travel < 0
      goTo(touchStartIndex.current + (forward ? 1 : -1))
      holdLock()
    }

    const onScroll = () => {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(() => {
        // Ignore our own glide, and anything still under a finger.
        if (lockedRef.current || touchOrigin.current !== null) return
        const landed = currentIndex()
        const from = touchStartIndex.current
        // Only a real finger flick can overshoot; a wheel gesture was already
        // placed exactly, so correcting it here would drag it back a slide.
        if (touchDriven.current && Math.abs(landed - from) > 1) {
          touchDriven.current = false
          goTo(from + Math.sign(landed - from))
          holdLock()
          return
        }
        touchDriven.current = false
        indexRef.current = landed
        touchStartIndex.current = landed
      }, SETTLE_MS)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      const forward = vertical
        ? ['ArrowDown', 'PageDown']
        : [rtl ? 'ArrowLeft' : 'ArrowRight']
      const backward = vertical
        ? ['ArrowUp', 'PageUp']
        : [rtl ? 'ArrowRight' : 'ArrowLeft']

      const direction = forward.includes(event.key) ? 1 : backward.includes(event.key) ? -1 : 0
      if (!direction) return
      event.preventDefault()
      if (lockedRef.current) return
      goTo(currentIndex() + direction)
      holdLock()
    }

    // preventDefault only works on a non-passive wheel listener.
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchend', onTouchEnd, { passive: true })
    element.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchend', onTouchEnd)
      element.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(releaseTimer.current)
      window.clearTimeout(settleTimer.current)
      window.clearTimeout(alignTimer.current)
    }
  }, [container, axis, count, rtl])
}
