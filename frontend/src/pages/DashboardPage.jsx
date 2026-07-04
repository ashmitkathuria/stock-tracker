import { PriceCard } from '../components/PriceCard'
import { RiskMeter } from '../components/RiskMeter'
import { SectorHeatmap } from '../components/SectorHeatmap'
import { NewsPanel } from '../components/NewsPanel'
import { ModelPerformanceCard } from '../components/ModelPerformanceCard'
import { usePortfolio, usePortfolioRisk } from '../hooks/usePortfolio'
import { useWatchlist } from '../hooks/useStocks'
import { formatCurrency } from '../utils/formatters'

export function DashboardPage() {
  const { data: portfolio, isLoading: pfLoading } = usePortfolio()
  const { data: watchlist, isLoading: wlLoading } = useWatchlist()
  const { data: risk, isLoading: riskLoading } = usePortfolioRisk()
  const watchlistSymbols = (watchlist?.watchlist ?? []).map(w => w.symbol)

  const holdings = portfolio?.holdings ?? []
  const totalValue = portfolio?.total_value ?? 0
  const totalCost = portfolio?.total_cost ?? 0
  const gainLoss = portfolio?.gain_loss ?? 0
  const gainPct = totalCost > 0 ? ((gainLoss / totalCost) * 100).toFixed(2) : null

  const topHoldings = [...holdings]
    .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
    .slice(0, 4)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's your portfolio overview.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Portfolio Value</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {pfLoading ? '…' : formatCurrency(totalValue)}
          </p>
          {gainPct !== null && (
            <p className={`text-sm mt-2 ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {gainLoss >= 0 ? '+' : ''}{gainPct}% overall
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Gain/Loss</p>
          <p className={`text-3xl font-bold ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {pfLoading ? '…' : formatCurrency(gainLoss)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Since inception</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Holdings</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{pfLoading ? '…' : holdings.length}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {wlLoading ? '' : `${watchlist?.watchlist?.length ?? 0} on watchlist`}
          </p>
        </div>
      </div>

      {/* Risk Meter & Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskMeter
          riskScore={risk?.risk_score ?? 0}
          volatilityPct={risk?.volatility_pct ?? null}
          concentrationPct={risk?.concentration_pct ?? null}
          loading={riskLoading}
        />
        <SectorHeatmap />
      </div>

      {/* Model performance & News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ModelPerformanceCard />
        <div className="lg:col-span-2">
          <NewsPanel symbols={watchlistSymbols} />
        </div>
      </div>

      {/* Top Holdings */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Top Holdings</h2>
        {!pfLoading && topHoldings.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">No holdings yet — add some from the Portfolio page.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topHoldings.map(h => (
            <PriceCard
              key={h.symbol}
              symbol={h.symbol}
              price={h.last_price}
              change={h.invested > 0 && h.gain_loss !== null ? (h.gain_loss / h.invested) * 100 : 0}
              loading={pfLoading}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
