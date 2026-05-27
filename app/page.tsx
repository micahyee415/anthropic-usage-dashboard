// Server component — renders instantly with no data fetching.
// DashboardClient (client component) handles all data fetching and state.

import { Suspense } from 'react'
import DashboardClient from '@/components/DashboardClient'

export default function Page() {
  return (
    <Suspense>
      <DashboardClient />
    </Suspense>
  )
}
