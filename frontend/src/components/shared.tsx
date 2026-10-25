import type { ReactNode } from 'react'
import { ArrowRight, CalendarClock, CircleAlert, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { JobLifecycleStatus } from '../types'

export function Page({
  title,
  subtitle,
  actions,
  back,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: string
  children: ReactNode
}) {
  return (
    <div className="page">
      {back && (
        <Link className="back-link" to={back}>
          ← Back
        </Link>
      )}
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Loading() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading workspace data…</span>
    </div>
  )
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon danger">
        <CircleAlert size={20} />
      </div>
      <h3>Something went wrong</h3>
      <p className="muted">{message}</p>
      <button className="button secondary" onClick={retry}>
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  )
}

export function EmptyState({
  title,
  text,
  action,
  href,
}: {
  title: string
  text: string
  action?: string
  href?: string
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <CalendarClock size={20} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {action && href && (
        <Link className="button secondary" to={href}>
          {action} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  )
}

export function Status({ status }: { status: JobLifecycleStatus }) {
  const labels: Record<JobLifecycleStatus, string> = {
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  return (
    <span className={`status ${status === 'active' || status === 'completed' ? 'success' : status === 'failed' || status === 'cancelled' ? 'failed' : 'muted-status'}`}>
      <span />
      {labels[status]}
    </span>
  )
}
