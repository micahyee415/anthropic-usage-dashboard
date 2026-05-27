'use client'

import React, { useState } from 'react'
import { KeyUsageSummary } from '@/lib/anthropic'

function LastActive({ date }: { date: string | null }) {
  if (!date) return <span className="text-gray-300 text-xs">—</span>
  return <span className="text-xs text-gray-600">{date}</span>
}

interface Props {
  keys: KeyUsageSummary[]
  showOrg?: boolean  // show org column when combining both orgs
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function fmtCost(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function KeyTable({ keys, showOrg = false }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (keys.length === 0) return <p className="text-sm text-gray-400 py-4">No usage data in this period.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase tracking-wide">
            <th className="py-2 pr-4 font-medium">Key Name</th>
            {showOrg && <th className="py-2 pr-4 font-medium">Org</th>}
            <th className="py-2 pr-4 font-medium">Workspace</th>
            <th className="py-2 pr-4 font-medium text-right">Uncached Input</th>
            <th className="py-2 pr-4 font-medium text-right">Cache Write</th>
            <th className="py-2 pr-4 font-medium text-right">Cache Read</th>
            <th className="py-2 pr-4 font-medium text-right">Output Tokens</th>
            <th className="py-2 pr-4 font-medium text-right">Total Tokens</th>
            <th className="py-2 font-medium text-right">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(k => (
            <React.Fragment key={k.keyId}>
              <tr
                className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${k.totalTokens === 0 ? 'opacity-40' : ''}`}
                onClick={() => setExpanded(expanded === k.keyId ? null : k.keyId)}
              >
                <td className="py-2 pr-4 font-mono font-medium text-gray-800 flex items-center gap-1">
                  <span className="text-gray-400 text-xs">{expanded === k.keyId ? '▼' : '▶'}</span>
                  {k.keyName}
                </td>
                {showOrg && (
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      k.org === 'Example Corp' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                    }`}>{k.org}</span>
                  </td>
                )}
                <td className="py-2 pr-4 text-gray-500 text-xs">
                  {k.workspace ? 'Claude Code' : 'Default'}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700">{fmt(k.uncachedInput)}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{fmt(k.cacheCreation)}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{fmt(k.cacheRead)}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{fmt(k.output)}</td>
                <td className="py-2 pr-4 text-right font-medium text-gray-900">{fmt(k.totalTokens)}</td>
                <td className="py-2 text-right"><LastActive date={k.lastActive} /></td>
              </tr>

              {/* Expanded model breakdown */}
              {expanded === k.keyId && (
                <tr className="bg-gray-50">
                  <td colSpan={showOrg ? 9 : 8} className="px-6 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 text-left">
                          <th className="pb-1 font-medium">Model</th>
                          <th className="pb-1 font-medium text-right">Uncached Input</th>
                          <th className="pb-1 font-medium text-right">Cache Write</th>
                          <th className="pb-1 font-medium text-right">Cache Read</th>
                          <th className="pb-1 font-medium text-right">Output</th>
                          <th className="pb-1 font-medium text-right">Total Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k.modelBreakdown.sort((a, b) => b.estimatedCost - a.estimatedCost).map(m => (
                          <tr key={m.model} className="border-t border-gray-200">
                            <td className="py-1 font-mono text-gray-700">{m.model}</td>
                            <td className="py-1 text-right text-gray-600">{fmt(m.uncachedInput)}</td>
                            <td className="py-1 text-right text-gray-600">{fmt(m.cacheCreation)}</td>
                            <td className="py-1 text-right text-gray-600">{fmt(m.cacheRead)}</td>
                            <td className="py-1 text-right text-gray-600">{fmt(m.output)}</td>
                            <td className="py-1 text-right font-medium text-gray-800">{fmt(m.uncachedInput + m.cacheCreation + m.cacheRead + m.output)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
