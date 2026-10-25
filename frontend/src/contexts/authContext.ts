import { createContext } from 'react'
import type { User } from '../types'

export interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, passwordConfirm: string) => Promise<void>
  exchangeGoogleCode: (code: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
