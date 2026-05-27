import { NextRequest, NextResponse } from 'next/server'
import { getOrgs } from '@/lib/anthropic'
import type { DailyOrgCost } from '@/lib/anthropic'
import { getCachedDailyCosts, getCachedKeyCosts } from '@/lib/cache'
import { checkRateLimit } from '@/lib/ratelimit'
import { subDays, format } from 'date-fns'

export async function GET(req: NextRequest) {
  // Rate limiting — keyed by IP.
  // On Vercel, x-forwarded-for contains the real client IP set by the edge network.
  // Take only the first value (the actual client); any additional values are proxies.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const limit = checkRateLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before refreshing.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfter),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  // Validate days param — only allow known values to prevent cache fragmentation
  const rawDays = parseInt(req.nextUrl.searchParams.get('days') ?? '30')
  const days = [7, 14, 30, 90, 365].includes(rawDays) ? rawDays : 30

  const ttl = days <= 14 ? 300 : days <= 30 ? 900 : days <= 90 ? 1800 : 3600

  const endingAt   = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
  const startingAt = format(subDays(new Date(), days), "yyyy-MM-dd'T'HH:mm:ss'Z'")

  try {
    const orgs = getOrgs()
    const results: Array<{ org: string; label: string; total: number; daily: DailyOrgCost[]; keyCosts: Record<string, number>; error?: string }> = []
    for (const org of orgs) {
      try {
        const daily    = await getCachedDailyCosts(org, startingAt, endingAt, days)
        const keyCosts = await getCachedKeyCosts(org, startingAt, endingAt, days)
        const total    = daily.reduce((sum, d) => sum + d.amount, 0)
        results.push({ org: org.id, label: org.label, total, daily, keyCosts })
      } catch (orgErr) {
        // One org failing shouldn't block the other — return empty data with an error flag
        const isRateLimit = orgErr instanceof Error && orgErr.message.includes('429')
        results.push({ org: org.id, label: org.label, total: 0, daily: [], keyCosts: {}, error: isRateLimit ? 'rate_limited' : 'fetch_error' })
      }
    }
    return NextResponse.json(
      { startingAt, endingAt, orgs: results },
      {
        headers: {
          'X-RateLimit-Remaining': String(limit.remaining),
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (err) {
    console.error(err)
    // Forward 429 to the client so it can show the countdown UI
    if (err instanceof Error && err.message.includes('429')) {
      return NextResponse.json({ error: 'Anthropic API rate limited' }, {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    return NextResponse.json({ error: 'Failed to fetch cost data' }, { status: 500 })
  }
}
