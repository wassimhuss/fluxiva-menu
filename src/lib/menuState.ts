import type { MenuItem, RestaurantMenu } from './types'

/** Merge only this action's fields, retaining other saves and the active branch. */
export function patchMenuItem(menu: RestaurantMenu | null, restaurantId: string, itemId: string, patch: Partial<MenuItem>): RestaurantMenu | null {
  if (!menu || menu.restaurant.id !== restaurantId) return menu
  return { ...menu, items: menu.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) }
}
