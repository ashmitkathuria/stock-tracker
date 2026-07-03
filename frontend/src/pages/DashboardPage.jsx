import { PriceCard } from '../components/PriceCard'
import { RiskMeter } from '../components/RiskMeter'
import { SectorHeatmap } from '../components/SectorHeatmap'
import { useStockPrice } from '../hooks/useStocks'

export function DashboardPage() {
  const { data: relianceData, isLoading: relianceLoading } = useStockPrice('RELIANCE')
  const { data: infyData, isLoading: infyLoading } = useStockPrice('INFY')

  const topStocks = [
    { symbol: 'RELIANCE', data: relianceData, loading: relianceLoading },
    { symbol: 'INFY', data: infyData, loading: infyLoading },
  ]

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
          <p className="text-3xl font-bold text-blue-600">₹2,50,000</p>
          <p className="text-sm text-green-600 mt-2">+5.2% today</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Gain/Loss</p>
          <p className="text-3xl font-bold text-green-600">₹45,000</p>
          <p className="text-sm text-gray-600 mt-2">Since inception</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Holdings</p>
          <p className="text-3xl font-bold text-blue-600">8</p>
          <p className="text-sm text-gray-600 mt-2">Stocks & ETFs</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topStocks.map(stock => (
            <PriceCard
              key={stock.symbol}
              symbol={stock.symbol}
              price={stock.data?.price}
              change={stock.data?.open ? ((stock.data.price - stock.data.open) / stock.data.open * 100) : 0}
              loading={stock.loading}
              prediction={{ signal: 'UP', confidence: 0.68 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
