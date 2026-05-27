'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardData from '@/components/DashboardData'

const VALID_DAYS = [7, 14, 30, 90, 365]

export default function DashboardClient() {
  const searchParams = useSearchParams()
  const rawDays = parseInt(searchParams.get('days') ?? '')
  const days = VALID_DAYS.includes(rawDays) ? rawDays : 30

  // Timestamp and TTL are set once data loads — header shows nothing until then
  const [renderedAt,      setRenderedAt]      = useState<string | null>(null)
  const [cacheTtlMinutes, setCacheTtlMinutes] = useState<number>(15)

  const handleFetched = useCallback((fetchedAt: string, ttl: number) => {
    setRenderedAt(fetchedAt)
    setCacheTtlMinutes(ttl)
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <DashboardHeader
        currentDays={days}
        renderedAt={renderedAt}
        cacheTtlMinutes={cacheTtlMinutes}
      />
      <DashboardData days={days} onFetched={handleFetched} />
    </main>
  )
}
