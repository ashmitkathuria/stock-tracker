import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import apiClient from '../config/api'
import { formatCurrency } from '../utils/formatters'
import { SkeletonChart } from './SkeletonLoader'

export function PortfolioHistoryChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio', 'history'],
    queryFn: () => apiClient.get('/portfolio/history?days=90'),
    staleTime: 300000,
  })

  if (isLoading) return <SkeletonChart />

  const history = data?.history ?? []
  if (history.length < 2) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Portfolio Value (90d)</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Not enough history yet — the chart appears once you have holdings and a few days of stored prices.
        </p>
      </div>
    )
  }

  const first = history[0].value
  const last = history[history.length - 1].value
  const up = last >= first

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Portfolio Value (90d)</h2>
        <span className={`text-sm font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {formatCurrency(last)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? '#16a34a' : '#dc2626'} stopOpacity={0.3} />
              <stop offset="100%" stopColor={up ? '#16a34a' : '#dc2626'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
            minTickGap={40} stroke="currentColor" />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70}
            domain={['auto', 'auto']} stroke="currentColor"
            tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
          <Tooltip
            formatter={(v) => [formatCurrency(v), 'Value']}
            contentStyle={{ borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="value" stroke={up ? '#16a34a' : '#dc2626'}
            strokeWidth={2} fill="url(#pfGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
