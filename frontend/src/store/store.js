import { create } from 'zustand'

export const useStore = create((set) => ({
  // Auth
  user: null,
  token: localStorage.getItem('token') || null,

  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  // UI
  darkMode: localStorage.getItem('darkMode') === 'true',
  toggleDarkMode: () => set((state) => {
    const newMode = !state.darkMode
    localStorage.setItem('darkMode', String(newMode))
    return { darkMode: newMode }
  }),

  // Data
  watchlist: [],
  setWatchlist: (watchlist) => set({ watchlist }),

  portfolio: [],
  setPortfolio: (portfolio) => set({ portfolio }),

  selectedStock: null,
  setSelectedStock: (stock) => set({ selectedStock: stock }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}))
