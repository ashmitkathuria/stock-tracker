export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
      <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 animate-pulse">
          <div className="flex gap-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded flex-1"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded flex-1"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded flex-1"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
      <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
    </div>
  )
}
