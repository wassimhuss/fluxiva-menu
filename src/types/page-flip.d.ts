/**
 * page-flip (StPageFlip) ships no type declarations and sets no `types` field,
 * so a bare import fails `tsc -b` with TS7016. This covers only the surface the
 * Book template actually uses — deliberately, so that reaching for an untyped
 * corner of the library is a compile error rather than an implicit `any`.
 */
declare module 'page-flip' {
  export interface FlipSetting {
    /** Page index to open on. */
    startPage: number
    /** 'fixed' uses width/height as given; 'stretch' fits the parent between the min/max bounds. */
    size: 'fixed' | 'stretch'
    width: number
    height: number
    minWidth: number
    maxWidth: number
    minHeight: number
    maxHeight: number
    drawShadow: boolean
    /** Duration of a released flip, in ms. */
    flippingTime: number
    /** Allow the single-page layout on narrow screens. */
    usePortrait: boolean
    startZIndex: number
    autoSize: boolean
    /** 0 hides shadows, 1 is full strength. */
    maxShadowOpacity: number
    /** Treat the outer pages as hard covers shown alone. */
    showCover: boolean
    mobileScrollSupport: boolean
    /** When true, clicks on <a> and <button> reach the element instead of starting a flip. */
    clickEventForward: boolean
    useMouseEvents: boolean
    swipeDistance: number
    showPageCorners: boolean
    disableFlipByClick: boolean
  }

  export interface WidgetEvent {
    /** For 'flip' this is the new page index. */
    data: number | string | boolean | object
    object: PageFlip
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSetting>)
    /** Takes elements already in the DOM and adopts them as pages. */
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    destroy(): void
    update(): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    turnToPage(page: number): void
    turnToNextPage(): void
    turnToPrevPage(): void
    getCurrentPageIndex(): number
    getPageCount(): number
    getOrientation(): 'portrait' | 'landscape'
    on(event: 'flip' | 'changeState' | 'changeOrientation' | 'init' | 'update', cb: (e: WidgetEvent) => void): PageFlip
    off(event: string): void
  }
}
