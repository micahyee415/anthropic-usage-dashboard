/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Good enough for an internal dashboard with a handful of users.
 * Resets on cold start (acceptable — this isn't a public API).
 *
 * Limits: 10 requests per IP per 60 seconds.
 * Spamming date buttons won't trigger new Anthropic API calls anyway
 * (server cache absorbs repeats), but this prevents cache-busting floods.
 */

const WINDOW_MS   = 60_000  // 1 minute sliding window
const MAX_REQUESTS = 10      // requests allowed per window per IP

// Map of IP → array of request timestamps within the current window
const store = new Map<string, number[]>()

// Prune the store periodically to avoid unbounded memory growth.
// .unref() lets Node exit cleanly without waiting for this timer.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, timestamps] of store.entries()) {
    const pruned = timestamps.filter(t => t > cutoff)
    if (pruned.length === 0) store.delete(ip)
    else store.set(ip, pruned)
  }
}, WINDOW_MS).unref()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number  // seconds until the window resets
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const timestamps = (store.get(ip) ?? []).filter(t => t > cutoff)

  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = timestamps[0]
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  timestamps.push(now)
  store.set(ip, timestamps)
  return { allowed: true, remaining: MAX_REQUESTS - timestamps.length }
}
