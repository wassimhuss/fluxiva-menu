import { useEffect, useState } from 'react'

/**
 * Waits for a small set of images before the menu is revealed, so the first
 * screen arrives complete instead of assembling itself photo by photo.
 *
 * Deliberately not every image on the menu. A large menu is dozens of photos,
 * and on mobile data that would mean a blank screen for many seconds while
 * someone stands at a table waiting — worse than the pop-in it fixes. Only the
 * images that land above the fold are worth waiting for; the rest stream in
 * lazily as the customer scrolls.
 */

/** Never hold the menu back longer than this, however slow the network is. */
const MAX_WAIT_MS = 2500

/**
 * Resolves once the image is decoded and ready to paint — or immediately on
 * failure, because a broken photo must never stop the menu from opening.
 */
function preload(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    const done = () => resolve()
    // decode() finishes the work that would otherwise hitch on first paint.
    image.onload = () => { (image.decode?.() ?? Promise.resolve()).then(done, done) }
    image.onerror = done
    image.src = src
  })
}

/** A newline cannot appear in a URL, so it is safe to join and split on. */
const SEPARATOR = '\n'

export function useImagePreload(urls: (string | undefined)[], timeoutMs = MAX_WAIT_MS) {
  // Join into a primitive so the effect is not re-run by a new array identity.
  const key = urls.filter(Boolean).join(SEPARATOR)
  /** The set of images last finished with, compared against the current one. */
  const [readyKey, setReadyKey] = useState<string | null>(null)

  /**
   * Derived, not a stored boolean. A boolean set inside the effect stays true
   * for one committed render after the list changes, and React can paint that
   * frame — so the menu appeared once with its images still loading before
   * snapping back to the loader, which is the flash this hook exists to stop.
   */
  const ready = key === '' || readyKey === key

  useEffect(() => {
    const list = key ? key.split(SEPARATOR) : []
    if (!list.length) return

    let cancelled = false
    const finish = () => { if (!cancelled) setReadyKey(key) }

    const timer = window.setTimeout(finish, timeoutMs)
    Promise.all(list.map(preload)).then(finish, finish).finally(() => window.clearTimeout(timer))

    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [key, timeoutMs])

  return ready
}
