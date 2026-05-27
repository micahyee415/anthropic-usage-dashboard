// Anthropic pricing per million tokens (USD)
// Source: platform.claude.com/docs/models — update if Anthropic changes rates
export const PRICING: Record<string, { input: number; output: number; cache_write: number; cache_read: number }> = {
  'claude-opus-4-6':           { input: 15.00, output: 75.00, cache_write: 18.75, cache_read: 1.50 },
  'claude-opus-4-5-20251101':  { input: 15.00, output: 75.00, cache_write: 18.75, cache_read: 1.50 },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00, cache_write: 3.75,  cache_read: 0.30 },
  'claude-sonnet-4-5-20250929':{ input: 3.00,  output: 15.00, cache_write: 3.75,  cache_read: 0.30 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00,  cache_write: 1.00,  cache_read: 0.08 },
}

// Fallback for unknown models — use Sonnet pricing as a middle estimate
const FALLBACK = { input: 3.00, output: 15.00, cache_write: 3.75, cache_read: 0.30 }

export function estimateCost(
  model: string,
  uncachedInput: number,
  cacheCreation: number,
  cacheRead: number,
  output: number
): number {
  const rates = PRICING[model] ?? FALLBACK
  const M = 1_000_000 // per million tokens
  return (
    (uncachedInput * rates.input) / M +
    (cacheCreation * rates.cache_write) / M +
    (cacheRead    * rates.cache_read)  / M +
    (output       * rates.output)      / M
  )
}
