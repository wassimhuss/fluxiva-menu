import { lazy } from 'react'
import type { MenuTemplate, TemplateMeta } from './types'

/**
 * Every template is code-split. A diner downloads only the one their restaurant
 * uses, so adding templates never slows down the public menu.
 */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Warm, calm and photo-led. The original Fluxiva menu.',
    scroll: 'Standard page scroll with category tabs',
    tags: ['bakery', 'cafe', 'all-purpose'],
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Dark, elegant typography with dotted price leaders.',
    scroll: 'Standard page scroll, two columns on desktop',
    tags: ['fine-dining', 'steakhouse', 'evening'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Frosted glass cards over a slow-drifting colour wash.',
    scroll: 'Standard page scroll with a card grid',
    tags: ['cafe', 'juice-bar', 'modern'],
    requiresItemImages: true,
  },
  {
    id: 'kiosk',
    name: 'Kiosk',
    description: 'Big photography and bold prices, built for fast service.',
    scroll: 'Standard page scroll with a card grid',
    tags: ['fast-food', 'pizza', 'street-food'],
    requiresItemImages: true,
  },
  {
    id: 'reel',
    name: 'Reel',
    description: 'One dish per screen, swiped like a short-video feed.',
    scroll: 'Full-screen vertical snap',
    tags: ['photo-led', 'social', 'dessert'],
    requiresItemImages: true,
  },
  {
    id: 'carousel',
    name: 'Carousel',
    description: 'A deck of dish cards flicked through sideways.',
    scroll: 'Horizontal snap deck',
    tags: ['small-menu', 'specials', 'cocktails'],
    requiresItemImages: true,
  },
  {
    id: 'story',
    name: 'Story',
    description: 'Photography holds still while the writing scrolls past it.',
    scroll: 'Scrollytelling with a sticky image pane',
    tags: ['fine-dining', 'tasting-menu', 'editorial'],
    requiresItemImages: true,
  },
]

export const DEFAULT_TEMPLATE = 'classic'

export const templateComponents: Record<string, MenuTemplate> = {
  classic: lazy(() => import('./Classic')),
  noir: lazy(() => import('./Noir')),
  aurora: lazy(() => import('./Aurora')),
  kiosk: lazy(() => import('./Kiosk')),
  reel: lazy(() => import('./Reel')),
  carousel: lazy(() => import('./Carousel')),
  story: lazy(() => import('./Story')),
}

/** Falls back to the default template for unknown or missing ids. */
export function resolveTemplateId(id?: string | null) {
  return id && id in templateComponents ? id : DEFAULT_TEMPLATE
}
