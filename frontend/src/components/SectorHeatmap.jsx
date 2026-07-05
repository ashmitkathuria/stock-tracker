import { useSectors } from '../hooks/useSectors'

export function SectorHeatmap() {
  const { data, isLoading } = useSectors()

  const sectors = (data?.sectors ?? []).map(s => ({
    name: s.sector,
    return: s.return_pct ?? 0,
  }))

  const getColor = (returnVal) => {
    if (returnVal > 3) return 'bg-green-500'
    if (returnVal > 0) return 'bg-green-300'
    if (returnVal > -3) return 'bg-red-300'
    return 'bg-red-500'
  }

  const getTextColor = (returnVal) => {
    return returnVal < -1 || returnVal > 3 ? 'text-white' : 'text-gray-800'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-baseline mb-4">
        <h3 className="font-bold text-lg">Sector Performance</h3>
        {data?.date && <span className="text-xs text-gray-500 dark:text-gray-400">{data.date}</span>}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-700 animate-pulse p-4 rounded-lg h-20" />
          ))}
        </div>
      )}

      {!isLoading && sectors.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No sector data yet — it refreshes daily at 16:15 IST.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sectors.map(sector => (
          <div
            key={sector.name}
            className={`${getColor(sector.return)} ${getTextColor(sector.return)} p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition`}
          >
            <p className="font-bold text-lg">{sector.name}</p>
            <p className="text-sm">{sector.return.toFixed(2)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
