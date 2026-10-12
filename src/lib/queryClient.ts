import type { QueryClient } from '@tanstack/react-query'

let client: QueryClient | null = null
let pending: Promise<QueryClient> | null = null
let generation = 0

/** Keep the owner cache library out of the initial guest-menu bundle. */
export function getOwnerQueryClient(): Promise<QueryClient> {
  if (client) return Promise.resolve(client)
  pending ??= import('@tanstack/react-query').then(({ QueryClient }) => {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 5 * 60_000,
          retry: false, // Supabase already retries eligible reads.
          refetchOnWindowFocus: false, // Preserve the owner's form drafts.
        },
        mutations: { retry: false },
      },
    })
    return client
  })
  return pending
}

export const getCachedOwnerQueryClient = () => client
export const ownerCacheGeneration = () => generation

/** In-memory owner data only; public eligibility is checked on every open. */
export function clearOwnerCache() {
  generation += 1
  if (!client) return
  void client.cancelQueries()
  client.clear()
}
