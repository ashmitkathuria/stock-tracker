import { useParams, useNavigate } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, Plus, Heart } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../config/api'
import { formatCurrency, formatPercent, formatDate, getChangeColor } from '../utils/formatters'
import { SkeletonChart } from '../components/SkeletonLoader'
import { useState } from 'react'

export function StockDetailPage() {
  const { symbol } = useParams()
  usePageTitle(symbol)
  const navigate = useNavigate()
  const [timePeriod, setTimePeriod] = useState('1m')
  const [showAddModal, setShowAddModal] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')

  // Fetch stock history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['stock-history', symbol, timePeriod],
    queryFn: async () => {
      const days = { '1m': 30, '3m': 90, '1y': 365, '5y': 1825 }[timePeriod] || 30
      const response = await apiClient.get(`/stocks/${symbol}/history?days=${days}`)
      return response
    },
    enabled: !!symbol,
  })

  // Fetch latest price and OHLC
  const { data: priceData } = useQuery({
    queryKey: ['stock-price', symbol],
    queryFn: async () => {
      const response = await apiClient.get(`/stocks/${symbol}/price`)
      return response
    },
    enabled: !!symbol,
  })

  // Fetch prediction
  const { data: predictionData } = useQuery({
    queryKey: ['predictions', symbol],
    queryFn: async () => {
      try {
        const response = await apiClient.get(`/predictions/${symbol}`)
        return response
      } catch {
        return null
      }
    },
    enabled: !!symbol,
  })

  // Fetch news
  const { data: newsData } = useQuery({
    queryKey: ['news', symbol],
    queryFn: async () => {
      const response = await apiClient.get(`/news/${symbol}`)
      return response
    },
    enabled: !!symbol,
  })

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post('/watchlist', { symbol })
    },
    onSuccess: () => {
      toast.success(`${symbol} added to watchlist`)
    },
    onError: (error) => {
      toast.error(error.detail || 'Failed to add to watchlist')
    },
  })

  // Add to portfolio mutation
  const addToPortfolioMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post('/portfolio', {
        symbol,
        quantity: parseFloat(quantity),
        avg_cost: parseFloat(cost),
      })
    },
    onSuccess: () => {
      toast.success(`${symbol} added to portfolio`)
      setShowAddModal(false)
      setQuantity('')
      setCost('')
    },
    onError: (error) => {
      toast.error(error.detail || 'Failed to add to portfolio')
    },
  })

  const history = historyData?.history || []
  const currentPrice = priceData?.price
  const prediction = predictionData?.prediction
  const news = newsData?.headlines || []

  const timePeriodDays = { '1m': 30, '3m': 90, '1y': 365, '5y': 1825 }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{symbol}</h1>
          <p className="text-gray-600 dark:text-gray-400">Stock Detail</p>
        </div>
      </div>

      {/* Price Overview */}
      {priceData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Price</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(currentPrice)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Open</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(priceData.open)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">High / Low</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(priceData.high)} / {formatCurrency(priceData.low)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Close</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(priceData.close)}</p>
          </div>
        </div>
      )}

      {/* Price Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Price Chart</h2>
          <div className="flex gap-2">
            {['1m', '3m', '1y', '5y'].map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1 rounded-lg transition ${
                  timePeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {period.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <SkeletonChart />
        ) : history.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                }}
                formatter={(value) => [formatCurrency(value), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorPrice)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No data available
          </div>
        )}
      </div>

      {/* Prediction */}
      {prediction && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">AI Prediction</h2>
          <div className="flex items-center gap-4">
            {prediction.signal === 'UP' ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {prediction.signal} Signal
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Confidence: {((prediction.confidence || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* News */}
      {news.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Latest News</h2>
          <div className="space-y-4">
            {news.slice(0, 5).map((article, i) => (
              <div key={i} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  {article.title}
                </a>
                {article.sentiment_score !== undefined && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-sm font-semibold ${article.sentiment_score > 0 ? 'text-green-600' : article.sentiment_score < 0 ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                      {article.sentiment_score > 0 ? 'Positive' : article.sentiment_score < 0 ? 'Negative' : 'Neutral'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => addToWatchlistMutation.mutate()}
          disabled={addToWatchlistMutation.isPending}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
        >
          <Heart className="w-4 h-4" />
          Add to Watchlist
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add to Portfolio
        </button>
      </div>

      {/* Add to Portfolio Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add to Portfolio</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Enter quantity"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cost per Unit
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Enter cost"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => addToPortfolioMutation.mutate()}
                disabled={!quantity || !cost || addToPortfolioMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {addToPortfolioMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
