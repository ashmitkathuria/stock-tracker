import { useState, useEffect } from 'react'
import { useNews } from '../hooks/useStocks'
import { formatDate } from '../utils/formatters'

function SentimentBadge({ score }) {
  if (score === null || score === undefined) return null
  const label = score >= 0.05 ? 'Positive' : score <= -0.05 ? 'Negative' : 'Neutral'
  const cls = score >= 0.05
    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
    : score <= -0.05
      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${cls}`}>
      {label} {score.toFixed(2)}
    </span>
  )
}

export function NewsPanel({ symbols = [] }) {
  const [selected, setSelected] = useState(symbols[0] ?? null)

  useEffect(() => {
    if (!selected && symbols.length > 0) setSelected(symbols[0])
  }, [symbols, selected])

  const { data, isLoading } = useNews(selected)
  const articles = data?.articles ?? []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-lg">News & Sentiment</h3>
        <div className="flex gap-1 flex-wrap">
          {symbols.map(s => (
            <button
              key={s}
              onClick={() => setSelected(s)}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                s === selected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading news…</p>}

      {!isLoading && articles.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No stored headlines for {selected ?? 'your watchlist'} yet — news refreshes daily at 17:00 IST.
        </p>
      )}

      <ul className="divide-y divide-gray-100">
        {articles.map(a => (
          <li key={a.url} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 line-clamp-2"
              >
                {a.headline}
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {a.source ?? 'Unknown'} · {formatDate(a.published_at)}
              </p>
            </div>
            <SentimentBadge score={a.sentiment_score} />
          </li>
        ))}
      </ul>
    </div>
  )
}
