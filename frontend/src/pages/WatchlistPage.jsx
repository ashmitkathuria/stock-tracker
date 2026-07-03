import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PriceCard } from '../components/PriceCard'
import { useStockPrice } from '../hooks/useStocks'

export function WatchlistPage() {
  const [newSymbol, setNewSymbol] = useState('')
  const [watchlist, setWatchlist] = useState(['RELIANCE', 'INFY', 'TCS'])

  const handleAdd = (e) => {
    e.preventDefault()
    const symbol = newSymbol.trim().toUpperCase()
    if (symbol && !watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol])
    }
    setNewSymbol('')
  }

  const handleRemove = (symbol) => {
    setWatchlist(watchlist.filter(s => s !== symbol))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Watchlist</h1>
        <p className="text-gray-600">Track your favorite stocks.</p>
      </div>

      {/* Add Stock Form */}
      <form onSubmit={handleAdd} className="bg-white rounded-lg shadow p-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Enter stock symbol (e.g., RELIANCE)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </form>

      {/* Watchlist Grid */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map(symbol => (
            <WatchlistCard
              key={symbol}
              symbol={symbol}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WatchlistCard({ symbol, onRemove }) {
  const { data, isLoading } = useStockPrice(symbol)

  return (
    <div className="relative">
      <PriceCard
        symbol={symbol}
        price={data?.price}
        change={data?.open ? ((data.price - data.open) / data.open * 100) : 0}
        loading={isLoading}
        prediction={{ signal: 'UP', confidence: 0.65 }}
      />
      <button
        onClick={() => onRemove(symbol)}
        className="absolute top-3 right-3 p-2 hover:bg-red-100 rounded-lg transition text-red-600"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
