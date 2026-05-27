'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface DailyCost { date: string; amount: number }

interface Props {
  orgPrimary: DailyCost[]
  orgSecondary: DailyCost[]
}

// Merge both org arrays into a single array keyed by date
function mergeByDate(gs: DailyCost[], gd: DailyCost[]) {
  const map = new Map<string, { date: string; 'Example Corp': number; 'Example Corp Developer': number }>()
  const all = [...new Set([...gs.map(d => d.date), ...gd.map(d => d.date)])].sort()
  for (const date of all) {
    map.set(date, {
      date: date.slice(5), // show MM-DD
      'Example Corp':  gs.find(d => d.date === date)?.amount  ?? 0,
      'Example Corp Developer': gd.find(d => d.date === date)?.amount ?? 0,
    })
  }
  return Array.from(map.values())
}

export default function SpendChart({ orgPrimary, orgSecondary }: Props) {
  const data = mergeByDate(orgPrimary, orgSecondary)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '']}
          labelFormatter={label => `Date: ${label}`}
        />
        <Legend />
        <Bar dataKey="Example Corp"  fill="#6366f1" radius={[2,2,0,0]} />
        <Bar dataKey="Example Corp Developer" fill="#f59e0b" radius={[2,2,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
