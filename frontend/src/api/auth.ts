import { api } from '../lib/api'
import type { AuthTokens, User } from '../types'

export interface RegisterInput { email: string; password: string; password_confirm: string }
export interface GoogleExchangeResponse extends AuthTokens { user: User }

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthTokens>('/token/', { email, password })
  return data
}

export async function register(input: RegisterInput) {
  await api.post('/auth/register/', input)
}

export async function exchangeGoogleCode(code: string) {
  const { data } = await api.post<GoogleExchangeResponse>('/auth/google/exchange/', { code })
  return data
}

export function googleLoginUrl() {
  return `${api.defaults.baseURL}/auth/google/`
}

