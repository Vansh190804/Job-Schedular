import type { Job, TaskType } from '../types'

export const taskLabels: Record<TaskType, string> = {
  generate_report: 'Generate report',
  send_notification: 'Send notification',
  call_webhook: 'Call webhook',
}

export function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—'
}

export function scheduleLabel(job: Job) {
  return job.schedule_type === 'one_time'
    ? `Once · ${formatDate(job.run_at)}`
    : `Every ${job.interval_seconds ? Math.round(job.interval_seconds / 60) : 0} min`
}
