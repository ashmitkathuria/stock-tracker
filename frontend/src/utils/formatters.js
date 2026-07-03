export const formatCurrency = (value, currency = '₹') => {
  if (value === null || value === undefined) return 'N/A'
  return `${currency} ${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export const formatPercent = (value) => {
  if (value === null || value === undefined) return 'N/A'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(2)}%`
}

export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return 'N/A'
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export const getChangeColor = (value) => {
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-gray-600'
}

export const getChangeBgColor = (value) => {
  if (value > 0) return 'bg-green-100'
  if (value < 0) return 'bg-red-100'
  return 'bg-gray-100'
}
