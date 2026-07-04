import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import { formatCurrency, formatPercent, getChangeColor } from '../utils/formatters'

export function PriceCard({ symbol, price, change, prediction = null, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
        <div className="h-6 bg-gray-200 rounded w-24"></div>
      </div>
    )
  }

  const isPositive = change >= 0
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">{symbol}</h3>
          <p className="text-sm text-gray-600">NSE</p>
        </div>
        <Icon className={`w-5 h-5 ${getChangeColor(change)}`} />
      </div>

      <div className="mb-3">
        <p className="text-2xl font-bold">{formatCurrency(price)}</p>
        <p className={`text-sm font-semibold ${getChangeColor(change)}`}>
          {formatPercent(change)}
        </p>
      </div>

      {prediction && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Prediction:</span>
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              prediction.signal === 'UP'
                ? 'bg-green-100 text-green-700'
                : prediction.signal === 'DOWN'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {prediction.signal === 'NEUTRAL'
                ? 'NEUTRAL'
                : `${prediction.signal} ${(prediction.confidence * 100).toFixed(0)}%`}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <Info className="w-3 h-3" />
            <span>ML forecast — educational, not trading advice</span>
          </div>
        </div>
      )}
    </div>
  )
}
