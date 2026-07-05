import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { PriceCard } from '../components/PriceCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SkeletonCard } from '../components/SkeletonLoader'
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useFetchStockPrice, usePrediction } from '../hooks/useStocks'
import { usePageTitle } from '../hooks/usePageTitle'

export function WatchlistPage() {
  usePageTitle('Watchlist')
  const [newSymbol, setNewSymbol] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const { data, isLoading } = useWatchlist()
  const addToWatchlist = useAddToWatchlist()
  const removeFromWatchlist = useRemoveFromWatchlist()
  const fetchPrice = useFetchStockPrice()

  const watchlist = data?.watchlist ?? []

  const handleAdd = async (e) => {
    e.preventDefault()
    const symbol = newSymbol.trim().toUpperCase()
    if (!symbol) return
    try {
      await addToWatchlist.mutateAsync(symbol)
      toast.success(`${symbol} added to watchlist`)
      setNewSymbol('')
      // fetch a fresh price so the card isn't empty
      fetchPrice.mutate(symbol)
    } catch (err) {
      toast.error(err?.detail || 'Failed to add symbol')
    }
  }

  const handleRemove = async () => {
    try {
      await removeFromWatchlist.mutateAsync(removeTarget)
      toast.success(`${removeTarget} removed`)
    } catch (err) {
      toast.error(err?.detail || 'Failed to remove symbol')
    } finally {
      setRemoveTarget(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Watchlist</h1>
        <p className="text-gray-600 dark:text-gray-400">Track your favorite stocks.</p>
      </div>

      {/* Add Stock Form */}
      <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1">
            <span className="sr-only">Stock symbol</span>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="Enter stock symbol (e.g., RELIANCE)"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={addToWatchlist.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {addToWatchlist.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {/* Watchlist Grid */}
      <div>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}
        {!isLoading && watchlist.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center">
            <p className="text-gray-500 dark:text-gray-400">Your watchlist is empty. Add a symbol above to start tracking prices and predictions.</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map(item => (
            <WatchlistCard key={item.symbol} item={item} onRemove={() => setRemoveTarget(item.symbol)} />
          ))}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove from watchlist?"
        message={`${removeTarget} will no longer be tracked or included in daily price updates.`}
        confirmText="Remove"
        variant="danger"
        loading={removeFromWatchlist.isPending}
      />
    </div>
  )
}

function WatchlistCard({ item, onRemove }) {
  const { data: prediction } = usePrediction(item.symbol)
  const hasPrediction = prediction?.status === 'success'

  return (
    <div className="relative">
      <PriceCard
        symbol={item.symbol}
        price={item.last_price}
        change={0}
        loading={false}
        prediction={hasPrediction ? {
          signal: prediction.signal,
          confidence: prediction.confidence ?? 0,
        } : null}
      />
      <button
        onClick={(e) => { e.preventDefault(); onRemove() }}
        aria-label={`Remove ${item.symbol} from watchlist`}
        className="absolute top-3 right-3 p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition text-red-600 dark:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
