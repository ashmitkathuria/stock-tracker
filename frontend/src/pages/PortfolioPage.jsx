import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../utils/formatters'
import { usePortfolio, useAddHolding, useSellHolding } from '../hooks/usePortfolio'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SkeletonCard, SkeletonTable } from '../components/SkeletonLoader'
import { usePageTitle } from '../hooks/usePageTitle'

const inputCls =
  'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export function PortfolioPage() {
  usePageTitle('Portfolio')
  const { data, isLoading, error } = usePortfolio()
  const addHolding = useAddHolding()
  const sellHolding = useSellHolding()

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ symbol: '', quantity: '', avgCost: '' })
  const [sellTarget, setSellTarget] = useState(null) // holding being sold
  const [sellForm, setSellForm] = useState({ quantity: '', price: '' })
  const [confirmFullSell, setConfirmFullSell] = useState(false)

  const holdings = data?.holdings ?? []
  const totalInvested = data?.total_cost ?? 0
  const totalValue = data?.total_value ?? 0
  const gainLoss = data?.gain_loss ?? 0

  const handleAddHolding = async (e) => {
    e.preventDefault()
    if (!formData.symbol || !formData.quantity || !formData.avgCost) {
      toast.error('Fill in symbol, quantity and average cost')
      return
    }
    try {
      await addHolding.mutateAsync({
        symbol: formData.symbol,
        quantity: parseFloat(formData.quantity),
        avg_cost: parseFloat(formData.avgCost),
      })
      toast.success(`${formData.symbol} added to portfolio`)
      setFormData({ symbol: '', quantity: '', avgCost: '' })
      setShowForm(false)
    } catch (err) {
      toast.error(err?.detail || 'Failed to add holding')
    }
  }

  const openSell = (holding) => {
    setSellTarget(holding)
    setSellForm({ quantity: '', price: holding.last_price != null ? String(holding.last_price) : '' })
  }

  const doSell = async () => {
    const qty = parseFloat(sellForm.quantity)
    const price = parseFloat(sellForm.price)
    try {
      await sellHolding.mutateAsync({ symbol: sellTarget.symbol, quantity: qty, price })
      toast.success(`Sold ${qty} ${sellTarget.symbol}`)
      setSellTarget(null)
      setConfirmFullSell(false)
    } catch (err) {
      toast.error(err?.detail || 'Sell failed')
      setConfirmFullSell(false)
    }
  }

  const handleSellSubmit = (e) => {
    e.preventDefault()
    const qty = parseFloat(sellForm.quantity)
    const price = parseFloat(sellForm.price)
    if (!qty || qty <= 0 || !price || price <= 0) {
      toast.error('Enter a valid quantity and price')
      return
    }
    if (qty > sellTarget.quantity) {
      toast.error(`You only hold ${sellTarget.quantity}`)
      return
    }
    if (qty === sellTarget.quantity) {
      setConfirmFullSell(true) // closing the whole position — confirm
      return
    }
    doSell()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Portfolio</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your investments.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 self-start"
        >
          <Plus className="w-5 h-5" />
          Add Holding
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          Failed to load portfolio{error?.detail ? `: ${error.detail}` : ''}
        </div>
      )}

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Invested</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalInvested)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Value</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Gain/Loss</p>
            <p className={`text-3xl font-bold ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(gainLoss)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {totalInvested > 0 ? ((gainLoss / totalInvested) * 100).toFixed(2) : '0.00'}%
            </p>
          </div>
        </div>
      )}

      {/* Add Holding Form */}
      {showForm && (
        <form onSubmit={handleAddHolding} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <label className="block">
              <span className="sr-only">Symbol</span>
              <input type="text" placeholder="Symbol" value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                className={inputCls} />
            </label>
            <label className="block">
              <span className="sr-only">Quantity</span>
              <input type="number" placeholder="Quantity" value={formData.quantity} step="any"
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className={inputCls} />
            </label>
            <label className="block">
              <span className="sr-only">Average cost</span>
              <input type="number" placeholder="Avg Cost" value={formData.avgCost} step="0.01"
                onChange={(e) => setFormData({ ...formData, avgCost: e.target.value })}
                className={inputCls} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addHolding.isPending}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              {addHolding.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Holdings — table on desktop, cards on mobile */}
      {isLoading ? (
        <SkeletonTable />
      ) : holdings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No holdings yet.</p>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
            Add your first holding
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Symbol', 'Qty', 'Avg Cost', 'Current', 'Value', 'Gain/Loss', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {holdings.map(h => (
                  <tr key={h.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-semibold">
                      <Link to={`/stock/${h.symbol}`} className="text-blue-600 dark:text-blue-400 hover:underline">{h.symbol}</Link>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-200">{h.quantity}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-200">{formatCurrency(h.avg_cost)}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-200">{h.last_price !== null ? formatCurrency(h.last_price) : '—'}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{h.current_value !== null ? formatCurrency(h.current_value) : '—'}</td>
                    <td className={`px-6 py-4 font-semibold ${(h.gain_loss ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {h.gain_loss !== null ? formatCurrency(h.gain_loss) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => openSell(h)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Sell</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {holdings.map(h => (
              <div key={h.symbol} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-2">
                  <Link to={`/stock/${h.symbol}`} className="font-bold text-blue-600 dark:text-blue-400">{h.symbol}</Link>
                  <button onClick={() => openSell(h)} className="text-sm text-red-600 dark:text-red-400">Sell</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>Qty: {h.quantity}</span>
                  <span>Avg: {formatCurrency(h.avg_cost)}</span>
                  <span>Now: {h.last_price !== null ? formatCurrency(h.last_price) : '—'}</span>
                  <span className={`font-semibold ${(h.gain_loss ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {h.gain_loss !== null ? formatCurrency(h.gain_loss) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sell modal */}
      <Modal isOpen={!!sellTarget && !confirmFullSell} onClose={() => setSellTarget(null)} title={sellTarget ? `Sell ${sellTarget.symbol}` : ''}>
        {sellTarget && (
          <form onSubmit={handleSellSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Quantity (held: {sellTarget.quantity})
              </label>
              <input type="number" step="any" min="0" max={sellTarget.quantity} autoFocus
                value={sellForm.quantity}
                onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })}
                className={inputCls} />
              <button type="button"
                onClick={() => setSellForm({ ...sellForm, quantity: String(sellTarget.quantity) })}
                className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Sell all
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Price per share</label>
              <input type="number" step="0.01" min="0"
                value={sellForm.price}
                onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })}
                className={inputCls} />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setSellTarget(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Cancel
              </button>
              <button type="submit" disabled={sellHolding.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:opacity-50">
                {sellHolding.isPending ? 'Selling…' : 'Sell'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm closing the whole position */}
      <ConfirmDialog
        isOpen={confirmFullSell}
        onClose={() => setConfirmFullSell(false)}
        onConfirm={doSell}
        title="Close entire position?"
        message={sellTarget ? `This sells all ${sellTarget.quantity} shares of ${sellTarget.symbol} and removes it from your portfolio.` : ''}
        confirmText="Sell all"
        variant="danger"
        loading={sellHolding.isPending}
      />
    </div>
  )
}
