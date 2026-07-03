import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../config/api'

// Fetch portfolio holdings (placeholder)
export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      // Placeholder: returns mock data for now
      return {
        status: 'success',
        holdings: [],
        totalValue: 0,
        totalCost: 0,
        gainLoss: 0
      }
    },
    staleTime: 300000,
  })
}

// Add holding (placeholder)
export function useAddHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (holdingData) => {
      // Placeholder: will connect to backend in Phase 2
      return { status: 'success', holding: holdingData }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    }
  })
}
