import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import { formatCurrency, formatPercent, getChangeColor } from '../utils/formatters'

export function PriceCard({ symbol, price, change, prediction = null, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </div>
    )
  }

  const isPositive = change >= 0
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <Link
      to={`/stock/${symbol}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{symbol}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">NSE</p>
        </div>
        <Icon className={`w-5 h-5 ${getChangeColor(change)}`} />
      </div>

      <div className="mb-3">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(price)}</p>
        <p className={`text-sm font-semibold ${getChangeColor(change)}`}>
          {formatPercent(change)}
        </p>
      </div>

      {prediction && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Prediction:</span>
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              prediction.signal === 'UP'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : prediction.signal === 'DOWN'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {prediction.signal === 'NEUTRAL'
                ? 'NEUTRAL'
                : `${prediction.signal} ${(prediction.confidence * 100).toFixed(0)}%`}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
            <Info className="w-3 h-3" />
            <span>ML forecast — educational, not trading advice</span>
          </div>
        </div>
      )}
    </Link>
  )
}
