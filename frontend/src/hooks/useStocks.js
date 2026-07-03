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

// Add to watchlist (placeholder)
export function useAddToWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (symbol) => {
      // Placeholder: will connect to backend in Phase 2
      return { symbol, status: 'added' }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    }
  })
}

// Remove from watchlist (placeholder)
export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (symbol) => {
      // Placeholder: will connect to backend in Phase 2
      return { symbol, status: 'removed' }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    }
  })
}
