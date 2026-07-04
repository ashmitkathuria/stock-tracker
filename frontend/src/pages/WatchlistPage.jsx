import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PriceCard } from '../components/PriceCard'
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useFetchStockPrice } from '../hooks/useStocks'

export function WatchlistPage() {
  const [newSymbol, setNewSymbol] = useState('')
  const [error, setError] = useState('')
  const { data, isLoading } = useWatchlist()
  const addToWatchlist = useAddToWatchlist()
  const removeFromWatchlist = useRemoveFromWatchlist()
  const fetchPrice = useFetchStockPrice()

  const watchlist = data?.watchlist ?? []

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    const symbol = newSymbol.trim().toUpperCase()
    if (!symbol) return
    try {
      await addToWatchlist.mutateAsync(symbol)
      setNewSymbol('')
      // fetch a fresh price so the card isn't empty
      fetchPrice.mutate(symbol)
    } catch (err) {
      setError(err?.detail || 'Failed to add symbol')
    }
  }

  const handleRemove = async (symbol) => {
    try {
      await removeFromWatchlist.mutateAsync(symbol)
    } catch (err) {
      setError(err?.detail || 'Failed to remove symbol')
    }
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
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
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
            disabled={addToWatchlist.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {addToWatchlist.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {/* Watchlist Grid */}
      <div>
        {isLoading && <p className="text-gray-500">Loading watchlist…</p>}
        {!isLoading && watchlist.length === 0 && (
          <p className="text-gray-500">Your watchlist is empty. Add a symbol above.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map(item => (
            <div key={item.symbol} className="relative">
              <PriceCard
                symbol={item.symbol}
                price={item.last_price}
                change={0}
                loading={false}
              />
              <button
                onClick={() => handleRemove(item.symbol)}
                className="absolute top-3 right-3 p-2 hover:bg-red-100 rounded-lg transition text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
