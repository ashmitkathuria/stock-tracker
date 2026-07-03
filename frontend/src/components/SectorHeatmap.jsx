export function SectorHeatmap() {
  const sectors = [
    { name: 'IT', return: 5.2 },
    { name: 'Bank', return: 3.1 },
    { name: 'Pharma', return: -1.5 },
    { name: 'Auto', return: 2.3 },
    { name: 'Infra', return: 4.8 },
    { name: 'Energy', return: -2.1 },
    { name: 'Metal', return: 1.2 },
    { name: 'FMCG', return: 0.5 },
  ]

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
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">Sector Performance</h3>

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
