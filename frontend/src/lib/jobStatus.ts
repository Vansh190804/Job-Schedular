import type { Job, JobLifecycleStatus, JobRun } from '../types'

function backendStatus(job: Job): JobLifecycleStatus | null {
  if (job.cancelled_at) return 'cancelled'
  return null
}

export function getJobLifecycleStatus(job: Job, runs: JobRun[] = []): JobLifecycleStatus {
  const authoritativeStatus = backendStatus(job)
  if (authoritativeStatus) return authoritativeStatus

  if (!job.is_active) return 'paused'

  if (job.schedule_type === 'one_time') {
    if (runs.some(run => run.status === 'success')) return 'completed'
    if (runs.some(run => run.status === 'failed')) return 'failed'
  }

  return 'active'
}

export function isJobActive(job: Job, runs: JobRun[] = []) {
  return getJobLifecycleStatus(job, runs) === 'active'
}

export function isJobCancelled(job: Job, runs: JobRun[] = []) {
  return getJobLifecycleStatus(job, runs) === 'cancelled'
}

export function isJobTerminal(job: Job, runs: JobRun[] = []) {
  const status = getJobLifecycleStatus(job, runs)
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
