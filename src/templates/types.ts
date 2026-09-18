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
}

export type MenuTemplate = ComponentType<MenuTemplateProps>

export interface TemplateMeta {
  id: string
  name: string
  /** Shown to the restaurant owner when choosing a template. */
  description: string
  /** Cuisine or venue types this design suits, for filtering later. */
  tags: string[]
}
