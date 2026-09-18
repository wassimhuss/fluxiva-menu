import { lazy } from 'react'
import type { MenuTemplate, TemplateMeta } from './types'

/**
 * Every template is code-split. A diner downloads only the one their restaurant
 * uses, so adding templates never slows down the public menu.
 */
export const TEMPLATES: TemplateMeta[] = [
  { id: 'classic', name: 'Classic', description: 'Warm, calm and photo-led. The original Fluxiva menu.', tags: ['bakery', 'cafe', 'all-purpose'] },
  { id: 'noir', name: 'Noir', description: 'Dark, elegant typography with dotted price leaders.', tags: ['fine-dining', 'steakhouse', 'evening'] },
  { id: 'aurora', name: 'Aurora', description: 'Frosted glass cards over a slow-drifting colour wash.', tags: ['cafe', 'juice-bar', 'modern'] },
  { id: 'kiosk', name: 'Kiosk', description: 'Big photography and bold prices, built for fast service.', tags: ['fast-food', 'pizza', 'street-food'] },
]

export const DEFAULT_TEMPLATE = 'classic'

export const templateComponents: Record<string, MenuTemplate> = {
  classic: lazy(() => import('./Classic')),
  noir: lazy(() => import('./Noir')),
  aurora: lazy(() => import('./Aurora')),
  kiosk: lazy(() => import('./Kiosk')),
}

/** Falls back to the default template for unknown or missing ids. */
export function resolveTemplateId(id?: string | null) {
  return id && id in templateComponents ? id : DEFAULT_TEMPLATE
}
