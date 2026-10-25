import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getTokens, saveTokens } from './tokenStorage'
import type { AuthTokens } from '../types'

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '')

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<AuthTokens> | null = null

function isPublicRequest(config: InternalAxiosRequestConfig) {
  const path = config.url || ''
  return path.includes('/token') || path.includes('/auth/register') || path.includes('/auth/google/exchange')
}

api.interceptors.request.use((config) => {
  if (!isPublicRequest(config)) {
    const tokens = getTokens()
    if (tokens) config.headers.Authorization = `Bearer ${tokens.access}`
  } else {
    delete config.headers.Authorization
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config
    if (!original || error.response?.status !== 401 || original._retry || isPublicRequest(original)) {
      return Promise.reject(error)
    }
    const current = getTokens()
    if (!current?.refresh) {
      clearTokens()
      return Promise.reject(error)
    }
    original._retry = true
    refreshPromise ??= axios.post<AuthTokens>(`${baseURL}/token/refresh/`, { refresh: current.refresh })
      .then(({ data }) => {
        saveTokens({ ...current, access: data.access})
        return data
      })
      .catch((refreshError) => {
        clearTokens()
        return Promise.reject(refreshError)
      })
      .finally(() => { refreshPromise = null })
    try {
      const tokens = await refreshPromise
      original.headers.Authorization = `Bearer ${tokens.access}`
      return api(original)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

export function apiError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!axios.isAxiosError(error)) return fallback
  if (!error.response) return 'Unable to reach the backend. Check that the API is running.'
  const data: unknown = error.response.data
  if (typeof data === 'object' && data !== null && 'detail' in data && typeof data.detail === 'string') return data.detail
  if (typeof data === 'object' && data !== null) {
    const messages = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === 'string')
    if (messages.length) return messages.join(' ')
  }
  return fallback
}

