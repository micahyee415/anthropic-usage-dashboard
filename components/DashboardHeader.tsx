'use client'

import { useRouter } from 'next/navigation'
import { useRef, useCallback } from 'react'

export const DAY_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1yr', days: 365 },
]

interface Props {
  currentDays: number
  renderedAt: string | null  // null while data is still loading
  cacheTtlMinutes: number
}

export default function DashboardHeader({ currentDays, renderedAt, cacheTtlMinutes }: Props) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const formattedTime = renderedAt
    ? new Date(renderedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  // Debounce navigation — rapid clicks only fire one route change after 300ms idle.
  // This prevents burning through the rate limit when a user clicks several
  // date options quickly before settling on one.
  const handleDaysChange = useCallback((days: number) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      router.push(`?days=${days}`)
    }, 300)
  }, [router])

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Anthropic Usage Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Example Corp · Example Corp Developer · API token usage &amp; spend
          </p>
          {formattedTime && (
            <p className="text-xs text-gray-400 mt-1">
              Data as of {formattedTime}
              <span className="mx-1.5">·</span>
              Refreshes every {cacheTtlMinutes}m
            </p>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {DAY_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => handleDaysChange(opt.days)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                currentDays === opt.days
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
