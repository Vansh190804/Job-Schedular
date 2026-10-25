import { useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { clearTokens, getTokens, saveTokens } from '../lib/tokenStorage'
import { AuthContext, type AuthContextValue } from './authContext'
import type { User } from '../types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getTokens()))
  const [user, setUser] = useState<User | null>(null)
  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated: authenticated,
    user,
    async login(email, password) {
      const tokens = await authApi.login(email, password)
      saveTokens(tokens)
      setAuthenticated(true)
    },
    async register(email, password, passwordConfirm) {
      await authApi.register({ email, password, password_confirm: passwordConfirm })
    },
    async exchangeGoogleCode(code) {
      const response = await authApi.exchangeGoogleCode(code)
      saveTokens(response)
      setUser(response.user)
      setAuthenticated(true)
    },
    logout() {
      clearTokens()
      setUser(null)
      setAuthenticated(false)
    },
  }), [authenticated, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
