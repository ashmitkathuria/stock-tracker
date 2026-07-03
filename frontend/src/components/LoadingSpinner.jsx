export function LoadingSpinner({ size = 'md' }) {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }[size]

  return (
    <div className="flex justify-center items-center">
      <div className={`${sizeClass} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}></div>
    </div>
  )
}
