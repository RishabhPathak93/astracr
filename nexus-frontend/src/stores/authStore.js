import { create } from 'zustand'

// Obfuscated storage keys — plain 'access'/'refresh' nahi dikhega
const _k1 = btoa('_tsm_ac').replace(/=/g, '')
const _k2 = btoa('_tsm_rf').replace(/=/g, '')

// Simple XOR + base64 encode/decode
const _secret = Array.from('tsm@n3xus#2024').map(c => c.charCodeAt(0))

function _enc(str) {
  const bytes = Array.from(str).map((c, i) => c.charCodeAt(0) ^ _secret[i % _secret.length])
  return btoa(String.fromCharCode(...bytes))
}

function _dec(str) {
  try {
    const bytes = Array.from(atob(str)).map((c, i) => c.charCodeAt(0) ^ _secret[i % _secret.length])
    return String.fromCharCode(...bytes)
  } catch {
    return null
  }
}

const _getAccess  = () => { const v = localStorage.getItem(_k1); return v ? _dec(v) : null }
const _getRefresh = () => { const v = localStorage.getItem(_k2); return v ? _dec(v) : null }

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: _getAccess(),
  refreshToken: _getRefresh(),
  isAuthenticated: !!_getAccess(),

  setTokens: (access, refresh) => {
    localStorage.setItem(_k1, _enc(access))
    localStorage.setItem(_k2, _enc(refresh))
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem(_k1)
    localStorage.removeItem(_k2)
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  hasPermission: (key) => {
    const { user } = get()
    if (!user) return false
    if (user.role === 'admin') return true
    return user.permissions?.[key] === true
  },
}))

// Internal use — api/index.js ke liye
export const _getStoredAccess  = _getAccess
export const _getStoredRefresh = _getRefresh
export const _setStoredAccess  = (v) => localStorage.setItem(_k1, _enc(v))
export const _clearStorage     = () => { localStorage.removeItem(_k1); localStorage.removeItem(_k2) }