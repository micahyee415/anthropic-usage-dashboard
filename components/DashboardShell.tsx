'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import KeyTable from '@/components/KeyTable'
import { KeyUsageSummary, DailyOrgCost } from '@/lib/anthropic'
import { DAY_OPTIONS } from '@/components/DashboardHeader'

// Recharts only runs in the browser
const SpendChart = dynamic(() => import('@/components/SpendChart'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgData {
  label: string
  total: number
  daily: DailyOrgCost[]
  usage: KeyUsageSummary[]
}

interface Props {
  days: number
  orgPrimary: OrgData
  orgSecondary: OrgData
}

type OrgFilter = 'all' | 'org-primary' | 'org-secondary'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCost(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardShell({ days, orgPrimary, orgSecondary }: Props) {
  const [orgFilter, setOrgFilter] = useState<OrgFilter>('all')

  const totalActual = orgPrimary.total + orgSecondary.total
  const annualized  = (totalActual / days) * 365
  const periodLabel = DAY_OPTIONS.find(o => o.days === days)?.label ?? `${days}d`

  const combinedKeys = [...orgPrimary.usage, ...orgSecondary.usage]
    .sort((a, b) => b.totalTokens - a.totalTokens)

  const displayKeys =
    orgFilter === 'org-primary'  ? orgPrimary.usage :
    orgFilter === 'org-secondary' ? orgSecondary.usage :
    combinedKeys

  const displayActual =
    orgFilter === 'org-primary'  ? orgPrimary.total :
    orgFilter === 'org-secondary' ? orgSecondary.total :
    totalActual

  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={`Total Spend (${periodLabel})`}
          value={fmtCost(totalActual)}
          sub="Actual billing — both orgs"
        />
        <StatCard
          label={`Annualized Run Rate (${periodLabel} avg)`}
          value={fmtCost(annualized)}
          sub="Extrapolated from selected period"
        />
        <StatCard
          label="Example Corp"
          value={fmtCost(orgPrimary.total)}
          sub={`${periodLabel} actual`}
        />
        <StatCard
          label="Example Corp Developer"
          value={fmtCost(orgSecondary.total)}
          sub={`${periodLabel} actual`}
        />
      </div>

      {/* ── Org daily chart ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Daily Spend by Org</h2>
        <p className="text-xs text-gray-400 mb-4">Actual billing from Anthropic cost report.</p>
        <SpendChart orgPrimary={orgPrimary.daily} orgSecondary={orgSecondary.daily} />
      </div>

      {/* ── Per-key usage table ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              Token Usage by API Key ({periodLabel})
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Token counts from Anthropic usage report. Click any row to see model breakdown.
            </p>
          </div>

          {/* Org filter — defaults to All Orgs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
            {([
              { id: 'all',           label: 'All Orgs' },
              { id: 'org-primary',  label: 'Example Corp' },
              { id: 'org-secondary', label: 'Example Corp Developer' },
            ] as { id: OrgFilter; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setOrgFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  orgFilter === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <KeyTable keys={displayKeys} showOrg={orgFilter === 'all'} />

        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
          Actual billed ({periodLabel}): {fmtCost(displayActual)} — from Anthropic billing API.
          Token columns: Uncached Input and Cache Write bill at different rates; Cache Read bills at ~10% of input rate.
          Per-key cost breakdown is not available from the Anthropic API.
        </div>
      </div>
    </div>
  )
}
