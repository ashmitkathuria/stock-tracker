import { PriceCard } from '../components/PriceCard'
import { RiskMeter } from '../components/RiskMeter'
import { SectorHeatmap } from '../components/SectorHeatmap'
import { usePortfolio } from '../hooks/usePortfolio'
import { useWatchlist } from '../hooks/useStocks'
import { formatCurrency } from '../utils/formatters'

export function DashboardPage() {
  const { data: portfolio, isLoading: pfLoading } = usePortfolio()
  const { data: watchlist, isLoading: wlLoading } = useWatchlist()

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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your portfolio overview.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Portfolio Value</p>
          <p className="text-3xl font-bold text-blue-600">
            {pfLoading ? '…' : formatCurrency(totalValue)}
          </p>
          {gainPct !== null && (
            <p className={`text-sm mt-2 ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {gainLoss >= 0 ? '+' : ''}{gainPct}% overall
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Gain/Loss</p>
          <p className={`text-3xl font-bold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {pfLoading ? '…' : formatCurrency(gainLoss)}
          </p>
          <p className="text-sm text-gray-600 mt-2">Since inception</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Holdings</p>
          <p className="text-3xl font-bold text-blue-600">{pfLoading ? '…' : holdings.length}</p>
          <p className="text-sm text-gray-600 mt-2">
            {wlLoading ? '' : `${watchlist?.watchlist?.length ?? 0} on watchlist`}
          </p>
        </div>
      </div>

      {/* Risk Meter & Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskMeter riskScore={45} />
        <SectorHeatmap />
      </div>

      {/* Top Holdings */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Top Holdings</h2>
        {!pfLoading && topHoldings.length === 0 && (
          <p className="text-gray-500">No holdings yet — add some from the Portfolio page.</p>
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
