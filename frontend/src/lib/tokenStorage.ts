import type { AuthTokens } from '../types'

const key = 'job-scheduler-auth'

export function getTokens(): AuthTokens | null {
  const stored = localStorage.getItem(key)
  if (!stored) return null
  try {
    const parsed: unknown = JSON.parse(stored)
    if (
      typeof parsed === 'object' && parsed !== null &&
      'access' in parsed && 'refresh' in parsed &&
      typeof parsed.access === 'string' && typeof parsed.refresh === 'string'
    ) return parsed as AuthTokens
  } catch {
    localStorage.removeItem(key)
  }
  return null
}

export function saveTokens(tokens: AuthTokens) {
  localStorage.setItem(key, JSON.stringify(tokens))
}

export function clearTokens() {
  localStorage.removeItem(key)
}

