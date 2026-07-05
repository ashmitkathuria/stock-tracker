export function RiskMeter({ riskScore = 0, volatilityPct = null, concentrationPct = null, loading = false }) {
  const getLevel = (score) => {
    if (score < 35) return { label: 'Low', color: 'bg-green-500' }
    if (score < 65) return { label: 'Medium', color: 'bg-yellow-500' }
    return { label: 'High', color: 'bg-red-500' }
  }

  const level = getLevel(riskScore)
  // Needle sweeps from 180° (score 0, pointing left) to 0° (score 100, pointing right)
  const angle = 180 - (riskScore / 100) * 180

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-6">Portfolio Risk</h3>

      <div className="flex flex-col items-center">
        {/* Gauge */}
        <div className="relative w-40 h-20 mb-4">
          <svg
            className="w-full h-full"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
          >
            {/* Low zone */}
            <path d="M 20 80 A 60 60 0 0 1 60 30" stroke="#10b981" strokeWidth="12" fill="none" opacity="0.3" />
            {/* Medium zone */}
            <path d="M 60 30 A 60 60 0 0 1 140 30" stroke="#f59e0b" strokeWidth="12" fill="none" opacity="0.3" />
            {/* High zone */}
            <path d="M 140 30 A 60 60 0 0 1 180 80" stroke="#ef4444" strokeWidth="12" fill="none" opacity="0.3" />

            {/* Needle */}
            <line
              x1="100"
              y1="80"
              x2={100 + 60 * Math.cos((angle * Math.PI) / 180)}
              y2={80 - 60 * Math.sin((angle * Math.PI) / 180)}
              stroke="#1e40af"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="80" r="5" fill="#1e40af" />
          </svg>
        </div>

        {/* Score */}
        <div className="text-center">
          <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{loading ? '…' : riskScore}</p>
          <p className={`text-sm font-semibold ${
            level.label === 'Low' ? 'text-green-600 dark:text-green-400' :
            level.label === 'Medium' ? 'text-yellow-600' :
            'text-red-600 dark:text-red-400'
          }`}>
            {level.label} Risk
          </p>
        </div>

        {/* Legend */}
        <div className="mt-6 w-full space-y-2 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Volatility (annualized):</span>
            <span className="font-semibold">{volatilityPct !== null ? `${volatilityPct}%` : '—'}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Concentration (top holding):</span>
            <span className="font-semibold">{concentrationPct !== null ? `${concentrationPct}%` : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
