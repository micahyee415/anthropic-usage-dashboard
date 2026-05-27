import { NextRequest, NextResponse } from 'next/server'
import { getOrgs } from '@/lib/anthropic'
import { getCachedDailyCosts, getCachedKeyUsage, getCachedKeyCosts } from '@/lib/cache'
import { subDays, format } from 'date-fns'

// Warm the short-TTL ranges (7d = 5min TTL, 14d = 5min TTL, 30d = 15min TTL).
// The cron runs every 15min, so 7d and 14d would go cold 3× between runs without this.
// 90d (30min TTL) and 365d (1hr TTL) are intentionally left cold — rarely accessed
// and too slow to fetch within the 60s function timeout if combined with the others.

export const maxDuration = 60 // requires Vercel Pro; on hobby this is capped at 10s

// Ranges to pre-warm. Must complete within maxDuration seconds total.
const WARM_RANGES = [7, 14, 30] as const

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgs = getOrgs()
  const now = new Date()
  const warmed: string[] = []

  for (const days of WARM_RANGES) {
    const endingAt   = format(now, "yyyy-MM-dd'T'HH:mm:ss'Z'")
    const startingAt = format(subDays(now, days), "yyyy-MM-dd'T'HH:mm:ss'Z'")

    for (const org of orgs) {
      try {
        await getCachedDailyCosts(org, startingAt, endingAt, days)
        warmed.push(`cost:${org.id}:${days}d`)
      } catch (err) {
        warmed.push(`cost:${org.id}:${days}d:ERROR:${String(err)}`)
      }
      try {
        await getCachedKeyUsage(org, startingAt, endingAt, days)
        warmed.push(`usage:${org.id}:${days}d`)
      } catch (err) {
        warmed.push(`usage:${org.id}:${days}d:ERROR:${String(err)}`)
      }
      try {
        await getCachedKeyCosts(org, startingAt, endingAt, days)
        warmed.push(`keycost:${org.id}:${days}d`)
      } catch (err) {
        warmed.push(`keycost:${org.id}:${days}d:ERROR:${String(err)}`)
      }
    }
  }

  return NextResponse.json({ warmed, at: new Date().toISOString() })
}
