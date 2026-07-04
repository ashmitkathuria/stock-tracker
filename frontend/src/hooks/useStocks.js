import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../config/api'

// Fetch stock price
export function useStockPrice(symbol) {
  return useQuery({
    queryKey: ['stock', symbol, 'price'],
    queryFn: async () => {
      const response = await apiClient.get(`/stocks/${symbol}/price`)
      return response
    },
    enabled: !!symbol,
    staleTime: 60000, // 1 minute
    retry: 2,
  })
}

// Fetch stock history
export function useStockHistory(symbol, days = 30) {
  return useQuery({
    queryKey: ['stock', symbol, 'history', days],
    queryFn: async () => {
      const response = await apiClient.get(`/stocks/${symbol}/history`, {
        params: { days }
      })
      return response
    },
    enabled: !!symbol,
    staleTime: 300000, // 5 minutes
  })
}

// Manually fetch stock price
export function useFetchStockPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (symbol) => {
      const response = await apiClient.post(`/stocks/${symbol}/fetch`)
      return response
    },
    onSuccess: (data, symbol) => {
      queryClient.invalidateQueries({ queryKey: ['stock', symbol] })
    }
  })
}

// Watchlist with latest prices
export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: () => apiClient.get('/watchlist'),
    staleTime: 60000,
  })
}

// Add to watchlist
export function useAddToWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (symbol) => apiClient.post('/watchlist', { symbol }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    }
  })
}

// Remove from watchlist
export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (symbol) => apiClient.delete(`/watchlist/${symbol}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    }
  })
}

// Latest ML prediction for a symbol
export function usePrediction(symbol) {
  return useQuery({
    queryKey: ['prediction', symbol],
    queryFn: () => apiClient.get(`/predictions/${symbol}`),
    enabled: !!symbol,
    staleTime: 300000, // 5 minutes
    retry: 1,
  })
}

// Recent news with sentiment for a symbol
export function useNews(symbol, limit = 10) {
  return useQuery({
    queryKey: ['news', symbol, limit],
    queryFn: () => apiClient.get(`/news/${symbol}`, { params: { limit } }),
    enabled: !!symbol,
    staleTime: 300000,
    retry: 1,
  })
}
