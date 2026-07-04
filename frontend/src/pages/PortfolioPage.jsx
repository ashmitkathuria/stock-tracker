import { useState } from 'react'
import { Plus } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'
import { usePortfolio, useAddHolding, useSellHolding } from '../hooks/usePortfolio'

export function PortfolioPage() {
  const { data, isLoading, error } = usePortfolio()
  const addHolding = useAddHolding()
  const sellHolding = useSellHolding()

  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState({ symbol: '', quantity: '', avgCost: '' })

  const holdings = data?.holdings ?? []
  const totalInvested = data?.total_cost ?? 0
  const totalValue = data?.total_value ?? 0
  const gainLoss = data?.gain_loss ?? 0

  const handleAddHolding = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!formData.symbol || !formData.quantity || !formData.avgCost) return
    try {
      await addHolding.mutateAsync({
        symbol: formData.symbol,
        quantity: parseFloat(formData.quantity),
        avg_cost: parseFloat(formData.avgCost),
      })
      setFormData({ symbol: '', quantity: '', avgCost: '' })
      setShowForm(false)
    } catch (err) {
      setFormError(err?.detail || 'Failed to add holding')
    }
  }

  const handleSell = async (holding) => {
    const qty = window.prompt(`Sell how many of ${holding.symbol}? (held: ${holding.quantity})`)
    if (!qty) return
    const price = window.prompt('Sell price per share?', holding.last_price ?? '')
    if (!price) return
    try {
      await sellHolding.mutateAsync({
        symbol: holding.symbol,
        quantity: parseFloat(qty),
        price: parseFloat(price),
      })
    } catch (err) {
      window.alert(err?.detail || 'Sell failed')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Portfolio</h1>
          <p className="text-gray-600">Manage your investments.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Holding
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Failed to load portfolio{error?.detail ? `: ${error.detail}` : ''}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Invested</p>
          <p className="text-3xl font-bold text-gray-900">{isLoading ? '…' : formatCurrency(totalInvested)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Current Value</p>
          <p className="text-3xl font-bold text-blue-600">{isLoading ? '…' : formatCurrency(totalValue)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Gain/Loss</p>
          <p className={`text-3xl font-bold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {isLoading ? '…' : formatCurrency(gainLoss)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {totalInvested > 0 ? ((gainLoss / totalInvested) * 100).toFixed(2) : '0.00'}%
          </p>
        </div>
      </div>

      {/* Add Holding Form */}
      {showForm && (
        <form onSubmit={handleAddHolding} className="bg-white rounded-lg shadow p-6">
          {formError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Symbol"
              value={formData.symbol}
              onChange={(e) => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Quantity"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              step="any"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Avg Cost"
              value={formData.avgCost}
              onChange={(e) => setFormData({...formData, avgCost: e.target.value})}
              step="0.01"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addHolding.isPending}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {addHolding.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Holdings Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Symbol</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Qty</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Avg Cost</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Current</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Value</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Gain/Loss</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!isLoading && holdings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No holdings yet. Click "Add Holding" to get started.
                </td>
              </tr>
            )}
            {holdings.map(h => (
              <tr key={h.symbol} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-semibold">{h.symbol}</td>
                <td className="px-6 py-4">{h.quantity}</td>
                <td className="px-6 py-4">{formatCurrency(h.avg_cost)}</td>
                <td className="px-6 py-4">{h.last_price !== null ? formatCurrency(h.last_price) : '—'}</td>
                <td className="px-6 py-4 font-semibold">{h.current_value !== null ? formatCurrency(h.current_value) : '—'}</td>
                <td className={`px-6 py-4 font-semibold ${(h.gain_loss ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {h.gain_loss !== null ? formatCurrency(h.gain_loss) : '—'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleSell(h)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
