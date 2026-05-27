import { unstable_cache } from 'next/cache'
import { fetchKeyUsage, fetchApiKeys, fetchDailyCosts, fetchKeyCostsFromBilling, OrgConfig } from './anthropic'

// Cache TTL scales with date range — longer ranges change less frequently
function getTTLSeconds(days: number): number {
  if (days <= 14)  return 300   // 5 min  — recent data changes often
  if (days <= 30)  return 900   // 15 min
  if (days <= 90)  return 1800  // 30 min
  return 3600                   // 1 hr   — yearly data barely changes
}

// Cache tags let us invalidate by org if needed in the future
function tags(orgId: string, type: string) {
  return [`anthropic`, `${orgId}`, `${type}`]
}

/**
 * Cached per-key token usage for one org.
 * unstable_cache persists across Vercel serverless invocations —
 * all users share the same cached result until TTL expires.
 */
export function getCachedKeyUsage(org: OrgConfig, startingAt: string, endingAt: string, days: number) {
  // Cache key uses only `days` (not the full timestamp) so all requests for the
  // same range share a single cached result instead of generating a new cache
  // entry every second.
  return unstable_cache(
    async () => {
      const keys = await fetchApiKeys(org.adminKey)
      const keyNames: Record<string, { name: string; workspace: string | null }> = {}
      for (const k of keys) keyNames[k.id] = { name: k.name, workspace: k.workspace }
      return fetchKeyUsage(org.adminKey, org.label, startingAt, endingAt, keyNames)
    },
    [`usage`, org.id, String(days)],
    { revalidate: getTTLSeconds(days), tags: tags(org.id, 'usage') }
  )()
}

/**
 * Cached daily cost report for one org.
 */
export function getCachedDailyCosts(org: OrgConfig, startingAt: string, endingAt: string, days: number) {
  return unstable_cache(
    async () => fetchDailyCosts(org.adminKey, startingAt, endingAt),
    [`cost`, org.id, String(days)],
    { revalidate: getTTLSeconds(days), tags: tags(org.id, 'cost') }
  )()
}

/**
 * Cached per-key actual billed costs from cost_report (keyId → USD).
 * Returns empty map if the API doesn't support per-key grouping.
 */
export function getCachedKeyCosts(org: OrgConfig, startingAt: string, endingAt: string, days: number) {
  return unstable_cache(
    async () => fetchKeyCostsFromBilling(org.adminKey, startingAt, endingAt),
    [`keycost`, org.id, String(days)],
    { revalidate: getTTLSeconds(days), tags: tags(org.id, 'keycost') }
  )()
}
