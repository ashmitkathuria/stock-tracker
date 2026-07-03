import { useState } from 'react'
import { Plus } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'

export function PortfolioPage() {
  const [holdings, setHoldings] = useState([
    { symbol: 'RELIANCE', quantity: 10, avgCost: 1200, currentPrice: 1304 },
    { symbol: 'INFY', quantity: 5, avgCost: 1000, currentPrice: 1055 },
  ])

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    avgCost: '',
  })

  const handleAddHolding = (e) => {
    e.preventDefault()
    if (formData.symbol && formData.quantity && formData.avgCost) {
      setHoldings([
        ...holdings,
        {
          ...formData,
          quantity: parseInt(formData.quantity),
          avgCost: parseFloat(formData.avgCost),
          currentPrice: parseFloat(formData.avgCost),
        }
      ])
      setFormData({ symbol: '', quantity: '', avgCost: '' })
      setShowForm(false)
    }
  }

  const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgCost), 0)
  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0)
  const gainLoss = totalValue - totalInvested

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Invested</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Current Value</p>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(totalValue)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Gain/Loss</p>
          <p className={`text-3xl font-bold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(gainLoss)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {totalInvested > 0 ? ((gainLoss / totalInvested) * 100).toFixed(2) : '0.00'}%
          </p>
        </div>
      </div>

      {/* Add Holding Form */}
      {showForm && (
        <form onSubmit={handleAddHolding} className="bg-white rounded-lg shadow p-6">
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
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Save
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {holdings.map(holding => {
              const value = holding.quantity * holding.currentPrice
              const cost = holding.quantity * holding.avgCost
              const gl = value - cost
              return (
                <tr key={holding.symbol} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold">{holding.symbol}</td>
                  <td className="px-6 py-4">{holding.quantity}</td>
                  <td className="px-6 py-4">{formatCurrency(holding.avgCost)}</td>
                  <td className="px-6 py-4">{formatCurrency(holding.currentPrice)}</td>
                  <td className="px-6 py-4 font-semibold">{formatCurrency(value)}</td>
                  <td className={`px-6 py-4 font-semibold ${gl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(gl)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
