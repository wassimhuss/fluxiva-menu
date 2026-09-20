import { useEffect, useState } from 'react'

/**
 * The index the caption should describe, held back until the deck stops.
 *
 * A flick carries the deck past several cards, and the caption is keyed on the
 * dish, so every card it passed remounted the caption and replayed its
 * entrance animation — the name visibly strobed through three or four dishes
 * before landing on the right one. The blurred backdrop is worse: it
 * rasterises a layer per dish, so the intermediate ones cost real work nobody
 * ever sees.
 *
 * The progress counter and rail deliberately keep following the live index;
 * they are the feedback that the deck is moving, while this is the detail that
 * only makes sense once it has arrived.
 */
const SETTLE_MS = 140

export function useSettledIndex(active: number, container: HTMLElement | null, resetKey: string) {
  const [committed, setCommitted] = useState({ key: resetKey, index: active })

  /* Falling through to `active` whenever the key changes means a category
     switch shows the new first dish in the same render, rather than the
     previous category's dish for the length of the settle window. */
  const settled = committed.key === resetKey ? committed.index : active

  useEffect(() => {
    if (!container) {
      setCommitted({ key: resetKey, index: active })
      return
    }

    let timer = 0
    const commit = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setCommitted({ key: resetKey, index: active }), SETTLE_MS)
    }

    commit()
    // Every scroll event pushes the commit back, so it lands once and only
    // once the deck has actually come to rest.
    container.addEventListener('scroll', commit, { passive: true })
    return () => {
      window.clearTimeout(timer)
      container.removeEventListener('scroll', commit)
    }
  }, [active, container, resetKey])

  return settled
}
