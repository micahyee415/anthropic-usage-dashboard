import { estimateCost } from './pricing'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrgConfig {
  id: 'org-primary' | 'org-secondary'
  label: string
  adminKey: string
}

export interface ApiKey {
  id: string
  name: string
  status: string
  workspace: string | null
  created: string
}

export interface KeyUsageSummary {
  keyId: string
  keyName: string
  org: string
  workspace: string | null
  // token totals across all models in the date range
  uncachedInput: number
  cacheCreation: number
  cacheRead: number
  output: number
  totalTokens: number
  estimatedCost: number   // calculated from tokens × pricing rates
  actualCost?: number     // actual billed cost from cost_report API (if available)
  lastActive: string | null  // YYYY-MM-DD of most recent day with any usage
  modelBreakdown: ModelUsage[]
}

export interface ModelUsage {
  model: string
  uncachedInput: number
  cacheCreation: number
  cacheRead: number
  output: number
  estimatedCost: number
}

export interface DailyOrgCost {
  date: string   // YYYY-MM-DD
  amount: number // USD from Anthropic cost report (actual billing)
}

export interface DailyModelCost {
  date: string   // YYYY-MM-DD
  model: string
  amount: number // USD actual billing
}

// ── Org configs ──────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  if (!value.startsWith('sk-ant-admin01-')) {
    throw new Error(`${name} does not look like an Anthropic Admin API key`)
  }
  return value
}

export function getOrgs(): OrgConfig[] {
  return [
    {
      id: 'org-primary',
      label: 'Example Corp',
      adminKey: requireEnv('ORG_PRIMARY_ADMIN_KEY'),
    },
    {
      id: 'org-secondary',
      label: 'Example Corp Developer',
      adminKey: requireEnv('ORG_SECONDARY_ADMIN_KEY'),
    },
  ]
}

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = 'https://api.anthropic.com/v1'
const VERSION = '2023-06-01'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function apiFetch(adminKey: string, path: string, attempt = 0): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'anthropic-version': VERSION, 'x-api-key': adminKey },
    next: { revalidate: 300 },
  })

  // On 429, wait what Anthropic tells us, then retry (up to 3 attempts: 1s, 2s, 4s)
  if (res.status === 429 && attempt < 3) {
    const retryAfter = parseInt(res.headers.get('retry-after') ?? '0')
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt)
    await sleep(waitMs)
    return apiFetch(adminKey, path, attempt + 1)
  }

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
  return res.json()
}

// Paginate through all pages of a list endpoint.
// A 500ms pause between pages keeps us well under Anthropic's rate limit
// when fetching large date ranges that span many pages.
async function fetchAllPages<T>(
  adminKey: string,
  basePath: string,
  extractItems: (body: unknown) => T[],
  extractNextPage: (body: unknown) => string | null
): Promise<T[]> {
  const all: T[] = []
  let pageParam = ''
  while (true) {
    const url = pageParam ? `${basePath}&page=${pageParam}` : basePath
    const body = await apiFetch(adminKey, url)
    all.push(...extractItems(body))
    const next = extractNextPage(body)
    if (!next) break
    pageParam = next
    await sleep(500) // avoid rate limiting on multi-page fetches
  }
  return all
}

// ── Public data fetchers ──────────────────────────────────────────────────────

/** Fetch all API keys for an org with their names and workspace assignments */
export async function fetchApiKeys(adminKey: string): Promise<ApiKey[]> {
  const body = await apiFetch(adminKey, '/organizations/api_keys?limit=100') as {
    data: Array<{ id: string; name: string; status: string; workspace_id: string | null; created_at: string }>
  }
  return body.data
    .filter(k => k.status === 'active')
    .map(k => ({
      id: k.id,
      name: k.name,
      status: k.status,
      workspace: k.workspace_id,
      created: k.created_at,
    }))
}

/** Fetch token usage per API key over a date range, return per-key summaries */
export async function fetchKeyUsage(
  adminKey: string,
  orgLabel: string,
  startingAt: string,
  endingAt: string,
  keyNames: Record<string, { name: string; workspace: string | null }>
): Promise<KeyUsageSummary[]> {
  type UsageResult = {
    api_key_id: string | null
    model: string
    uncached_input_tokens: number
    cache_creation: { ephemeral_5m_input_tokens: number }
    cache_read_input_tokens: number
    output_tokens: number
  }
  type DayBucket = { starting_at: string; results: UsageResult[] }

  const basePath =
    `/organizations/usage_report/messages?starting_at=${startingAt}&ending_at=${endingAt}` +
    `&group_by[]=api_key_id&group_by[]=model&bucket_width=1d`

  const days = await fetchAllPages<DayBucket>(
    adminKey,
    basePath,
    (b: unknown) => (b as { data: DayBucket[] }).data,
    (b: unknown) => (b as { next_page: string | null }).next_page
  )

  // Aggregate per key across all days
  const byKey = new Map<string, { models: Map<string, ModelUsage>; workspace: string | null; name: string; lastActive: string | null }>()

  for (const day of days) {
    const dayDate = day.starting_at.split('T')[0]
    for (const r of day.results) {
      const keyId = r.api_key_id ?? 'unassigned'
      const info = keyNames[keyId] ?? { name: keyId, workspace: null }

      if (!byKey.has(keyId)) {
        byKey.set(keyId, { models: new Map(), workspace: info.workspace, name: info.name, lastActive: null })
      }

      const keyEntry = byKey.get(keyId)!
      // Track the most recent day this key had usage
      if (!keyEntry.lastActive || dayDate > keyEntry.lastActive) {
        keyEntry.lastActive = dayDate
      }
      const cacheCreation = r.cache_creation?.ephemeral_5m_input_tokens ?? 0

      if (!keyEntry.models.has(r.model)) {
        keyEntry.models.set(r.model, {
          model: r.model,
          uncachedInput: 0, cacheCreation: 0, cacheRead: 0, output: 0, estimatedCost: 0,
        })
      }

      const m = keyEntry.models.get(r.model)!
      m.uncachedInput  += r.uncached_input_tokens
      m.cacheCreation  += cacheCreation
      m.cacheRead      += r.cache_read_input_tokens
      m.output         += r.output_tokens
      m.estimatedCost  += estimateCost(r.model, r.uncached_input_tokens, cacheCreation, r.cache_read_input_tokens, r.output_tokens)
    }
  }

  // Add zero-usage rows for active keys that had no usage in this period
  for (const [keyId, info] of Object.entries(keyNames)) {
    if (!byKey.has(keyId)) {
      byKey.set(keyId, { models: new Map(), workspace: info.workspace, name: info.name, lastActive: null })
    }
  }

  // Convert to array, sort by total tokens descending (zero-usage keys sink to bottom)
  return Array.from(byKey.entries()).map(([keyId, entry]) => {
    const modelBreakdown = Array.from(entry.models.values())
    const totals = modelBreakdown.reduce(
      (acc, m) => ({
        uncachedInput: acc.uncachedInput + m.uncachedInput,
        cacheCreation: acc.cacheCreation + m.cacheCreation,
        cacheRead:     acc.cacheRead     + m.cacheRead,
        output:        acc.output        + m.output,
        estimatedCost: acc.estimatedCost + m.estimatedCost,
      }),
      { uncachedInput: 0, cacheCreation: 0, cacheRead: 0, output: 0, estimatedCost: 0 }
    )
    return {
      keyId,
      keyName: entry.name,
      org: orgLabel,
      workspace: entry.workspace,
      ...totals,
      totalTokens: totals.uncachedInput + totals.cacheCreation + totals.cacheRead + totals.output,
      lastActive: entry.lastActive,
      modelBreakdown,
    }
  }).sort((a, b) => b.totalTokens - a.totalTokens)
}

/** Fetch daily cost totals from the official billing cost report */
export async function fetchDailyCosts(
  adminKey: string,
  startingAt: string,
  endingAt: string
): Promise<DailyOrgCost[]> {
  type CostDay = { starting_at: string; results: Array<{ amount: string | null }> }

  const basePath =
    `/organizations/cost_report?starting_at=${startingAt}&ending_at=${endingAt}&bucket_width=1d`

  const days = await fetchAllPages<CostDay>(
    adminKey,
    basePath,
    (b: unknown) => (b as { data: CostDay[] }).data,
    (b: unknown) => (b as { next_page: string | null }).next_page
  )

  return days.map(d => ({
    date: d.starting_at.split('T')[0],
    amount: (parseFloat(d.results[0]?.amount ?? '0') || 0) / 100,
  }))
}

/**
 * Fetch daily actual billed costs broken down by model.
 * Returns [] if the API doesn't support group_by[]=model.
 */
export async function fetchDailyCostsByModel(
  adminKey: string,
  startingAt: string,
  endingAt: string
): Promise<DailyModelCost[]> {
  type CostRow = { model: string | null; amount: string | null }
  type CostDay = { starting_at: string; results: CostRow[] }

  try {
    const basePath =
      `/organizations/cost_report?starting_at=${startingAt}&ending_at=${endingAt}` +
      `&bucket_width=1d&group_by[]=model`

    const days = await fetchAllPages<CostDay>(
      adminKey,
      basePath,
      (b: unknown) => (b as { data: CostDay[] }).data,
      (b: unknown) => (b as { next_page: string | null }).next_page
    )

    const result: DailyModelCost[] = []
    for (const day of days) {
      for (const r of day.results) {
        if (!r.model) continue
        result.push({
          date:   day.starting_at.split('T')[0],
          model:  r.model,
          amount: (parseFloat(r.amount ?? '0') || 0) / 100,
        })
      }
    }
    return result
  } catch {
    return []
  }
}

/**
 * Fetch per-API-key actual billed costs from the cost_report endpoint.
 * Returns a map of keyId → actual billed amount (USD).
 * Returns an empty map if the API doesn't support this grouping.
 */
export async function fetchKeyCostsFromBilling(
  adminKey: string,
  startingAt: string,
  endingAt: string
): Promise<Record<string, number>> {
  type CostRow = { api_key_id: string | null; amount: string | null }
  type CostDay = { starting_at: string; results: CostRow[] }

  try {
    const basePath =
      `/organizations/cost_report?starting_at=${startingAt}&ending_at=${endingAt}` +
      `&bucket_width=1d&group_by[]=api_key_id`

    const days = await fetchAllPages<CostDay>(
      adminKey,
      basePath,
      (b: unknown) => (b as { data: CostDay[] }).data,
      (b: unknown) => (b as { next_page: string | null }).next_page
    )

    // Aggregate per key across all days (amounts in cents → convert to dollars)
    const totals: Record<string, number> = {}
    for (const day of days) {
      for (const r of day.results) {
        const keyId = r.api_key_id ?? 'unassigned'
        totals[keyId] = (totals[keyId] ?? 0) + ((parseFloat(r.amount ?? '0') || 0) / 100)
      }
    }
    return totals
  } catch {
    // If the API doesn't support group_by on cost_report, fail silently
    return {}
  }
}
