import { Instagram, MapPin, MessageCircle, Utensils } from 'lucide-react'
import { PageFlip } from 'page-flip'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MenuItem } from '../../lib/types'
import type { MenuTemplateProps } from '../types'
import styles from './Book.module.css'

/** Printed-menu proportions: taller than wide. */
const PAGE_RATIO = 0.7
const MAX_PAGE_HEIGHT = 640
/** Roughly what one dish row occupies, and what the masthead and folio take. */
const ROW_HEIGHT = 84
const PAGE_FURNITURE = 118
const MIN_ROWS = 3
const MAX_ROWS = 6

interface Size { width: number; height: number }

/** How many dishes a page of this height can print without crowding. */
function rowsPerPage(pageHeight: number) {
  const fits = Math.floor((pageHeight - PAGE_FURNITURE) / ROW_HEIGHT)
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, fits))
}

function chunk<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = []
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage))
  }
  return pages
}

/**
 * Largest page the stage can hold at PAGE_RATIO. The library needs real pixel
 * dimensions up front; its 'stretch' mode derives them from the parent's width
 * alone, which on a tall phone produced a book taller than the room for it.
 */
function fitPage(stageWidth: number, stageHeight: number): Size {
  let height = Math.min(stageHeight, MAX_PAGE_HEIGHT)
  let width = height * PAGE_RATIO
  if (width > stageWidth) {
    width = stageWidth
    height = width / PAGE_RATIO
  }
  return { width: Math.max(Math.round(width), 1), height: Math.max(Math.round(height), 1) }
}

function MenuPage({ items, firstIndex, pageNumber, pageTotal, category, rtl, t, formatPrice }: {
  items: MenuItem[]
  /** Position of this page's first dish in the category, for the masthead. */
  firstIndex: number
  pageNumber: number
  pageTotal: number
  category: string
  rtl: boolean
  t: MenuTemplateProps['t']
  formatPrice: MenuTemplateProps['formatPrice']
}) {
  return (
    <div className={styles.page}>
      <div className={styles.pageContent} dir={rtl ? 'rtl' : 'ltr'}>
        <div className={styles.pageHeader}>
          <span className={styles.categoryLabel}>{category}</span>
          <span className={styles.pageNumber}>{String(firstIndex + 1).padStart(2, '0')}</span>
        </div>

        <div className={styles.list}>
          {items.map((item) => {
            const name = t(item.name_en, item.name_ar)
            const description = t(item.description_en ?? '', item.description_ar ?? '')
            const variants = item.variants ?? []
            // With several dishes to a page there is no room for size buttons,
            // so the sizes are printed the way a paper menu prints them.
            const headline = variants.length > 0 ? variants[0].price_lbp : item.price_lbp

            return (
              <div
                key={item.id}
                className={`${styles.entry} ${item.available ? '' : styles.entryUnavailable}`}
              >
                <div className={styles.thumb}>
                  {item.image_url
                    ? <img src={item.image_url} alt="" loading="lazy" />
                    : <div className={styles.thumbEmpty}>{name.slice(0, 1).toUpperCase()}</div>}
                </div>

                <div className={styles.entryMain}>
                  <div className={styles.entryTop}>
                    <span className={styles.entryName}>{name}</span>
                    <span className={styles.leader} aria-hidden="true" />
                    {item.available
                      ? <span className={styles.entryPrice}>{formatPrice(headline)}</span>
                      : <span className={styles.entrySoldOut}>{t('Sold out', 'نفد')}</span>}
                  </div>

                  {description && <p className={styles.entryDesc}>{description}</p>}

                  {item.available && variants.length > 1 && (
                    <span className={styles.entryVariants}>
                      {variants.map((choice, position) => (
                        <span key={choice.id ?? position}>
                          {position > 0 && '  ·  '}
                          <b>{t(choice.name_en, choice.name_ar)}</b> {formatPrice(choice.price_lbp)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.folio}>{t(`Page ${pageNumber} of ${pageTotal}`, `صفحة ${pageNumber} من ${pageTotal}`)}</div>
      </div>
    </div>
  )
}

/** One printed leaf: a page of dishes, or the closing leaf. */
interface Leaf {
  kind: 'menu' | 'end'
  categoryId: string
  items: MenuItem[]
  /** Position within its own section, so the folio reads like a printed menu. */
  pageNumber: number
  pageTotal: number
  firstIndex: number
}

export default function BookTemplate(props: MenuTemplateProps) {
  const { restaurant, categories, items, activeCategory, setActiveCategory, language, setLanguage, rtl, theme, t, formatPrice } = props

  const stageRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const [size, setSize] = useState<Size | null>(null)

  const perPage = size ? rowsPerPage(size.height) : 0

  /* Every section is bound into the same book, so running out of pages in one
     category simply turns into the next — the way a printed menu reads. This
     is the one template that ignores `visibleItems`: the container filters to
     the active category, and a book that only ever held one section would
     dead-end at its own last page. */
  const leaves: Leaf[] = []
  if (perPage > 0) {
    for (const category of categories) {
      const dishes = items.filter((item) => item.category_id === category.id)
      if (!dishes.length) continue
      const pages = chunk(dishes, perPage)
      pages.forEach((pageItems, pageIndex) => {
        leaves.push({
          kind: 'menu',
          categoryId: category.id,
          items: pageItems,
          pageNumber: pageIndex + 1,
          pageTotal: pages.length,
          firstIndex: pageIndex * perPage,
        })
      })
    }
    if (leaves.length) {
      leaves.push({ kind: 'end', categoryId: '', items: [], pageNumber: 0, pageTotal: 0, firstIndex: 0 })
    }
  }

  const leafCount = leaves.length
  const lastLeaf = Math.max(leafCount - 1, 0)

  const [openLeaf, setOpenLeaf] = useState(0)
  const leaf = Math.min(openLeaf, lastLeaf)
  const [turnedOnce, setTurnedOnce] = useState(false)

  /* Arabic lays the leaves out backwards and borrows the library's "previous"
     as our "next" — see the note on the flip setup below. */
  const toLibrary = useCallback((leafIndex: number) => (rtl ? lastLeaf - leafIndex : leafIndex), [rtl, lastLeaf])

  const leafRef = useRef(leaf)
  leafRef.current = leaf
  const leavesRef = useRef(leaves)
  leavesRef.current = leaves
  const lastLeafRef = useRef(lastLeaf)
  lastLeafRef.current = lastLeaf
  const rtlRef = useRef(rtl)
  rtlRef.current = rtl

  /* Which section the book last reported. Chip taps arrive as a change to
     `activeCategory`, and turning pages pushes the other way; this tells the
     two apart so they do not chase each other. */
  const reportedCategory = useRef(activeCategory)
  const setActiveCategoryRef = useRef(setActiveCategory)
  setActiveCategoryRef.current = setActiveCategory

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const box = stage.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) {
        const next = fitPage(box.width, box.height)
        // Ignore sub-pixel churn; every change here rebuilds the book.
        setSize((current) =>
          current && Math.abs(current.width - next.width) < 2 && Math.abs(current.height - next.height) < 2
            ? current
            : next)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  /* Rebuilt only when the set of leaves genuinely changes. `activeCategory` is
     deliberately absent: with one continuous book, changing section is a page
     turn, not a new book. */
  const structureKey = [perPage, rtl ? 'rtl' : 'ltr', language, leafCount].join('|')

  /* A layout effect, not a passive one: the cleanup has to hand the page nodes
     back before React unmounts the host, and only this phase guarantees that
     ordering. */
  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || !leafCount || !size) return
    const pages = Array.from(frame.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains(styles.page),
    )
    if (!pages.length) return

    /* PageFlip.destroy() calls remove() on the very element it was handed, so
       it cannot be given a node React rendered — one resize would delete
       React's DOM permanently and the book would never come back. It gets a
       plain div created here instead, which it is free to destroy. */
    const engine = document.createElement('div')
    engine.className = styles.engine
    frame.appendChild(engine)
    pages.forEach((node) => engine.appendChild(node))

    const flip = new PageFlip(engine, {
      width: size.width,
      height: size.height,
      size: 'fixed',
      startPage: rtl ? lastLeaf - leafRef.current : leafRef.current,
      showCover: false,
      usePortrait: true,
      useMouseEvents: true,
      drawShadow: true,
      maxShadowOpacity: 0.5,
      flippingTime: 750,
      swipeDistance: 24,
      showPageCorners: true,
      // Lets a tap reach the variant buttons instead of starting a flip.
      clickEventForward: true,
      /* The library's default, and the better-trodden path: it waits for ~10px
         of travel before it starts folding, instead of folding on every single
         touchmove. Turning it off made a flick intermittently get swallowed,
         and nothing here scrolls, so there is nothing to gain by disabling it. */
      mobileScrollSupport: true,
    })

    flip.loadFromHTML(pages)
    flip.on('flip', (event) => {
      const libraryIndex = Number(event.data)
      const index = rtlRef.current ? lastLeafRef.current - libraryIndex : libraryIndex
      setOpenLeaf(index)
      setTurnedOnce(true)
      // Turning into a new section moves the chips with you.
      const landed = leavesRef.current[index]
      if (landed?.kind === 'menu' && landed.categoryId !== reportedCategory.current) {
        reportedCategory.current = landed.categoryId
        setActiveCategoryRef.current(landed.categoryId)
      }
    })
    flipRef.current = flip

    return () => {
      flip.destroy()
      engine.remove()
      // The pages went with the engine, so hand them back to the element React
      // still believes owns them before it tries to reconcile.
      pages.forEach((node) => frame.appendChild(node))
      flipRef.current = null
    }
    // `leaf` is seeded through leafRef on purpose: listing it here would
    // rebuild the whole book on every single turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey, size, lastLeaf, rtl])

  /* A chip tap turns to that section rather than rebuilding the book. */
  useEffect(() => {
    if (activeCategory === reportedCategory.current) return
    const target = leaves.findIndex((entry) => entry.kind === 'menu' && entry.categoryId === activeCategory)
    if (target < 0 || !flipRef.current) return
    reportedCategory.current = activeCategory
    flipRef.current.turnToPage(toLibrary(target))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, structureKey])

  const instagramHandle = restaurant.instagram?.replace(/^@/, '')
  const address = t(restaurant.address_en ?? '', restaurant.address_ar ?? '')
  /** Printed leaves only — the closing leaf is not part of the count. */
  const menuLeafCount = Math.max(leafCount - 1, 0)

  const nameOf = (categoryId: string) => {
    const entry = categories.find((category) => category.id === categoryId)
    return t(entry?.name_en ?? '', entry?.name_ar ?? '')
  }

  const menuPages = leaves
    .filter((entry) => entry.kind === 'menu')
    .map((entry) => (
      <MenuPage
        key={entry.items[0]?.id ?? `${entry.categoryId}-${entry.pageNumber}`}
        items={entry.items}
        firstIndex={entry.firstIndex}
        pageNumber={entry.pageNumber}
        pageTotal={entry.pageTotal}
        category={nameOf(entry.categoryId)}
        rtl={rtl}
        t={t}
        formatPrice={formatPrice}
      />
    ))

  const endPage = (
    <div className={`${styles.page} ${styles.endPage}`} key="__end">
      <div className={styles.pageContent} dir={rtl ? 'rtl' : 'ltr'}>
        <div className={styles.endMark}>
          {restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <Utensils />}
        </div>
        <h2 className={styles.endTitle}>{t('Thank you', 'شكراً لكم')}</h2>
        <p className={styles.endCopy}>
          {t(restaurant.description_en ?? 'We hope you enjoy your meal.', restaurant.description_ar ?? 'نتمنى لكم وجبة شهية.')}
        </p>
      </div>
    </div>
  )

  const rendered = leafCount ? [...menuPages, endPage] : []
  const onLastLeaf = leafCount > 0 && leaf === lastLeaf

  return (
    <main
      className={styles.root}
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        '--book-brand': theme.brand,
        '--book-desk': theme.brandStrong,
        '--book-ink': '#2c2519',
        '--book-glow': theme.alpha(0.16),
      } as React.CSSProperties}
    >
      <header className={styles.header}>
        <div className={styles.brand}>
          {restaurant.logo_url
            ? <img className={styles.logo} src={restaurant.logo_url} alt="" />
            : <div className={styles.monogram}>{restaurant.name_en.slice(0, 1).toUpperCase()}</div>}
          <span className={styles.venue}>
            <span className={styles.venueName}>{t(restaurant.name_en, restaurant.name_ar)}</span>
            <span className={styles.venueSub}>{t('The menu', 'القائمة')}</span>
          </span>
        </div>
        <div className={styles.langToggle}>
          <button type="button" className={language === 'en' ? styles.langActive : ''} onClick={() => setLanguage('en')}>EN</button>
          <button type="button" className={language === 'ar' ? styles.langActive : ''} onClick={() => setLanguage('ar')}>ع</button>
        </div>
      </header>

      <nav className={styles.chips} data-menu-bar>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`${styles.chip} ${activeCategory === category.id ? styles.chipActive : ''}`}
            onClick={() => setActiveCategory(category.id)}
          >
            {t(category.name_en, category.name_ar)}
          </button>
        ))}
      </nav>

      {restaurant.temporarily_closed && (
        <div className={styles.closed}>{t('The restaurant is temporarily closed', 'المطعم مغلق مؤقتاً')}</div>
      )}

      <div className={styles.stage} ref={stageRef}>
        {leafCount && size
          ? (
            <div
              className={styles.bookFrame}
              ref={frameRef}
              /* Remounting on these rebuilds the leaf set from scratch, so React
                 never has to reconcile children the library has re-parented. */
              key={structureKey}
              style={{ width: size.width, height: size.height }}
            >
              {rtl ? [...rendered].reverse() : rendered}
            </div>
          )
          : <p className={styles.empty}>{t('No items found here.', 'لا توجد أصناف هنا.')}</p>}
      </div>

      {leafCount > 0 && (
        <>
          <div className={styles.controls}>
            <div className={styles.pageProgress}>
              <span className={styles.pageRange}>
                {onLastLeaf ? t('End', 'النهاية') : `${leaf + 1} / ${menuLeafCount}`}
              </span>
              <div className={styles.rail}>
                <div className={styles.railFill} style={{ width: `${((leaf + 1) / leafCount) * 100}%` }} />
              </div>
            </div>
          </div>
          <p className={styles.hint}>
            {turnedOnce || leafCount < 2
              ? ' '
              : t('Drag a corner to turn the page', 'اسحب الزاوية لتقليب الصفحة')}
          </p>
        </>
      )}

      <div className={styles.status} role="status" aria-live="polite">
        {onLastLeaf
          ? t('End of menu', 'نهاية القائمة')
          : t(
            `${nameOf(leaves[leaf]?.categoryId ?? '')}, page ${leaf + 1} of ${menuLeafCount}`,
            `${nameOf(leaves[leaf]?.categoryId ?? '')}، صفحة ${leaf + 1} من ${menuLeafCount}`,
          )}
      </div>

      <footer className={styles.footer}>
        <div className={styles.contact}>
          {restaurant.whatsapp && (
            <a href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              <MessageCircle /> {t('Message us', 'راسلنا')}
            </a>
          )}
          {address && (
            restaurant.maps_url
              ? <a href={restaurant.maps_url} target="_blank" rel="noreferrer"><MapPin /> {address}</a>
              : <span><MapPin /> {address}</span>
          )}
          {restaurant.instagram && (
            <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noreferrer">
              <Instagram /> {restaurant.instagram}
            </a>
          )}
        </div>
        <span className={styles.mark}>Menu by <b>fluxiva</b></span>
      </footer>
    </main>
  )
}
