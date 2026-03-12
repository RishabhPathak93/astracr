import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access') || null,
  refreshToken: localStorage.getItem('refresh') || null,
  isAuthenticated: !!localStorage.getItem('access'),

  setTokens: (access, refresh) => {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refresh)
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  hasPermission: (key) => {
    const { user } = get()
    if (!user) return false
    if (user.role === 'admin') return true
    return user.permissions?.[key] === true
  },
}))
