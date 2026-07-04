import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../config/api'

// Fetch portfolio holdings with live valuations
export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiClient.get('/portfolio'),
    staleTime: 60000,
  })
}

// Add (or merge) a holding — also records a BUY trade
export function useAddHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (holdingData) => apiClient.post('/portfolio', holdingData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

// Sell part or all of a holding
export function useSellHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ symbol, quantity, price }) =>
      apiClient.post(`/portfolio/${symbol}/sell`, { quantity, price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

// Trade history
export function useTrades() {
  return useQuery({
    queryKey: ['trades'],
    queryFn: () => apiClient.get('/portfolio/trades'),
    staleTime: 60000,
  })
}

// Portfolio risk score (0-100) with volatility/concentration breakdown
export function usePortfolioRisk() {
  return useQuery({
    queryKey: ['portfolio', 'risk'],
    queryFn: () => apiClient.get('/portfolio/risk'),
    staleTime: 300000,
    retry: 1,
  })
}
