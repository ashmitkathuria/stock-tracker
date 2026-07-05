import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import apiClient from '../config/api'

function usePredictionStats() {
  return useQuery({
    queryKey: ['prediction-stats'],
    queryFn: () => apiClient.get('/predictions/stats'),
    staleTime: 300000,
    retry: 1,
  })
}

function pct(v) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(0)}%`
}

function StatRow({ label, stats }) {
  return (
    <div className="flex justify-between items-baseline text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span>
        <span className="font-semibold">{pct(stats?.hit_rate)}</span>
        <span className="text-xs text-gray-500"> vs {pct(stats?.always_up_hit_rate)} always-up · n={stats?.n_directional ?? 0}</span>
      </span>
    </div>
  )
}

export function ModelPerformanceCard() {
  const { data, isLoading } = usePredictionStats()
  const overall = data?.overall

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">Model Performance</h3>

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}

      {!isLoading && (!overall || overall['90d']?.n_scored === 0) && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No scored predictions yet — outcomes are graded daily once the next close is known.
        </p>
      )}

      {!isLoading && overall && overall['90d']?.n_scored > 0 && (
        <div className="space-y-3">
          <StatRow label="Hit rate (30d)" stats={overall['30d']} />
          <StatRow label="Hit rate (90d)" stats={overall['90d']} />
          {overall['90d']?.brier !== null && (
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Brier score (90d, lower is better)</span>
              <span className="font-semibold">{overall['90d'].brier}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Info className="w-3 h-3" />
        <span>Educational project — not trading advice.</span>
      </div>
    </div>
  )
}
