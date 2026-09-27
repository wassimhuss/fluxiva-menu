/**
 * Where a snap container has to be scrolled for the slide at `index` to sit
 * where it belongs — flush to the start for a vertical reel, centred for a
 * horizontal deck. Returns null when there is no such slide.
 *
 * Deliberately not derived from `getBoundingClientRect`, and deliberately not
 * driven by `scrollIntoView`: both work from an element's *rendered* box, which
 * includes its transform. A cover-flow deck rotates, scales and pushes back the
 * cards away from the centre, so the box they describe is not where the card
 * actually lives, and a jump lands on the wrong card.
 *
 * `offsetLeft`/`offsetTop`/`offsetWidth` are layout metrics and ignore
 * transforms. Slides and their container share an offset parent, so the common
 * origin cancels out, and the arithmetic holds in right-to-left too, where
 * `scrollLeft` simply runs negative.
 */
export function slideScrollOffset(container: HTMLElement, index: number, axis: 'x' | 'y') {
  const target = container.querySelector<HTMLElement>(`[data-slide="${index}"]`)
  if (!target) return null
  return axis === 'y'
    ? target.offsetTop - container.offsetTop
    : target.offsetLeft + target.offsetWidth / 2 - container.offsetLeft - container.clientWidth / 2
}

/**
 * Marks the container as being scrolled by a finger right now. A template can
 * hang `scroll-snap-stop: always` off this to arrest a hard flick at the very
 * next card, which is what the stop rule is for — but it also forbids *any*
 * scroll from crossing a snap position, so left on permanently it freezes the
 * arrows and every other jump. Set it for the gesture, clear it for our own.
 */
export const GESTURE_ATTRIBUTE = 'data-gesture'

/** Current scroll offset of the container along `axis`. */
export function scrollOffset(container: HTMLElement, axis: 'x' | 'y') {
  return axis === 'y' ? container.scrollTop : container.scrollLeft
}

export function scrollToSlide(
  container: HTMLElement,
  index: number,
  axis: 'x' | 'y',
  behavior: ScrollBehavior,
) {
  const offset = slideScrollOffset(container, index, axis)
  if (offset === null) return false
  // Scrolling from code is never a gesture, and a container still marked as
  // one would refuse to move past the card it is resting on.
  container.removeAttribute(GESTURE_ATTRIBUTE)
  container.scrollTo(axis === 'y' ? { top: offset, behavior } : { left: offset, behavior })
  return true
}
