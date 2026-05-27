'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { DailyModelCost } from '@/lib/anthropic'

// Friendly short names for display
const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6':              'Opus 4.6',
  'claude-opus-4-5-20251101':     'Opus 4.5',
  'claude-sonnet-4-6':            'Sonnet 4.6',
  'claude-sonnet-4-5-20250929':   'Sonnet 4.5',
  'claude-haiku-4-5-20251001':    'Haiku 4.5',
  'claude-3-5-sonnet-20241022':   'Sonnet 3.5 (Oct)',
  'claude-3-5-sonnet-20240620':   'Sonnet 3.5 (Jun)',
  'claude-3-5-haiku-20241022':    'Haiku 3.5',
  'claude-3-opus-20240229':       'Opus 3',
  'claude-3-sonnet-20240229':     'Sonnet 3',
  'claude-3-haiku-20240307':      'Haiku 3',
}

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6':              '#7C3AED',
  'claude-opus-4-5-20251101':     '#8B5CF6',
  'claude-sonnet-4-6':            '#EC4899',
  'claude-sonnet-4-5-20250929':   '#F97316',
  'claude-haiku-4-5-20251001':    '#6B7280',
  'claude-3-5-sonnet-20241022':   '#EF4444',
  'claude-3-5-sonnet-20240620':   '#F59E0B',
  'claude-3-5-haiku-20241022':    '#10B981',
  'claude-3-opus-20240229':       '#3B82F6',
  'claude-3-sonnet-20240229':     '#06B6D4',
  'claude-3-haiku-20240307':      '#94A3B8',
}

const FALLBACK_COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444',
]

interface Props {
  data: DailyModelCost[]
}

export default function ModelCostChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No model cost data available.</p>
  }

  // Get all unique models, sorted by total spend descending
  const modelTotals = new Map<string, number>()
  for (const entry of data) {
    modelTotals.set(entry.model, (modelTotals.get(entry.model) ?? 0) + entry.amount)
  }
  const models = Array.from(modelTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)

  // Pivot: [{date, [model]: amount, ...}]
  const byDate = new Map<string, Record<string, string | number>>()
  for (const entry of data) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, { date: entry.date })
    const row = byDate.get(entry.date)!
    row[entry.model] = ((row[entry.model] as number) ?? 0) + entry.amount
  }
  const chartData = Array.from(byDate.values())
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))
    .map(row => ({ ...row, date: (row.date as string).slice(5) })) // show MM-DD

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value, name) => [
            `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            MODEL_LABELS[name as string] ?? name,
          ]}
          labelFormatter={label => `Date: ${label}`}
        />
        <Legend
          formatter={name => MODEL_LABELS[name] ?? name}
          wrapperStyle={{ fontSize: 11 }}
        />
        {models.map((model, i) => (
          <Bar
            key={model}
            dataKey={model}
            stackId="cost"
            fill={MODEL_COLORS[model] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
            radius={i === models.length - 1 ? [2, 2, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
