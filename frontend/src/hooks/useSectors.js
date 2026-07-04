import { useQuery } from '@tanstack/react-query'
import apiClient from '../config/api'

// Latest sector index performance
export function useSectors() {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: () => apiClient.get('/sectors'),
    staleTime: 300000, // 5 minutes
    retry: 1,
  })
}
