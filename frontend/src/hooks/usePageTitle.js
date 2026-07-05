import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · STK Stock Tracker` : 'STK Stock Tracker'
    return () => { document.title = 'STK Stock Tracker' }
  }, [title])
}
