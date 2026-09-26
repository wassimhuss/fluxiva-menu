import type { ComponentType } from 'react'
import type { ThemeTokens } from '../lib/theme'
import type { Category, Language, MenuItem, Restaurant } from '../lib/types'

/**
 * The contract every menu template renders against.
 *
 * Templates are pure presentation: data loading, language state and category
 * state all live in PublicMenuPage, so a bug in that logic is fixed once rather
 * than once per template. Adding a field here means every template can use it;
 * removing one is a breaking change across all of them.
 */
export interface MenuTemplateProps {
  restaurant: Restaurant
  categories: Category[]
  /** Every item on the menu, regardless of the active category. */
  items: MenuItem[]
  /** Items belonging to the active category, in sort order. */
  visibleItems: MenuItem[]
  activeCategory: string
  setActiveCategory: (id: string) => void
  language: Language
  setLanguage: (language: Language) => void
  /** True when the menu is rendering right-to-left (Arabic). */
  rtl: boolean
  theme: ThemeTokens
  /** Picks the English or Arabic string for the current language. */
  t: (english: string, arabic: string) => string
  formatPrice: (value: number) => string
  /** Resolved cover photo URL, or an empty string when none is set. */
  coverUrl: string
  /** Present only when this restaurant takes takeaway orders. */
  ordering?: MenuOrdering
}

/**
 * Takeaway ordering, handed to templates that want an add control on a dish.
 *
 * Optional on purpose: the order button, the sheet and the WhatsApp message
 * all live in PublicMenuPage, so a template that ignores this still gives the
 * diner a complete way to order. A template opts in only to make adding a dish
 * feel native to its own design.
 */
export interface MenuOrdering {
  /** Units of this dish and size already in the order. */
  quantityOf: (itemId: string, variantIndex: number) => number
  add: (itemId: string, variantIndex: number) => void
  setQuantity: (itemId: string, variantIndex: number, quantity: number) => void
}

export type MenuTemplate = ComponentType<MenuTemplateProps>

export interface TemplateMeta {
  id: string
  name: string
  /** Shown to the restaurant owner when choosing a template. */
  description: string
  /** How the menu moves — templates differ as much in scroll feel as in looks. */
  scroll?: string
  /** Cuisine or venue types this design suits, for filtering later. */
  tags: string[]
  /** Hidden from the owner when food photos are disabled. */
  requiresItemImages?: boolean
}
