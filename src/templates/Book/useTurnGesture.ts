import { useEffect, useRef } from 'react'

/**
 * Turning pages by wheel, swipe or keyboard.
 *
 * The book is not a scroll container — the pages are stacked and rotated — so
 * the snap machinery the other templates use does not apply. The rules are the
 * same though: one turn per gesture, and the burst of events a trackpad emits
 * after a flick must not queue up a second page.
 */

/** Roughly the turn animation; input is ignored while a page is in the air. */
const TURN_MS = 800
/** How quiet the input must go before another turn is accepted. */
const QUIET_MS = 160
const WHEEL_THRESHOLD = 8
const SWIPE_THRESHOLD = 40

interface TurnOptions {
  element: HTMLElement | null
  /** Called with +1 to turn forward through the book, -1 to go back. */
  onTurn: (direction: 1 | -1) => void
  /** In Arabic the book opens the other way, so the same swipe means the opposite page. */
  rtl?: boolean
  enabled?: boolean
}

export function useTurnGesture({ element, onTurn, rtl = false, enabled = true }: TurnOptions) {
  const lockedRef = useRef(false)
  const releaseRef = useRef<number | undefined>(undefined)
  const touchOrigin = useRef<number | null>(null)
  const onTurnRef = useRef(onTurn)
  onTurnRef.current = onTurn

  useEffect(() => {
    if (!element || !enabled) return

    /** Re-armed by every event in a burst, so momentum cannot turn twice. */
    const holdLock = (extra = 0) => {
      lockedRef.current = true
      window.clearTimeout(releaseRef.current)
      releaseRef.current = window.setTimeout(() => { lockedRef.current = false }, Math.max(QUIET_MS, extra))
    }

    const turn = (direction: 1 | -1) => {
      onTurnRef.current(direction)
      holdLock(TURN_MS)
    }

    const onWheel = (event: WheelEvent) => {
      // Most mice have no horizontal wheel, so vertical intent turns pages too;
      // nothing else on this screen scrolls.
      const along = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      event.preventDefault()
      if (lockedRef.current) { holdLock(); return }
      if (Math.abs(along) < WHEEL_THRESHOLD) return
      turn((rtl ? along < 0 : along > 0) ? 1 : -1)
    }

    const onTouchStart = (event: TouchEvent) => {
      touchOrigin.current = event.touches[0]?.clientX ?? null
    }

    const onTouchEnd = (event: TouchEvent) => {
      const origin = touchOrigin.current
      touchOrigin.current = null
      if (origin === null || lockedRef.current) return
      const travel = (event.changedTouches[0]?.clientX ?? origin) - origin
      if (Math.abs(travel) < SWIPE_THRESHOLD) return
      // Dragging the page towards the spine turns forward.
      turn((rtl ? travel > 0 : travel < 0) ? 1 : -1)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
      const back = rtl ? 'ArrowRight' : 'ArrowLeft'
      if (event.key !== forward && event.key !== back) return
      event.preventDefault()
      if (lockedRef.current) return
      turn(event.key === forward ? 1 : -1)
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(releaseRef.current)
    }
  }, [element, rtl, enabled])
}
