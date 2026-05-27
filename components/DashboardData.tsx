'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardShell from './DashboardShell'
import type { KeyUsageSummary, DailyOrgCost } from '@/lib/anthropic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgData {
  label: string
  total: number
  daily: DailyOrgCost[]
  usage: KeyUsageSummary[]
}

interface DashboardPayload {
  orgPrimary: OrgData
  orgSecondary: OrgData
  fetchedAt: string
}

// Typed error so the UI knows to show a countdown vs. a generic message
class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super('Rate limited')
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24">
            <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-32 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-72">
        <div className="h-4 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-56 bg-gray-100 rounded" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-4 w-64 bg-gray-200 rounded mb-5" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Countdown error state ─────────────────────────────────────────────────────

function RateLimitState({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(seconds)

  // Count down every second; auto-retry when it hits 0
  useEffect(() => {
    if (remaining <= 0) {
      onRetry()
      return
    }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining, onRetry])

  // Simple circular progress ring sized to wrap the number
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const progress = circumference - (remaining / seconds) * circumference

  return (
    <div className="max-w-7xl mx-auto px-8 py-20 flex flex-col items-center gap-4 text-center">
      {/* Countdown ring */}
      <div className="relative flex items-center justify-center w-16 h-16">
        <svg width="64" height="64" className="-rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="absolute text-sm font-semibold text-gray-700">{remaining}</span>
      </div>

      <p className="text-gray-700 font-medium">API rate limit reached</p>
      <p className="text-sm text-gray-400">
        Retrying automatically in {remaining}s — or{' '}
        <button
          onClick={onRetry}
          disabled={remaining > 0}
          className="text-indigo-600 hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed transition-colors"
        >
          retry now
        </button>
      </p>
    </div>
  )
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadData(days: number): Promise<DashboardPayload> {
  const usageRes = await fetch(`/api/usage?days=${days}`)
  const costRes = await fetch(`/api/cost?days=${days}`)

  if (usageRes.status === 429 || costRes.status === 429) {
    const limited = usageRes.status === 429 ? usageRes : costRes
    const retryAfter = parseInt(limited.headers.get('retry-after') ?? '30')
    throw new RateLimitError(isNaN(retryAfter) ? 30 : retryAfter)
  }

  if (!usageRes.ok || !costRes.ok) {
    throw new Error('Failed to load dashboard data. Please try again.')
  }

  const [usage, cost] = await Promise.all([usageRes.json(), costRes.json()])

  type CostOrg = { org: string; label: string; total?: number; daily?: DailyOrgCost[]; keyCosts?: Record<string, number> }
  type UsageOrg = { org: string; label: string; usage?: KeyUsageSummary[] }

  const findCostOrg = (data: { orgs: CostOrg[] }, id: string) => data.orgs.find(o => o.org === id)
  const findUsageOrg = (data: { orgs: UsageOrg[] }, id: string) => data.orgs.find(o => o.org === id)

  const gsUsage = findUsageOrg(usage, 'org-primary')
  const gdUsage = findUsageOrg(usage, 'org-secondary')
  const gsCost  = findCostOrg(cost,  'org-primary')
  const gdCost  = findCostOrg(cost,  'org-secondary')

  // Merge actual billed costs (from cost_report) into usage summaries.
  // If cost_report doesn't support per-key grouping, keyCosts will be empty
  // and actualCost will remain undefined — the table falls back to Est. Cost.
  function mergeActualCosts(
    usageList: KeyUsageSummary[],
    keyCosts: Record<string, number> | undefined
  ): KeyUsageSummary[] {
    if (!keyCosts || Object.keys(keyCosts).length === 0) return usageList
    return usageList.map(k => ({
      ...k,
      actualCost: keyCosts[k.keyId],
    }))
  }

  return {
    orgPrimary: {
      label: 'Example Corp',
      total: gsCost?.total  ?? 0,
      daily: gsCost?.daily  ?? [],
      usage: mergeActualCosts(gsUsage?.usage ?? [], gsCost?.keyCosts),
    },
    orgSecondary: {
      label: 'Example Corp Developer',
      total: gdCost?.total  ?? 0,
      daily: gdCost?.daily  ?? [],
      usage: mergeActualCosts(gdUsage?.usage ?? [], gdCost?.keyCosts),
    },
    fetchedAt: new Date().toISOString(),
  }
}

function prefetchOtherRanges(currentDays: number) {
  for (const days of [7, 14, 30, 90, 365]) {
    if (days === currentDays) continue
    fetch(`/api/usage?days=${days}`, { priority: 'low' } as RequestInit).catch(() => {})
    fetch(`/api/cost?days=${days}`,  { priority: 'low' } as RequestInit).catch(() => {})
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  days: number
  onFetched: (fetchedAt: string, cacheTtlMinutes: number) => void
}

export default function DashboardData({ days, onFetched }: Props) {
  const [data,        setData]        = useState<DashboardPayload | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [rateLimitSecs, setRateLimitSecs] = useState<number | null>(null)

  const load = useCallback(() => {
    setData(null)
    setError(null)
    setRateLimitSecs(null)

    loadData(days)
      .then(payload => {
        setData(payload)
        const ttl = days <= 14 ? 5 : days <= 30 ? 15 : days <= 90 ? 30 : 60
        onFetched(payload.fetchedAt, ttl)
        // prefetchOtherRanges disabled — the Anthropic Admin API has strict
        // rate limits; fire-and-forget prefetch of 4 other ranges burns through
        // the quota before the user ever switches tabs.
      })
      .catch(err => {
        if (err instanceof RateLimitError) {
          setRateLimitSecs(err.retryAfter)
        } else {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      })
  }, [days, onFetched])

  useEffect(() => { load() }, [load])

  if (rateLimitSecs !== null) {
    return <RateLimitState seconds={rateLimitSecs} onRetry={load} />
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-20 text-center">
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button onClick={load} className="text-sm text-indigo-600 hover:underline font-medium">
          Try again
        </button>
      </div>
    )
  }

  if (!data) return <Skeleton />

  return (
    <DashboardShell
      days={days}
      orgPrimary={data.orgPrimary}
      orgSecondary={data.orgSecondary}
    />
  )
}
